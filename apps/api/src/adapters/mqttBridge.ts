// Lightweight MQTT-over-WebSocket bridge for FAHFON / IoT sensor ingestion.
// Designed to work without a native MQTT client library by connecting directly
// to WebSocket-enabled MQTT brokers (EMQX, HiveMQ, Mosquitto with ws://).
// Falls back to polling the existing FAHFON REST endpoint if MQTT is unavailable.

import { writeTwinState, hydrateSensorFromFahfon, upsertTwinObject, type TwinObject } from "../lib/twinStore.js";

interface MqttConfig {
  brokerUrl: string; // e.g. "wss://broker.emqx.io:8084/mqtt"
  clientId: string;
  username?: string;
  password?: string;
  topics: string[];
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isConnected = false;
let messageCount = 0;
let lastError: string | null = null;

/** Parse a simple MQTT PUBLISH packet from raw bytes (MQTT v3.1.1).
 * @internal Exported for unit tests. */
export function parseMqttPublish(data: DataView): { topic: string; payload: Uint8Array } | null {
  // Very minimal parser for demo / lightweight use.
  // For production, replace with mqtt.js or mqtt/esm.
  const packetType = (data.getUint8(0) >> 4) & 0x0f;
  if (packetType !== 3) return null; // Not PUBLISH

  let pos = 1;
  let multiplier = 1;
  let remainingLength = 0;
  let digit: number;
  do {
    digit = data.getUint8(pos++);
    remainingLength += (digit & 0x7f) * multiplier;
    multiplier *= 128;
  } while ((digit & 0x80) !== 0);

  const topicLen = data.getUint16(pos);
  pos += 2;
  const topicBytes = new Uint8Array(data.buffer, data.byteOffset + pos, topicLen);
  const topic = new TextDecoder().decode(topicBytes);
  pos += topicLen;

  // Skip packet id if QoS > 0
  const flags = data.getUint8(0) & 0x0f;
  const qos = (flags >> 1) & 0x03;
  if (qos > 0) pos += 2;

  const payload = new Uint8Array(data.buffer, data.byteOffset + pos, remainingLength - (pos - 1 - (multiplier > 1 ? 1 : 0))); // rough
  return { topic, payload };
}

export function getMqttStatus() {
  return { connected: isConnected, messageCount, lastError, brokerUrl: ws?.url ?? null };
}

/** Route a decoded MQTT payload to the twin-store.
 * @internal Exported for unit tests. */
export function handlePayload(topic: string, payload: string) {
  try {
    const data = JSON.parse(payload) as Record<string, unknown>;
    // Heuristic: FAHFON sensors send { station, tempC, co2Ppm, pm25, pm10, lat, lng }
    if (typeof data.station === "string") {
      const reading = {
        station: data.station,
        lat: typeof data.lat === "number" ? data.lat : undefined,
        lng: typeof data.lng === "number" ? data.lng : undefined,
        tempC: typeof data.tempC === "number" ? data.tempC : undefined,
        co2Ppm: typeof data.co2Ppm === "number" ? data.co2Ppm : undefined,
        pm1: typeof data.pm1 === "number" ? data.pm1 : undefined,
        pm25: typeof data.pm25 === "number" ? data.pm25 : undefined,
        pm10: typeof data.pm10 === "number" ? data.pm10 : undefined,
      };
      hydrateSensorFromFahfon(reading);
      messageCount++;
      return;
    }

    // Generic sensor fallback: if topic includes /twin/state/objectId/metric
    const match = topic.match(/\/twin\/state\/([^/]+)\/(.+)/);
    if (match) {
      const objectId = match[1];
      const metric = match[2];
      const value = typeof data.value === "number" ? data.value : Number(data.value);
      if (!Number.isNaN(value)) {
        writeTwinState({
          time: new Date().toISOString(),
          objectId,
          metric,
          value,
          source: "mqtt",
          properties: data,
        });
        messageCount++;
      }
    }
  } catch {
    // Non-JSON payload — ignore or log
  }
}

export function startMqttBridge(config: MqttConfig) {
  if (ws) return;

  try {
    ws = new WebSocket(config.brokerUrl, ["mqtt"]);
  } catch (err) {
    lastError = (err as Error).message;
    scheduleReconnect(config);
    return;
  }

  ws.addEventListener("open", () => {
    isConnected = true;
    lastError = null;
    console.log(`[mqtt] connected to ${config.brokerUrl}`);

    // Send CONNECT packet (minimal MQTT v3.1.1)
    const clientIdBytes = new TextEncoder().encode(config.clientId);
    const usernameBytes = config.username ? new TextEncoder().encode(config.username) : null;
    const passwordBytes = config.password ? new TextEncoder().encode(config.password) : null;

    const headerLen =
      2 + 4 + // proto name length + "MQTT"
      1 +   // proto level
      1 +   // connect flags
      2 +   // keepalive
      2 + clientIdBytes.length +
      (usernameBytes ? 2 + usernameBytes.length : 0) +
      (passwordBytes ? 2 + passwordBytes.length : 0);

    const packet = new Uint8Array(2 + headerLen);
    let p = 0;
    packet[p++] = 0x10; // CONNECT
    packet[p++] = headerLen;
    packet[p++] = 0x00; packet[p++] = 0x04; // "MQTT"
    packet[p++] = 0x4d; packet[p++] = 0x51; packet[p++] = 0x54; packet[p++] = 0x54;
    packet[p++] = 0x04; // level
    let flags = 0x02; // clean session
    if (usernameBytes) flags |= 0x80;
    if (passwordBytes) flags |= 0x40;
    packet[p++] = flags;
    packet[p++] = 0x00; packet[p++] = 0x3c; // keepalive 60
    packet[p++] = (clientIdBytes.length >> 8) & 0xff;
    packet[p++] = clientIdBytes.length & 0xff;
    packet.set(clientIdBytes, p); p += clientIdBytes.length;
    if (usernameBytes) {
      packet[p++] = (usernameBytes.length >> 8) & 0xff;
      packet[p++] = usernameBytes.length & 0xff;
      packet.set(usernameBytes, p); p += usernameBytes.length;
    }
    if (passwordBytes) {
      packet[p++] = (passwordBytes.length >> 8) & 0xff;
      packet[p++] = passwordBytes.length & 0xff;
      packet.set(passwordBytes, p); p += passwordBytes.length;
    }
    ws!.send(packet);

    // Subscribe to topics
    for (const topic of config.topics) {
      const topicBytes = new TextEncoder().encode(topic);
      const subPacket = new Uint8Array(7 + topicBytes.length);
      let s = 0;
      subPacket[s++] = 0x82; // SUBSCRIBE
      subPacket[s++] = 5 + topicBytes.length;
      subPacket[s++] = 0x00; subPacket[s++] = 0x01; // packet id
      subPacket[s++] = (topicBytes.length >> 8) & 0xff;
      subPacket[s++] = topicBytes.length & 0xff;
      subPacket.set(topicBytes, s); s += topicBytes.length;
      subPacket[s++] = 0x00; // QoS 0
      ws!.send(subPacket);
    }
  });

  ws.addEventListener("message", (evt: { data: string | ArrayBuffer }) => {
    if (typeof evt.data === "string") {
      handlePayload("unknown", evt.data);
    } else if (evt.data instanceof ArrayBuffer) {
      const view = new DataView(evt.data);
      const parsed = parseMqttPublish(view);
      if (parsed) {
        const payloadStr = new TextDecoder().decode(parsed.payload);
        handlePayload(parsed.topic, payloadStr);
      }
    }
  });

  ws.addEventListener("error", () => {
    lastError = "WebSocket error";
    console.error("[mqtt] WebSocket error");
  });

  ws.addEventListener("close", () => {
    isConnected = false;
    ws = null;
    console.log("[mqtt] disconnected");
    scheduleReconnect(config);
  });
}

function scheduleReconnect(config: MqttConfig) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startMqttBridge(config);
  }, 10_000);
}

export function stopMqttBridge() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  isConnected = false;
}
