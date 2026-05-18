import { useEffect, useRef, useState } from "react";

export interface CityRef {
  id: string;
  city: string;       // display name (EN)
  countryShort: string;
  tz: string;         // IANA zone, e.g. "Asia/Bangkok"
  lat: number;
  lng: number;
}

/**
 * Partner cities the dashboard surfaces.
 * Order matters — Bangkok is always first (host), then ASEAN/East-Asia partners,
 * then EU, then US (East then West).
 */
export const PARTNER_CITIES: CityRef[] = [
  { id: "bkk", city: "Bangkok",   countryShort: "TH", tz: "Asia/Bangkok",       lat: 13.7395, lng: 100.5328 },
  { id: "sgp", city: "Singapore", countryShort: "SG", tz: "Asia/Singapore",     lat: 1.3521,  lng: 103.8198 },
  { id: "tok", city: "Tokyo",     countryShort: "JP", tz: "Asia/Tokyo",         lat: 35.6762, lng: 139.6503 },
  { id: "sha", city: "Shanghai",  countryShort: "CN", tz: "Asia/Shanghai",      lat: 31.2304, lng: 121.4737 },
  { id: "ber", city: "Berlin",    countryShort: "DE", tz: "Europe/Berlin",      lat: 52.5200, lng: 13.4050  },
  { id: "bos", city: "Boston",    countryShort: "US", tz: "America/New_York",   lat: 42.3601, lng: -71.0589 },
  { id: "sfo", city: "San Francisco", countryShort: "US", tz: "America/Los_Angeles", lat: 37.7749, lng: -122.4194 },
];

export interface CityWeather {
  city: CityRef;
  // current
  tempC: number | null;
  apparentTempC: number | null;
  humidity: number | null;
  rainNow: number | null;   // mm in current hour
  windKmh: number | null;
  windDeg: number | null;
  uv: number | null;
  cloudPct: number | null;
  pressurehPa: number | null;
  visKm: number | null;
  isDay: boolean | null;
  condition: string;
  sunrise: string | null;
  sunset: string | null;
  // 5-day forecast
  daily: Array<{
    date: string;          // YYYY-MM-DD
    tempMaxC: number;
    tempMinC: number;
    precipMm: number;
    precipProb: number;    // 0..100
  }>;
  fetchedAt: string;
}

interface OpenMeteoResp {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    uv_index?: number;
    cloud_cover?: number;
    pressure_msl?: number;
    visibility?: number;
    is_day?: number;
    weather_code?: number;
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
}

const WEATHER_CODE: Record<number, string> = {
  0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog", 51: "Light drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 80: "Showers", 95: "Thunderstorm",
};

async function fetchOne(c: CityRef, signal?: AbortSignal): Promise<CityWeather | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,` +
    `wind_speed_10m,wind_direction_10m,uv_index,cloud_cover,pressure_msl,visibility,is_day,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset` +
    `&forecast_days=5&timezone=auto`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const p = (await res.json()) as OpenMeteoResp;
    const cur = p.current ?? {};
    const d = p.daily ?? {};
    const days = (d.time ?? []).map((t, i) => ({
      date: t,
      tempMaxC: d.temperature_2m_max?.[i] ?? 0,
      tempMinC: d.temperature_2m_min?.[i] ?? 0,
      precipMm: d.precipitation_sum?.[i] ?? 0,
      precipProb: d.precipitation_probability_max?.[i] ?? 0,
    }));
    return {
      city: c,
      tempC: cur.temperature_2m ?? null,
      apparentTempC: cur.apparent_temperature ?? null,
      humidity: cur.relative_humidity_2m ?? null,
      rainNow: cur.precipitation ?? null,
      windKmh: cur.wind_speed_10m ?? null,
      windDeg: cur.wind_direction_10m ?? null,
      uv: cur.uv_index ?? null,
      cloudPct: cur.cloud_cover ?? null,
      pressurehPa: cur.pressure_msl ?? null,
      visKm: cur.visibility != null ? cur.visibility / 1000 : null,
      isDay: cur.is_day != null ? cur.is_day === 1 : null,
      condition: WEATHER_CODE[cur.weather_code ?? -1] ?? "—",
      sunrise: d.sunrise?.[0] ?? null,
      sunset: d.sunset?.[0] ?? null,
      daily: days,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// 30-minute localStorage cache so a refresh isn't a fresh 7-city fan-out
const CACHE_KEY = "chula:world-weather";
const CACHE_TTL_MS = 30 * 60 * 1000;

function readCache(): { fetchedAt: string; results: CityWeather[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fetchedAt: string; results: CityWeather[] };
    if (Date.now() - new Date(parsed.fetchedAt).getTime() > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}
function writeCache(results: CityWeather[]) {
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: new Date().toISOString(), results }),
    );
  } catch {}
}

export function useWorldWeather(): CityWeather[] {
  const [cities, setCities] = useState<CityWeather[]>(() => readCache()?.results ?? []);
  const hasSetFromCache = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let ctrl = new AbortController();
    const load = async () => {
      const cached = readCache();
      if (cached) {
        if (!hasSetFromCache.current) {
          hasSetFromCache.current = true;
          setCities(cached.results);
        }
        return;
      }
      const results = await Promise.all(PARTNER_CITIES.map((c) => fetchOne(c, ctrl.signal)));
      if (cancelled) return;
      const good = results.filter((r): r is CityWeather => r !== null);
      hasSetFromCache.current = true;
      setCities(good);
      writeCache(good);
    };
    load();
    const id = setInterval(() => {
      ctrl.abort();
      ctrl = new AbortController();
      load();
    }, CACHE_TTL_MS);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearInterval(id);
    };
  }, []);

  return cities;
}
