import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchAisVessels, shipType, aisStatus } from "./ais";

// Prevent the dynamic import of "ws" in startAisStream from opening a real WebSocket.
vi.mock("ws", () => ({
  default: class MockWS {
    on() {}
    send() {}
  },
}));

/**
 * AIS adapter contract tests.
 *
 * The module-level WebSocket state starts as disconnected with no token.
 * We can test the no-token path without network calls since the adapter
 * short-circuits before attempting a WebSocket connection.
 */
describe("ais adapter — missing-token contract", () => {
  it("returns 'unavailable' with a descriptive note when no token is configured", () => {
    // Fresh import — wsTokenConfigured=false, wsConnected=false
    const feed = fetchAisVessels();

    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.source).toBe("aisstream.io");
    expect(feed.meta.note).toMatch(/AISSTREAM_TOKEN/);
    expect(feed.features).toHaveLength(0);
  });

  it("returns an empty features array with valid ageMinutes", () => {
    const feed = fetchAisVessels();

    expect(Array.isArray(feed.features)).toBe(true);
    expect(typeof feed.meta.ageMinutes).toBe("number");
    expect(feed.meta.ageMinutes).toBeGreaterThanOrEqual(0);
  });
});

// ─── shipType — AIS ship-type code classifier ─────────────────────────────────

describe("shipType — ITU/AIS code mapping", () => {
  it("null/undefined → 'unknown'", () => {
    expect(shipType(undefined)).toBe("unknown");
    expect(shipType(0)).toBe("unknown");
  });

  it("60–69 → 'passenger'", () => {
    expect(shipType(60)).toBe("passenger");
    expect(shipType(69)).toBe("passenger");
    expect(shipType(65)).toBe("passenger");
  });

  it("70–79 → 'cargo'", () => {
    expect(shipType(70)).toBe("cargo");
    expect(shipType(79)).toBe("cargo");
    expect(shipType(71)).toBe("cargo");
  });

  it("80–89 → 'tanker'", () => {
    expect(shipType(80)).toBe("tanker");
    expect(shipType(89)).toBe("tanker");
  });

  it("30 → 'fishing'", () => {
    expect(shipType(30)).toBe("fishing");
  });

  it("36–37 → 'pleasure'", () => {
    expect(shipType(36)).toBe("pleasure");
    expect(shipType(37)).toBe("pleasure");
  });

  it("31, 32, 52 → 'tug'", () => {
    expect(shipType(31)).toBe("tug");
    expect(shipType(32)).toBe("tug");
    expect(shipType(52)).toBe("tug");
  });

  it("unrecognized codes → 'unknown'", () => {
    expect(shipType(99)).toBe("unknown");
    expect(shipType(50)).toBe("unknown");
    expect(shipType(40)).toBe("unknown");
  });
});

// ─── fetchAisVessels note variants ────────────────────────────────────────────

describe("fetchAisVessels — note variants via startAisStream (isolated)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns 'disconnected' note when token is configured but WS not yet connected", async () => {
    const { fetchAisVessels: freshFetch, startAisStream } = await import("./ais.js") as unknown as {
      fetchAisVessels: () => { meta: { fallbackTier: string; note?: string }; features: unknown[] };
      startAisStream: (token: string) => void;
    };

    // Calling startAisStream sets wsTokenConfigured=true synchronously before the async ws import
    startAisStream("test-token-abc");

    // Immediately call fetchAisVessels — wsConnected is still false at this point
    const feed = freshFetch();

    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.note).toMatch(/disconnected|reconnecting/i);
    expect(feed.meta.note).not.toMatch(/AISSTREAM_TOKEN/);
  });
});

// ─── aisStatus ────────────────────────────────────────────────────────────────

describe("aisStatus — module state shape", () => {
  it("returns connected=false, count=0, valid uptimeSec on fresh import", () => {
    const status = aisStatus();
    expect(typeof status.connected).toBe("boolean");
    expect(typeof status.count).toBe("number");
    expect(typeof status.uptimeSec).toBe("number");
    // On fresh import without token: not connected, no vessels
    expect(status.connected).toBe(false);
    expect(status.count).toBeGreaterThanOrEqual(0);
    expect(status.uptimeSec).toBeGreaterThanOrEqual(0);
  });
});
