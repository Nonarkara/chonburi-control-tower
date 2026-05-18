/**
 * AQICN (World Air Quality Index Project) — authoritative real-time AQ.
 * Aggregates PCD + BMA + US-embassy + research monitors into a single API.
 *
 * To activate:
 *   1. Register a free token at https://aqicn.org/data-platform/token
 *   2. Set AQICN_TOKEN in the API env
 *
 * Returns null if no token is configured OR upstream returns no data —
 * caller can fall back to Open-Meteo or scenario data.
 *
 * Two query modes:
 *   - byGeo(lat, lng)       → nearest station to a point (used for Chula campus)
 *   - byStation(stationId)  → exact station by AQICN station id (e.g. "@5774")
 */

import { fetchJsonOrNull } from "./common.js";

export interface AqicnStation {
  station: string;        // human name
  stationUrl: string;     // canonical AQICN URL
  aqi: number | null;     // US AQI
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  observedAt: string;     // ISO
  lat: number;
  lng: number;
}

interface AqicnResp {
  status: "ok" | "error" | "nug";
  data?: {
    aqi?: number;
    idx?: number;
    city?: { name?: string; url?: string; geo?: [number, number] };
    iaqi?: {
      pm25?: { v: number };
      pm10?: { v: number };
      no2?: { v: number };
      o3?: { v: number };
    };
    time?: { iso?: string };
  };
}

function map(p: AqicnResp): AqicnStation | null {
  if (p.status !== "ok" || !p.data) return null;
  const d = p.data;
  const geo = d.city?.geo ?? [0, 0];
  return {
    station: d.city?.name ?? "Unknown",
    stationUrl: d.city?.url ?? "",
    aqi: typeof d.aqi === "number" ? d.aqi : null,
    pm25: d.iaqi?.pm25?.v ?? null,
    pm10: d.iaqi?.pm10?.v ?? null,
    no2: d.iaqi?.no2?.v ?? null,
    o3: d.iaqi?.o3?.v ?? null,
    observedAt: d.time?.iso ?? new Date().toISOString(),
    lat: geo[0],
    lng: geo[1],
  };
}

export async function fetchAqicnByGeo(
  env: { AQICN_TOKEN?: string },
  lat: number,
  lng: number,
): Promise<AqicnStation | null> {
  const token = env.AQICN_TOKEN;
  if (!token) return null;
  const url = `https://api.waqi.info/feed/geo:${lat};${lng}/?token=${encodeURIComponent(token)}`;
  const payload = await fetchJsonOrNull<AqicnResp>(url);
  return payload ? map(payload) : null;
}

export async function fetchAqicnByStation(
  env: { AQICN_TOKEN?: string },
  stationId: string,
): Promise<AqicnStation | null> {
  const token = env.AQICN_TOKEN;
  if (!token) return null;
  // station id can be "@1234" or a slug like "bangkok"
  const id = stationId.startsWith("@") ? stationId : `@${stationId.replace(/^@/, "")}`;
  const url = `https://api.waqi.info/feed/${id}/?token=${encodeURIComponent(token)}`;
  const payload = await fetchJsonOrNull<AqicnResp>(url);
  return payload ? map(payload) : null;
}
