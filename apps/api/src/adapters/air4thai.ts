/**
 * Air4Thai — the Thai Pollution Control Department's official national air
 * quality network. Public, no API key required.
 *
 * This is the authoritative ground-truth AQ source for Thailand (AQICN and
 * Open-Meteo both re-publish a subset of it). It carries real PCD monitoring
 * stations across the Eastern Seaboard — Chonburi (Laem Chabang, Si Racha /
 * Bo Win, Mueang Chon Buri) plus the neighbouring Rayong / Map Ta Phut
 * industrial belt — so the dashboard shows the actual government sensors for
 * this part of Thailand, not a grid estimate.
 *
 * Endpoint returns ~186 nationwide stations; we keep only the Eastern-Seaboard
 * ones (Chonburi province name match OR inside the Eastern-Seaboard bbox,
 * which spans Chonburi → Rayong).
 *
 * No key, no fallback-to-unavailable needed — if upstream is down we return an
 * empty "scenario" feed and the caller keeps last-good cache.
 */

import type { AirQualityPoint, NormalizedFeed } from "@chonburi/shared";
import { cacheAgeMinutes, cachedWithStale as cached } from "../lib/cache.js";
import { inBbox } from "../lib/bbox.js";
import { fetchJsonOrThrow } from "./common.js";

const ENDPOINT = "http://air4thai.pcd.go.th/services/getNewAQI_JSON.php";

const TTL_SECONDS = 1800; // 30 min — PCD stations report hourly

interface Air4ThaiPollutant {
  color_id?: string;
  aqi?: string;
  value?: string;
}

interface Air4ThaiStation {
  stationID?: string;
  nameEN?: string;
  nameTH?: string;
  areaEN?: string;
  areaTH?: string;
  lat?: string;
  long?: string;
  AQILast?: {
    date?: string;
    time?: string;
    PM25?: Air4ThaiPollutant;
    AQI?: Air4ThaiPollutant;
  };
}

interface Air4ThaiResp {
  stations?: Air4ThaiStation[];
}

/** Air4Thai reports "-1" / "-" for missing readings; coerce to null. */
function num(raw?: string): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Map PM2.5 (µg/m³) to the dashboard's US-EPA category bands so Air4Thai points
 * share the same colour semantics as the Open-Meteo / AQICN feeds. (Air4Thai's
 * own AQI uses the Thai national scale, which differs — PM2.5 is the universal
 * comparator.) US EPA 24-hour PM2.5 breakpoints.
 */
function pm25Category(pm25: number | null): AirQualityPoint["category"] {
  if (pm25 == null) return null;
  if (pm25 <= 12) return "good";
  if (pm25 <= 35.4) return "moderate";
  if (pm25 <= 55.4) return "unhealthy-sg";
  if (pm25 <= 150.4) return "unhealthy";
  if (pm25 <= 250.4) return "very-unhealthy";
  return "hazardous";
}

function inEasternSeaboard(s: Air4ThaiStation, lng: number, lat: number): boolean {
  const area = `${s.areaEN ?? ""} ${s.areaTH ?? ""}`.toLowerCase();
  if (area.includes("chon buri") || area.includes("chonburi") || area.includes("ชลบุรี")) return true;
  return inBbox(lng, lat);
}

function observedAt(s: Air4ThaiStation, fallback: string): string {
  const d = s.AQILast?.date;
  const t = s.AQILast?.time;
  if (d && t) return `${d}T${t}:00+07:00`;
  return fallback;
}

export async function fetchAir4Thai(): Promise<NormalizedFeed<AirQualityPoint>> {
  return cached("air4thai-chonburi", TTL_SECONDS, async () => {
    const fetchedAt = new Date().toISOString();
    const payload = await fetchJsonOrThrow<Air4ThaiResp>(ENDPOINT);
    const stations = payload?.stations ?? [];

    const features: AirQualityPoint[] = [];
    for (const s of stations) {
      const lat = Number(s.lat);
      const lng = Number(s.long);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) continue;
      if (!inEasternSeaboard(s, lng, lat)) continue;

      const pm25 = num(s.AQILast?.PM25?.value);
      features.push({
        lat,
        lng,
        station: s.nameEN || s.nameTH || `Air4Thai ${s.stationID ?? "station"}`,
        aqi: num(s.AQILast?.AQI?.aqi),
        pm25,
        category: pm25Category(pm25),
        observedAt: observedAt(s, fetchedAt),
        source: `air4thai:${s.stationID ?? "?"}`,
      });
    }

    return {
      features,
      meta: {
        source: "air4thai-pcd",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: features.length > 0 ? "live" : "scenario",
      },
    };
  });
}
