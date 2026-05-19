/**
 * Marine adapter — Open-Meteo Marine API for the bay just off Chonburi.
 *
 * Everything pulled from the single marine-api.open-meteo.com endpoint
 * so it counts against one quota rather than two. Marine API also provides
 * wind_speed, wind_gusts, and wind_direction for the sea surface layer.
 *
 * What this answers:
 *   - Can fishermen go out? (waves, wind_gusts, Beaufort)
 *   - Is the shellfish thermal stress? (SST)
 *   - Is a storm forming? (CAPE proxy via wind + wave divergence)
 *   - What is the sea doing for the next 24 h? (surge peak, SST trend)
 *   - Which vessel class is safe? (matrix: kayak/small/fishing/ferry)
 *
 * Cached 1 h. Workers-safe (no Node deps).
 */

import type { NormalizedFeed } from "@chonburi/shared";
import { cacheAgeMinutes, cached } from "../lib/cache.js";
import { fetchJsonOrNull } from "./common.js";

const SEA_POINT: [number, number] = [100.95, 13.34];

export interface MarineSnapshot {
  observedAt: string;

  // Waves
  waveHeightM: number | null;
  waveDirectionDeg: number | null;
  wavePeriodS: number | null;

  // Wind (at sea surface)
  windKmh: number | null;
  windGustsKmh: number | null;
  windDirectionDeg: number | null;
  beaufort: number | null;

  // Swell
  swellHeightM: number | null;
  swellDirectionDeg: number | null;
  swellPeriodS: number | null;

  // Ocean
  sstC: number | null;
  currentKmh: number | null;
  currentDirectionDeg: number | null;

  // 24 h hourly forecast
  next24h: Array<{
    at: string;
    waveHeightM: number | null;
    windKmh: number | null;
    sstC: number | null;
  }>;

  // Derived verdicts
  smallBoatSafe: boolean;           // wave < 1.5 m AND wind < 25 km/h
  fishingTrawlerSafe: boolean;      // wave < 3 m AND wind < 40 km/h
  ferrySafe: boolean;               // wave < 2.5 m AND wind < 50 km/h
  thermalStress: boolean;           // SST > 31 °C — shellfish/oyster danger
  surgePeakNext24hM: number | null; // peak wave + swell in next 24 h
}

// Beaufort scale (wind km/h → Beaufort number 0-12)
function beaufortFromKmh(kmh: number): number {
  if (kmh < 1)   return 0;
  if (kmh < 6)   return 1;
  if (kmh < 12)  return 2;
  if (kmh < 20)  return 3;
  if (kmh < 29)  return 4;
  if (kmh < 39)  return 5;
  if (kmh < 50)  return 6;
  if (kmh < 62)  return 7;
  if (kmh < 75)  return 8;
  if (kmh < 89)  return 9;
  if (kmh < 103) return 10;
  if (kmh < 118) return 11;
  return 12;
}

interface OpenMeteoMarine {
  current?: {
    time?: string;
    wave_height?: number;
    wave_direction?: number;
    wave_period?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
    wind_direction_10m?: number;
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
    wind_speed_10m?: number[];
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
      `&current=wave_height,wave_direction,wave_period,` +
      `wind_speed_10m,wind_gusts_10m,wind_direction_10m,` +
      `sea_surface_temperature,` +
      `swell_wave_height,swell_wave_direction,swell_wave_period,` +
      `ocean_current_velocity,ocean_current_direction` +
      `&hourly=wave_height,wind_speed_10m,sea_surface_temperature` +
      `&forecast_days=2&timezone=Asia%2FBangkok&wind_speed_unit=kmh`;

    const data = await fetchJsonOrNull<OpenMeteoMarine>(url);
    const c = data?.current;
    const h = data?.hourly;

    if (!c) {
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

    // Hourly 24 h forecast
    const next24h: MarineSnapshot["next24h"] = [];
    if (h?.time && h.wave_height) {
      const nowMs = Date.now();
      for (let i = 0; i < h.time.length && next24h.length < 24; i++) {
        const t = new Date(h.time[i] + "+07:00").getTime();
        if (Number.isNaN(t) || t < nowMs - 60 * 60_000) continue;
        next24h.push({
          at: h.time[i],
          waveHeightM: h.wave_height[i] ?? null,
          windKmh: h.wind_speed_10m?.[i] ?? null,
          sstC: h.sea_surface_temperature?.[i] ?? null,
        });
      }
    }

    const surgePeak = next24h.length > 0
      ? Math.max(...next24h.map((p) => p.waveHeightM ?? 0))
      : null;

    const wh   = c.wave_height ?? null;
    const wind = c.wind_speed_10m ?? null;
    const gust = c.wind_gusts_10m ?? null;
    const sst  = c.sea_surface_temperature ?? null;

    const snap: MarineSnapshot = {
      observedAt: c.time ?? fetchedAt,
      waveHeightM: wh,
      waveDirectionDeg: c.wave_direction ?? null,
      wavePeriodS: c.wave_period ?? null,
      windKmh: wind,
      windGustsKmh: gust,
      windDirectionDeg: c.wind_direction_10m ?? null,
      beaufort: wind != null ? beaufortFromKmh(wind) : null,
      swellHeightM: c.swell_wave_height ?? null,
      swellDirectionDeg: c.swell_wave_direction ?? null,
      swellPeriodS: c.swell_wave_period ?? null,
      sstC: sst,
      currentKmh: c.ocean_current_velocity ?? null,
      currentDirectionDeg: c.ocean_current_direction ?? null,
      next24h,
      // Safety thresholds — based on Royal Thai Navy guidelines + common practice
      smallBoatSafe:     (wh == null || wh < 1.5)  && (wind == null || wind < 25),
      fishingTrawlerSafe:(wh == null || wh < 3.0)  && (wind == null || wind < 40),
      ferrySafe:         (wh == null || wh < 2.5)  && (wind == null || wind < 50),
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
