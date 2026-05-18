/**
 * Precipitation nowcast — 2-hour 15-min-interval rain forecast for the
 * campus centroid. Bangkok afternoon downpours are the #1 disruptor of
 * outdoor events and shuttle timing; this surfaces the next rain pulse
 * so leadership can re-time events or pre-position umbrellas.
 *
 * Source: Open-Meteo `minutely_15=precipitation,precipitation_probability`.
 * Free, no key, 15-min interval, ~24 h horizon (we only need 2 h).
 */

import type { NormalizedFeed, PrecipNowcast } from "@chonburi/shared";
import { CHONBURI } from "@chonburi/shared";
import { cacheAgeMinutes, cached } from "../lib/cache.js";
import { fetchJsonOrNull } from "./common.js";

const TTL_SECONDS = 1800; // 30min // 10 min — nowcasts update fast

interface OpenMeteoMinutely {
  minutely_15?: {
    time?: string[];
    precipitation?: number[];
    precipitation_probability?: number[];
  };
}

const POINTS_IN_2H = 8; // 8 × 15 min

export async function fetchPrecipNowcast(): Promise<NormalizedFeed<PrecipNowcast>> {
  return cached("precip-nowcast", TTL_SECONDS, async () => {
    const fetchedAt = new Date().toISOString();
    const [lng, lat] = CHONBURI.center;
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&minutely_15=precipitation,precipitation_probability` +
      `&timezone=Asia%2FBangkok&forecast_minutely_15=24`;
    const payload = await fetchJsonOrNull<OpenMeteoMinutely>(url);
    const series = payload?.minutely_15;
    if (!series?.time || !series.precipitation) {
      return {
        features: [],
        meta: {
          source: "open-meteo-minutely",
          fetchedAt,
          ageMinutes: 0,
          fallbackTier: "unavailable" as const,
        },
      };
    }

    const nowMs = Date.now();
    const upcoming: { at: string; mm: number; prob: number }[] = [];
    for (let i = 0; i < series.time.length && upcoming.length < POINTS_IN_2H; i++) {
      const at = series.time[i];
      const ts = new Date(at + "+07:00").getTime();
      if (Number.isNaN(ts) || ts < nowMs - 15 * 60_000) continue;
      upcoming.push({
        at,
        mm: series.precipitation[i] ?? 0,
        prob: series.precipitation_probability?.[i] ?? 0,
      });
    }

    let totalMm = 0;
    let peakMm = 0;
    let peakAt: string | null = null;
    let firstSignificantAt: string | null = null;
    let minutesToSignificant: number | null = null;
    const SIGNIFICANT_MM = 0.5;

    for (let i = 0; i < upcoming.length; i++) {
      const p = upcoming[i];
      totalMm += p.mm;
      if (p.mm > peakMm) {
        peakMm = p.mm;
        peakAt = p.at;
      }
      if (firstSignificantAt == null && p.mm >= SIGNIFICANT_MM) {
        firstSignificantAt = p.at;
        minutesToSignificant = (i + 1) * 15 - 15;
      }
    }

    const intensity: PrecipNowcast["intensity"] =
      peakMm >= 5 ? "heavy" : peakMm >= 1 ? "moderate" : peakMm >= 0.1 ? "light" : "dry";

    const snapshot: PrecipNowcast = {
      nowMm: upcoming[0]?.mm ?? 0,
      total2hMm: Math.round(totalMm * 10) / 10,
      peakMm: Math.round(peakMm * 10) / 10,
      peakAt,
      firstSignificantAt,
      minutesToSignificant,
      intensity,
      points: upcoming,
    };

    return {
      features: [snapshot],
      meta: {
        source: "open-meteo-minutely",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: "live" as const,
      },
    };
  });
}
