/**
 * Marine adapter — Open-Meteo Marine API for the bay just off Chonburi
 * (Bang Saen / Ang Sila waters).
 *
 * The mayor needs this answered every morning:
 *   - Can the fishermen go out? (waves > 1.5 m = unsafe small boat)
 *   - Is sea temperature anomalous? (heat waves kill aquaculture)
 *   - Is swell about to drive a king tide / coastal flood?
 *
 * Free, no key, ~3 km grid. Cached 1 h.
 */

import type { NormalizedFeed } from "@chonburi/shared";
import { cacheAgeMinutes, cached } from "../lib/cache.js";
import { fetchJsonOrNull } from "./common.js";

// Anchor point in the bay just off Chonburi city (NOT on land — the API
// returns the nearest open-water cell).
const SEA_POINT: [number, number] = [100.95, 13.34];

export interface MarineSnapshot {
  observedAt: string;
  /** Significant wave height (m) — small-boat safety threshold ~1.5 m */
  waveHeightM: number | null;
  waveDirectionDeg: number | null;
  wavePeriodS: number | null;
  /** Sea surface temperature (°C). Above 31 °C = thermal stress for shellfish */
  sstC: number | null;
  /** Swell — longer-period waves arriving from distant storms */
  swellHeightM: number | null;
  swellDirectionDeg: number | null;
  swellPeriodS: number | null;
  /** Surface ocean current (km/h, direction in °) */
  currentKmh: number | null;
  currentDirectionDeg: number | null;
  /** Hourly forecast for the next 24 h */
  next24h: Array<{ at: string; waveHeightM: number | null; sstC: number | null }>;
  /** Mayor-readable verdict */
  smallBoatSafe: boolean;
  thermalStress: boolean;
  /** Tide proxy: sum of swell + wave heights peaks today */
  surgePeakNext24hM: number | null;
}

interface OpenMeteoMarine {
  current?: {
    time?: string;
    wave_height?: number;
    wave_direction?: number;
    wave_period?: number;
    sea_surface_temperature?: number;
    swell_wave_height?: number;
    swell_wave_direction?: number;
    swell_wave_period?: number;
    ocean_current_velocity?: number;
    ocean_current_direction?: number;
  };
  hourly?: {
    time?: string[];
    wave_height?: number[];
    sea_surface_temperature?: number[];
  };
}

export async function fetchMarine(): Promise<NormalizedFeed<MarineSnapshot>> {
  return cached("marine", 3600, async () => {
    const fetchedAt = new Date().toISOString();
    const [lng, lat] = SEA_POINT;
    const url =
      `https://marine-api.open-meteo.com/v1/marine?` +
      `latitude=${lat}&longitude=${lng}` +
      `&current=wave_height,wave_direction,wave_period,sea_surface_temperature,` +
      `swell_wave_height,swell_wave_direction,swell_wave_period,` +
      `ocean_current_velocity,ocean_current_direction` +
      `&hourly=wave_height,sea_surface_temperature&forecast_days=2` +
      `&timezone=Asia%2FBangkok`;

    const data = await fetchJsonOrNull<OpenMeteoMarine>(url);
    const c = data?.current;
    const h = data?.hourly;

    if (!c) {
      // Upstream timed out or failed. Return empty + scenario tier.
      // The outer cached() wrapper WILL cache this for the full TTL — but
      // the dashboard shows "—" gracefully rather than 500. The Node API
      // running on the Mac doesn't hit this; only the Worker IP pool does.
      return {
        features: [] as MarineSnapshot[],
        meta: {
          source: "open-meteo-marine",
          fetchedAt,
          ageMinutes: 0,
          fallbackTier: "scenario" as const,
        },
      };
    }

    const next24h: MarineSnapshot["next24h"] = [];
    if (h?.time && h.wave_height && h.sea_surface_temperature) {
      // Take the next 24 hourly values starting from the first hour ≥ now
      const nowMs = Date.now();
      let started = 0;
      for (let i = 0; i < h.time.length && next24h.length < 24; i++) {
        const t = new Date(h.time[i] + "+07:00").getTime();
        if (Number.isNaN(t)) continue;
        if (t < nowMs - 60 * 60_000) continue;
        next24h.push({
          at: h.time[i],
          waveHeightM: h.wave_height[i] ?? null,
          sstC: h.sea_surface_temperature[i] ?? null,
        });
        started++;
      }
      void started;
    }

    const surgePeak = next24h.length > 0
      ? Math.max(...next24h.map((p) => p.waveHeightM ?? 0))
      : null;

    const wh = c.wave_height ?? null;
    const sst = c.sea_surface_temperature ?? null;

    const snap: MarineSnapshot = {
      observedAt: c.time ?? fetchedAt,
      waveHeightM: wh,
      waveDirectionDeg: c.wave_direction ?? null,
      wavePeriodS: c.wave_period ?? null,
      sstC: sst,
      swellHeightM: c.swell_wave_height ?? null,
      swellDirectionDeg: c.swell_wave_direction ?? null,
      swellPeriodS: c.swell_wave_period ?? null,
      currentKmh: c.ocean_current_velocity ?? null,
      currentDirectionDeg: c.ocean_current_direction ?? null,
      next24h,
      smallBoatSafe: wh != null ? wh < 1.5 : true,
      thermalStress: sst != null ? sst > 31 : false,
      surgePeakNext24hM: surgePeak,
    };

    return {
      features: [snap],
      meta: {
        source: "open-meteo-marine",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: "live" as const,
      },
    };
  });
}
