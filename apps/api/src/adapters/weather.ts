import type { NormalizedFeed, WeatherSnapshot } from "@chonburi/shared";
import { CHONBURI } from "@chonburi/shared";
import { cacheAgeMinutes, cached } from "../lib/cache.js";
import { fetchJsonOrNull } from "./common.js";

const TTL_SECONDS = 10800; // 3h — Open-Meteo daily quota friendly // 30 min

interface OpenMeteoCurrent {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    precipitation?: number;
    weather_code?: number;
  };
}

const WEATHER_CODE: Record<number, string> = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Rime fog",
  51: "Light drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  80: "Showers",
  95: "Thunderstorm",
};

export async function fetchWeather(): Promise<NormalizedFeed<WeatherSnapshot>> {
  return cached("weather", TTL_SECONDS, async () => {
    const fetchedAt = new Date().toISOString();
    const [lng, lat] = CHONBURI.center;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation,weather_code&timezone=Asia%2FBangkok&wind_speed_unit=kmh`;
    const payload = await fetchJsonOrNull<OpenMeteoCurrent>(url);
    const c = payload?.current;

    const features: WeatherSnapshot[] = [];
    if (c && c.time != null) {
      const condition = c.weather_code != null ? WEATHER_CODE[c.weather_code] : undefined;
      features.push({
        tempC: c.temperature_2m ?? null,
        feelsLikeC: c.apparent_temperature ?? c.temperature_2m ?? null,
        humidity: c.relative_humidity_2m ?? null,
        windKmh: c.wind_speed_10m ?? null,
        precipMm: c.precipitation ?? null,
        condition: condition ?? "—",
        observedAt: c.time,
      });
    }

    return {
      features,
      meta: {
        source: "open-meteo",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: features.length > 0 ? "live" : "scenario",
      },
    };
  });
}
