import type { AirQualityPoint, NormalizedFeed } from "@chonburi/shared";
import { CHONBURI } from "@chonburi/shared";
import { cacheAgeMinutes, cachedWithStale as cached } from "../lib/cache.js";
import { fetchJsonOrNull } from "./common.js";

const TTL_SECONDS = 3600; // 1h // 15 min

interface OpenMeteoAQ {
  current?: {
    time?: string;
    us_aqi?: number;
    pm2_5?: number;
    pm10?: number;
  };
  hourly?: {
    time?: string[];
    us_aqi?: number[];
    pm2_5?: number[];
  };
}

export interface AirQualityTrend {
  station: string;
  category: AirQualityPoint["category"];
  current: { aqi: number | null; pm25: number | null; observedAt: string };
  next8h: Array<{ at: string; aqi: number | null; pm25: number | null }>;
  source: string;
}

function aqiCategory(aqi: number): AirQualityPoint["category"] {
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "moderate";
  if (aqi <= 150) return "unhealthy-sg";
  if (aqi <= 200) return "unhealthy";
  if (aqi <= 300) return "very-unhealthy";
  return "hazardous";
}

export async function fetchAirQuality(): Promise<NormalizedFeed<AirQualityPoint>> {
  return cached("air-quality", TTL_SECONDS, async () => {
    const fetchedAt = new Date().toISOString();
    const [lng, lat] = CHONBURI.center;
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm2_5,pm10&hourly=us_aqi,pm2_5&forecast_hours=8&timezone=Asia%2FBangkok`;
    const payload = await fetchJsonOrNull<OpenMeteoAQ>(url);
    const c = payload?.current;
    const features: AirQualityPoint[] = c
      ? [{
          lat,
          lng,
          station: "Chonburi Town (Open-Meteo grid)",
          aqi: c.us_aqi ?? null,
          pm25: c.pm2_5 ?? null,
          category: c.us_aqi != null ? aqiCategory(c.us_aqi) : null,
          observedAt: c.time ?? fetchedAt,
          source: "open-meteo-air-quality",
        }]
      : [];

    return {
      features,
      meta: {
        source: "open-meteo-air-quality",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: features.length > 0 ? "live" : "scenario",
      },
    };
  });
}

export async function fetchAirQualityTrend(): Promise<NormalizedFeed<AirQualityTrend>> {
  return cached("air-quality-trend", TTL_SECONDS, async () => {
    const fetchedAt = new Date().toISOString();
    const [lng, lat] = CHONBURI.center;
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm2_5&hourly=us_aqi,pm2_5&forecast_hours=8&timezone=Asia%2FBangkok`;
    const payload = await fetchJsonOrNull<OpenMeteoAQ>(url);
    const c = payload?.current;
    const h = payload?.hourly;
    if (!c) {
      return {
        features: [],
        meta: { source: "open-meteo-air-quality-trend", fetchedAt, ageMinutes: 0, fallbackTier: "scenario" as const },
      };
    }
    const next8h: AirQualityTrend["next8h"] = [];
    if (h?.time && h.us_aqi && h.pm2_5) {
      for (let i = 0; i < Math.min(8, h.time.length); i++) {
        next8h.push({
          at: h.time[i],
          aqi: h.us_aqi[i] ?? null,
          pm25: h.pm2_5[i] ?? null,
        });
      }
    }
    const trend: AirQualityTrend = {
      station: "Chonburi Town (Open-Meteo grid)",
      category: aqiCategory(c.us_aqi ?? 0),
      current: { aqi: c.us_aqi ?? null, pm25: c.pm2_5 ?? null, observedAt: c.time ?? fetchedAt },
      next8h,
      source: "open-meteo-air-quality",
    };
    return {
      features: [trend],
      meta: {
        source: "open-meteo-air-quality-trend",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: "live" as const,
      },
    };
  });
}
