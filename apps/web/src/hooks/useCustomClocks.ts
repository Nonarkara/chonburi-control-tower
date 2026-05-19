import { useCallback, useEffect, useState } from "react";

export interface ClockSpec {
  id: string;        // city name + admin1
  label: string;     // short display
  country: string;   // ISO 3166-1 alpha-2
  tz: string;        // IANA zone
  lat: number;
  lng: number;
}

const STORAGE_KEY = "chonburi:custom-clocks-v2";
const SLOTS = 6;

// Sensible defaults — 6 global reference cities.
const DEFAULTS: Array<ClockSpec | null> = [
  { id: "Singapore-SG",     label: "Singapore",     country: "SG", tz: "Asia/Singapore",     lat: 1.3521,  lng: 103.8198 },
  { id: "Tokyo-JP",         label: "Tokyo",         country: "JP", tz: "Asia/Tokyo",         lat: 35.6762, lng: 139.6503 },
  { id: "Shanghai-CN",      label: "Shanghai",      country: "CN", tz: "Asia/Shanghai",      lat: 31.2304, lng: 121.4737 },
  { id: "Berlin-DE",        label: "Berlin",        country: "DE", tz: "Europe/Berlin",      lat: 52.5200, lng: 13.4050  },
  { id: "Boston-US",        label: "Boston",        country: "US", tz: "America/New_York",   lat: 42.3601, lng: -71.0589 },
  { id: "SanFrancisco-US",  label: "San Francisco", country: "US", tz: "America/Los_Angeles",lat: 37.7749, lng: -122.4194 },
];

function read(): Array<ClockSpec | null> {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Array<ClockSpec | null>;
    if (!Array.isArray(parsed)) return DEFAULTS;
    return Array.from({ length: SLOTS }, (_, i) => parsed[i] ?? null);
  } catch {
    return DEFAULTS;
  }
}

export function useCustomClocks() {
  const [clocks, setClocks] = useState<Array<ClockSpec | null>>(() => read());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clocks));
    } catch {}
  }, [clocks]);

  const setAt = useCallback((index: number, spec: ClockSpec | null) => {
    setClocks((prev) => {
      const next = [...prev];
      while (next.length < SLOTS) next.push(null);
      next[index] = spec;
      return next.slice(0, SLOTS);
    });
  }, []);

  return { clocks, setAt, slots: SLOTS };
}

// ── City search via Open-Meteo geocoding (free, no key) ─────────────────

interface GeocodingResult {
  results?: Array<{
    name: string;
    country?: string;
    country_code?: string;
    admin1?: string;
    timezone?: string;
    latitude: number;
    longitude: number;
  }>;
}

export async function searchCities(query: string, signal?: AbortSignal): Promise<ClockSpec[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&name=${encodeURIComponent(trimmed)}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const json = (await res.json()) as GeocodingResult;
    return (json.results ?? [])
      .filter((r) => r.timezone) // we need a TZ to render a clock
      .map((r) => ({
        id: `${r.name}-${r.country_code ?? r.country ?? ""}-${r.admin1 ?? ""}`,
        label: r.admin1 && r.admin1 !== r.name ? `${r.name}, ${r.admin1}` : r.name,
        country: r.country_code ?? "",
        tz: r.timezone as string,
        lat: r.latitude,
        lng: r.longitude,
      }));
  } catch {
    return [];
  }
}
