/**
 * NASA POWER API adapter — satellite-derived climate readings at Chonburi centroid.
 *
 * Source: NASA Prediction Of Worldwide Energy Resources (POWER) v2.5
 *   https://power.larc.nasa.gov/
 *   Backed by MERRA-2 reanalysis + satellite observations (CERES, MODIS, etc.)
 *   No API key required. Publication latency: ~3 days.
 *
 * Parameters fetched:
 *   T2M              — Temperature at 2 m (°C)
 *   PRECTOTCORR      — Corrected total precipitation (mm/day)
 *   ALLSKY_SFC_SW_DWN — All-sky insolation incident on horizontal surface (MJ/m²/day)
 *   ALLSKY_KT        — Clearness index (0–1, ratio of surface to top-of-atmosphere solar)
 *
 * Fill value: NASA uses -999 for missing/unavailable data → mapped to null.
 */

import type { NasaEarthReadings, NormalizedFeed } from "@chonburi/shared";
import { CHONBURI } from "@chonburi/shared";
import { cacheAgeMinutes, cachedWithStale as cached } from "../lib/cache.js";
import { fetchJsonOrThrow } from "./common.js";

const TTL_SECONDS = 21_600; // 6 hours — data changes daily, 3-day latency

const NASA_FILL = -999;

interface NasaPowerResponse {
  properties?: {
    parameter?: {
      T2M?: Record<string, number>;
      PRECTOTCORR?: Record<string, number>;
      ALLSKY_SFC_SW_DWN?: Record<string, number>;
      ALLSKY_KT?: Record<string, number>;
    };
  };
}

/** Format a Date as YYYYMMDD for NASA POWER API. */
function yyyymmdd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}

/** Sentinel check — return null for NASA fill values. */
function clean(v: number | undefined): number | null {
  if (v == null || v === NASA_FILL || v <= -990) return null;
  return v;
}

/** Pick the most-recent non-null value from a date-keyed record. */
function latest(rec: Record<string, number> | undefined): number | null {
  if (!rec) return null;
  const entries = Object.entries(rec).sort(([a], [b]) => b.localeCompare(a));
  for (const [, v] of entries) {
    const c = clean(v);
    if (c !== null) return c;
  }
  return null;
}

/** Pick the date key of the most-recent non-null value. */
function latestDate(rec: Record<string, number> | undefined): string {
  if (!rec) return "unknown";
  const entries = Object.entries(rec).sort(([a], [b]) => b.localeCompare(a));
  for (const [date, v] of entries) {
    if (clean(v) !== null) return date;
  }
  return "unknown";
}

export async function fetchNasaEarth(): Promise<NormalizedFeed<NasaEarthReadings>> {
  return cached("nasa-power-earth", TTL_SECONDS, async () => {
    const fetchedAt = new Date().toISOString();
    const [lng, lat] = CHONBURI.center;

    // Query d-4 through d-3 to guarantee we land within the ~3-day publication window
    const now = new Date();
    const d3 = new Date(now);
    d3.setUTCDate(now.getUTCDate() - 3);
    const d4 = new Date(now);
    d4.setUTCDate(now.getUTCDate() - 4);

    const url =
      `https://power.larc.nasa.gov/api/temporal/daily/point` +
      `?parameters=T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,ALLSKY_KT` +
      `&community=RE` +
      `&longitude=${lng}&latitude=${lat}` +
      `&start=${yyyymmdd(d4)}&end=${yyyymmdd(d3)}` +
      `&format=JSON`;

    const payload = await fetchJsonOrThrow<NasaPowerResponse>(url);
    const params = payload?.properties?.parameter;

    const tempC = latest(params?.T2M);
    const precipMmDay = latest(params?.PRECTOTCORR);
    const solarMJm2 = latest(params?.ALLSKY_SFC_SW_DWN);
    const solarKWhm2 = solarMJm2 != null ? Math.round((solarMJm2 / 3.6) * 10) / 10 : null;
    const clearnessIndex = latest(params?.ALLSKY_KT);
    const dataDate = latestDate(params?.T2M ?? params?.PRECTOTCORR);

    const reading: NasaEarthReadings = {
      tempC: tempC != null ? Math.round(tempC * 10) / 10 : null,
      precipMmDay: precipMmDay != null ? Math.round(precipMmDay * 10) / 10 : null,
      solarMJm2: solarMJm2 != null ? Math.round(solarMJm2 * 10) / 10 : null,
      solarKWhm2,
      clearnessIndex: clearnessIndex != null ? Math.round(clearnessIndex * 100) / 100 : null,
      dataDate,
      source: "nasa-power-merra2",
    };

    return {
      features: [reading],
      meta: {
        source: "nasa-power-merra2",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: params ? ("live" as const) : ("unavailable" as const),
        ...(params ? {} : { note: "NASA POWER API returned no parameters — endpoint may be in maintenance" }),
      },
    };
  });
}
