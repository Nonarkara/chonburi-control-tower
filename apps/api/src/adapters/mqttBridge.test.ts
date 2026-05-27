import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * mqttBridge.ts contract tests.
 *
 * Covers the two exported-for-testing pure helpers:
 *   - parseMqttPublish — binary MQTT v3.1.1 PUBLISH packet parser
 *   - handlePayload    — JSON routing to twinStore (FAHFON + topic-path)
 * And the public status/lifecycle API:
 *   - getMqttStatus    — initial state
 *   - stopMqttBridge   — idempotent when never started
 */

// Mock the twinStore so handlePayload can be tested without a live DB
vi.mock("../lib/twinStore.js", () => ({
  hydrateSensorFromFahfon: vi.fn(),
  writeTwinState: vi.fn(),
  upsertTwinObject: vi.fn(),
}));

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal MQTT PUBLISH packet (QoS 0). */
function buildPublish(topic: string, payloadStr: string, qos: 0 | 1 | 2 = 0): DataView {
  const topicBytes = new TextEncoder().encode(topic);
  const payloadBytes = new TextEncoder().encode(payloadStr);
  // remaining = 2 (topic len) + topicLen + (qos>0 ? 2 : 0) + payloadLen
  const packetIdLen = qos > 0 ? 2 : 0;
  const remaining = 2 + topicBytes.length + packetIdLen + payloadBytes.length;

  // Fixed header: 2 bytes (type|flags, remaining), then variable header + payload
  const buf = new ArrayBuffer(2 + remaining);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);

  // Byte 0: PUBLISH (3) << 4 | flags (QoS in bits 2-1)
  view.setUint8(0, (0x03 << 4) | (qos << 1));
  // Byte 1: remaining length (single byte — enough for small test packets)
  view.setUint8(1, remaining);

  let pos = 2;
  // Topic length (big-endian 2 bytes)
  view.setUint16(pos, topicBytes.length);
  pos += 2;
  u8.set(topicBytes, pos);
  pos += topicBytes.length;

  if (qos > 0) {
    // Packet identifier — use 0x0001
    view.setUint16(pos, 1);
    pos += 2;
  }

  u8.set(payloadBytes, pos);
  return view;
}

/** Build a non-PUBLISH MQTT packet (e.g. CONNACK type=2). */
function buildNonPublish(): DataView {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setUint8(0, 0x20); // CONNACK (type=2)
  view.setUint8(1, 2);    // remaining length
  view.setUint8(2, 0);    // session-present = 0
  view.setUint8(3, 0);    // return code = 0
  return view;
}

// ─── parseMqttPublish ─────────────────────────────────────────────────────────

describe("parseMqttPublish — packet type guard", () => {
  it("returns null for non-PUBLISH packets (CONNACK type 2)", async () => {
    const { parseMqttPublish } = await import("./mqttBridge.js");
    const result = parseMqttPublish(buildNonPublish());
    expect(result).toBeNull();
  });

  it("returns null for a SUBSCRIBE packet (type 8)", async () => {
    const { parseMqttPublish } = await import("./mqttBridge.js");
    const buf = new ArrayBuffer(2);
    const view = new DataView(buf);
    view.setUint8(0, 0x82); // SUBSCRIBE
    view.setUint8(1, 0);
    expect(parseMqttPublish(view)).toBeNull();
  });
});

describe("parseMqttPublish — QoS 0 PUBLISH", () => {
  it("extracts the topic string correctly", async () => {
    const { parseMqttPublish } = await import("./mqttBridge.js");
    const view = buildPublish("chonburi/sensors/aq", '{"value":42}');
    const result = parseMqttPublish(view);
    expect(result).not.toBeNull();
    expect(result!.topic).toBe("chonburi/sensors/aq");
  });

  it("extracts the payload bytes correctly", async () => {
    const { parseMqttPublish } = await import("./mqttBridge.js");
    const payload = '{"station":"S01","pm25":12.5}';
    const view = buildPublish("test/topic", payload);
    const result = parseMqttPublish(view);
    expect(result).not.toBeNull();
    const decoded = new TextDecoder().decode(result!.payload);
    expect(decoded).toBe(payload);
  });

  it("handles a single-character topic", async () => {
    const { parseMqttPublish } = await import("./mqttBridge.js");
    const view = buildPublish("x", "hello");
    const result = parseMqttPublish(view);
    expect(result!.topic).toBe("x");
  });

  it("handles an empty payload", async () => {
    const { parseMqttPublish } = await import("./mqttBridge.js");
    const view = buildPublish("t/t", "");
    const result = parseMqttPublish(view);
    expect(result).not.toBeNull();
    expect(result!.payload.length).toBe(0);
  });
});

describe("parseMqttPublish — QoS 1 PUBLISH (packet-id skipped)", () => {
  it("still extracts topic correctly when QoS=1 adds a 2-byte packet ID", async () => {
    const { parseMqttPublish } = await import("./mqttBridge.js");
    const payload = '{"ok":true}';
    const view = buildPublish("qos1/topic", payload, 1);
    const result = parseMqttPublish(view);
    expect(result).not.toBeNull();
    expect(result!.topic).toBe("qos1/topic");
  });
});

