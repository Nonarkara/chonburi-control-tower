/**
 * AIS adapter — live vessel positions from AISStream.io
 *
 * AISStream is the only fully-free real-time AIS feed (1-min latency).
 * Requires a free API key (sign up at aisstream.io). Without a key, this
 * adapter returns an empty feed with fallbackTier "unavailable".
 *
 * AISStream uses WebSockets. For the dashboard's polling pattern we cache
 * the most recent positions seen on the WS stream (kept in-memory on the
 * Node API process) and return them on each GET. On Cloudflare Workers
 * (no long-running process), this adapter is a no-op.
 */

import type { NormalizedFeed } from "@chonburi/shared";
import { cacheAgeMinutes } from "../lib/cache.js";

export interface AisVessel {
  mmsi: string;
  name: string | null;
  lat: number;
  lng: number;
  course?: number;
  speed?: number;
  type?: string;
  flag?: string;
  lastUpdate?: string;
}

// Eastern Seaboard bbox: south, west, north, east (Gulf of Thailand around Chonburi)
const BBOX: [number, number, number, number] = [12.5, 100.5, 13.6, 101.3];

// In-memory store of latest position per MMSI (Node only)
const positions = new Map<string, AisVessel>();
let wsConnected = false;
let wsStartedAt: number | null = null;
let retryDelay = 2_000;
const MAX_RETRY_DELAY = 60_000;

interface ShipStaticMessage {
  ShipName?: string;
  ShipType?: number;
  CallSign?: string;
}
interface PositionMessage {
  Latitude?: number;
  Longitude?: number;
  Cog?: number;
  Sog?: number;
}
interface AisMessage {
  Message?: {
    PositionReport?: PositionMessage;
    StandardClassBPositionReport?: PositionMessage;
    ExtendedClassBPositionReport?: PositionMessage;
    ShipStaticData?: ShipStaticMessage;
  };
  MetaData?: {
    MMSI?: number;
    ShipName?: string;
    time_utc?: string;
    latitude?: number;
    longitude?: number;
  };
}

// AISStream ship type codes (subset)
function shipType(code: number | undefined): string {
  if (code == null) return "unknown";
  if (code >= 60 && code <= 69) return "passenger";
  if (code >= 70 && code <= 79) return "cargo";
  if (code >= 80 && code <= 89) return "tanker";
  if (code === 30) return "fishing";
  if (code >= 36 && code <= 37) return "pleasure";
  if (code === 31 || code === 32 || code === 52) return "tug";
  return "unknown";
}

export function startAisStream(token: string): void {
  if (typeof process === "undefined" || !process.versions?.node) return;
  if (wsConnected) return;

  import("ws").then(({ default: WebSocket }) => {
    const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
    wsStartedAt = Date.now();

    ws.on("open", () => {
      wsConnected = true;
      retryDelay = 2_000; // reset on successful connection
      const subscribe = {
        APIKey: token,
        BoundingBoxes: [[[BBOX[0], BBOX[1]], [BBOX[2], BBOX[3]]]],
        FilterMessageTypes: ["PositionReport", "StandardClassBPositionReport", "ShipStaticData"],
      };
      ws.send(JSON.stringify(subscribe));
      console.log("[ais] connected to AISStream, bbox", BBOX);
    });

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as AisMessage;
        const mmsi = msg.MetaData?.MMSI?.toString();
        if (!mmsi) return;

        const pos =
          msg.Message?.PositionReport ??
          msg.Message?.StandardClassBPositionReport ??
          msg.Message?.ExtendedClassBPositionReport;

        const existing = positions.get(mmsi);
        const lat = pos?.Latitude ?? msg.MetaData?.latitude ?? existing?.lat;
        const lng = pos?.Longitude ?? msg.MetaData?.longitude ?? existing?.lng;
        if (lat == null || lng == null) return;

        positions.set(mmsi, {
          mmsi,
          name: msg.MetaData?.ShipName?.trim() || msg.Message?.ShipStaticData?.ShipName?.trim() || existing?.name || null,
          lat,
          lng,
          course: pos?.Cog ?? existing?.course,
          speed: pos?.Sog ?? existing?.speed,
          type: msg.Message?.ShipStaticData ? shipType(msg.Message.ShipStaticData.ShipType) : existing?.type,
          lastUpdate: msg.MetaData?.time_utc ?? existing?.lastUpdate ?? new Date().toISOString(),
        });
      } catch {
        // ignore parse errors
      }
    });

    ws.on("close", () => {
      wsConnected = false;
      console.log(`[ais] WS closed — reconnecting in ${retryDelay / 1000}s`);
      setTimeout(() => startAisStream(token), retryDelay);
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
    });

    ws.on("error", (err: Error) => {
      console.error("[ais] WS error:", err.message);
    });
  }).catch((err) => {
    console.error("[ais] failed to load ws module:", err.message);
  });
}

// Drop vessels older than 30 min (probably out of bbox or AIS off)
function pruneStale(): void {
  const cutoff = Date.now() - 30 * 60_000;
  for (const [mmsi, v] of positions) {
    const t = v.lastUpdate ? new Date(v.lastUpdate).getTime() : 0;
    if (t < cutoff) positions.delete(mmsi);
  }
}

export function fetchAisVessels(): NormalizedFeed<AisVessel> {
  pruneStale();
  const features = Array.from(positions.values()).slice(0, 500);
  const fetchedAt = new Date().toISOString();
  return {
    features,
    meta: {
      source: "aisstream.io",
      fetchedAt,
      ageMinutes: wsStartedAt ? Math.floor((Date.now() - wsStartedAt) / 60_000) : 0,
      fallbackTier: wsConnected && features.length > 0 ? "live" : "unavailable",
    },
  };
}

export function aisStatus(): { connected: boolean; count: number; uptimeSec: number } {
  return {
    connected: wsConnected,
    count: positions.size,
    uptimeSec: wsStartedAt ? Math.floor((Date.now() - wsStartedAt) / 1000) : 0,
  };
}