// ─── handlePayload — FAHFON sensor routing ────────────────────────────────────

describe("handlePayload — FAHFON sensor", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("calls hydrateSensorFromFahfon when payload has a station field", async () => {
    const { handlePayload } = await import("./mqttBridge.js");
    const ts = await import("../lib/twinStore.js") as { hydrateSensorFromFahfon: ReturnType<typeof vi.fn> };
    const payload = JSON.stringify({ station: "S01", lat: 13.36, lng: 100.98, pm25: 15.2, tempC: 31 });
    handlePayload("chonburi/sensors/fahfon", payload);
    expect(ts.hydrateSensorFromFahfon).toHaveBeenCalledOnce();
    const arg = ts.hydrateSensorFromFahfon.mock.calls[0][0];
    expect(arg.station).toBe("S01");
    expect(arg.pm25).toBe(15.2);
    expect(arg.tempC).toBe(31);
  });

  it("passes undefined for optional numeric fields absent in the payload", async () => {
    const { handlePayload } = await import("./mqttBridge.js");
    const ts = await import("../lib/twinStore.js") as { hydrateSensorFromFahfon: ReturnType<typeof vi.fn> };
    handlePayload("t", JSON.stringify({ station: "S02" }));
    const arg = ts.hydrateSensorFromFahfon.mock.calls[0][0];
    expect(arg.pm25).toBeUndefined();
    expect(arg.co2Ppm).toBeUndefined();
  });

  it("does NOT call writeTwinState when the station field is present", async () => {
    const { handlePayload } = await import("./mqttBridge.js");
    const ts = await import("../lib/twinStore.js") as { writeTwinState: ReturnType<typeof vi.fn> };
    handlePayload("t", JSON.stringify({ station: "S03", pm25: 10 }));
    expect(ts.writeTwinState).not.toHaveBeenCalled();
  });
});

// ─── handlePayload — topic-path twin state routing ────────────────────────────

describe("handlePayload — /twin/state topic routing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("calls writeTwinState when topic matches /twin/state/<objectId>/<metric>", async () => {
    const { handlePayload } = await import("./mqttBridge.js");
    const ts = await import("../lib/twinStore.js") as { writeTwinState: ReturnType<typeof vi.fn> };
    handlePayload("/twin/state/building-42/temperature", JSON.stringify({ value: 25.5 }));
    expect(ts.writeTwinState).toHaveBeenCalledOnce();
    const call = ts.writeTwinState.mock.calls[0][0];
    expect(call.objectId).toBe("building-42");
    expect(call.metric).toBe("temperature");
    expect(call.value).toBe(25.5);
    expect(call.source).toBe("mqtt");
  });

  it("does not call writeTwinState when value is NaN", async () => {
    const { handlePayload } = await import("./mqttBridge.js");
    const ts = await import("../lib/twinStore.js") as { writeTwinState: ReturnType<typeof vi.fn> };
    handlePayload("/twin/state/obj-1/metric", JSON.stringify({ value: "not-a-number" }));
    expect(ts.writeTwinState).not.toHaveBeenCalled();
  });

  it("does not call writeTwinState when topic does not match the pattern", async () => {
    const { handlePayload } = await import("./mqttBridge.js");
    const ts = await import("../lib/twinStore.js") as { writeTwinState: ReturnType<typeof vi.fn> };
    handlePayload("arbitrary/topic", JSON.stringify({ value: 99 }));
    expect(ts.writeTwinState).not.toHaveBeenCalled();
  });
});

// ─── handlePayload — error resilience ────────────────────────────────────────

describe("handlePayload — error resilience", () => {
  it("does not throw on invalid (non-JSON) payload", async () => {
    const { handlePayload } = await import("./mqttBridge.js");
    expect(() => handlePayload("some/topic", "this is not json")).not.toThrow();
  });

  it("does not throw on empty string payload", async () => {
    const { handlePayload } = await import("./mqttBridge.js");
    expect(() => handlePayload("t", "")).not.toThrow();
  });
});

// ─── getMqttStatus / stopMqttBridge ──────────────────────────────────────────

describe("getMqttStatus — initial state", () => {
  it("reports disconnected with zero message count initially", async () => {
    const { getMqttStatus } = await import("./mqttBridge.js");
    const status = getMqttStatus();
    expect(status.connected).toBe(false);
    expect(status.messageCount).toBe(0);
    expect(status.lastError).toBeNull();
    expect(status.brokerUrl).toBeNull();
  });
});

describe("stopMqttBridge — lifecycle", () => {
  it("is safe to call when the bridge was never started (no throw)", async () => {
    const { stopMqttBridge } = await import("./mqttBridge.js");
    expect(() => stopMqttBridge()).not.toThrow();
  });

  it("remains disconnected after stop", async () => {
    const { stopMqttBridge, getMqttStatus } = await import("./mqttBridge.js");
    stopMqttBridge();
    expect(getMqttStatus().connected).toBe(false);
  });
});
