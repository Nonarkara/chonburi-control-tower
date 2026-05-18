import type { NormalizedFeed } from "@chula/shared";
import { cacheAgeMinutes, cached } from "../lib/cache.js";
import { fetchJsonOrNull } from "./common.js";
import { fetchViabusCuShuttle } from "./viabus.js";

const TTL_SECONDS = 30;

export interface ShuttleVehicle {
  id: string;
  line: string;        // "1".."5"
  lat: number;
  lng: number;
  bearing?: number;
  speedKmh?: number;
  occupancy?: "low" | "medium" | "high" | "unknown";
  updatedAt: string;
}

// CU Shuttle Bus (POP Bus) — live vehicle endpoint is operated by CU IT.
// Public URL pattern observed: cushuttlebus.com / cupopbus.com
// The exact realtime JSON is gated; we attempt the documented path, then fall
// back to scenario data so the layer always renders.

const PUBLIC_ENDPOINT_GUESSES = [
  "https://www.cushuttlebus.com/api/live",
  "https://cupopbus.com/api/buses",
];

function scenarioVehicles(): ShuttleVehicle[] {
  const now = new Date().toISOString();
  // Plausible positions along the 5 known routes; lets the UI render without an upstream feed.
  return [
    { id: "cu-1-A", line: "1", lat: 13.7470, lng: 100.5395, bearing: 200, speedKmh: 18, occupancy: "medium", updatedAt: now },
    { id: "cu-1-B", line: "1", lat: 13.7395, lng: 100.5388, bearing: 90,  speedKmh: 22, occupancy: "low",    updatedAt: now },
    { id: "cu-2-A", line: "2", lat: 13.7445, lng: 100.5295, bearing: 0,   speedKmh: 15, occupancy: "high",   updatedAt: now },
    { id: "cu-3-A", line: "3", lat: 13.7355, lng: 100.5300, bearing: 270, speedKmh: 20, occupancy: "medium", updatedAt: now },
    { id: "cu-4-A", line: "4", lat: 13.7405, lng: 100.5345, bearing: 180, speedKmh: 16, occupancy: "low",    updatedAt: now },
    { id: "cu-5-A", line: "5", lat: 13.7420, lng: 100.5385, bearing: 90,  speedKmh: 12, occupancy: "low",    updatedAt: now },
  ];
}

export async function fetchShuttle(env: {
  CU_SHUTTLE_TOKEN?: string;
  VIABUS_TOKEN?: string;
  VIABUS_BASE_URL?: string;
}): Promise<NormalizedFeed<ShuttleVehicle>> {
  return cached("cu-shuttle", TTL_SECONDS, async () => {
    const fetchedAt = new Date().toISOString();

    // 1) ViaBus — preferred upstream (they operate the CU POP Bus realtime feed).
    //    Returns null if VIABUS_TOKEN is unset OR upstream fails.
    const viabus = await fetchViabusCuShuttle(env);
    if (viabus && viabus.length > 0) {
      return {
        features: viabus,
        meta: {
          source: "viabus-cu-pop-bus",
          fetchedAt,
          ageMinutes: cacheAgeMinutes(fetchedAt),
          fallbackTier: "live" as const,
        },
      };
    }

    // 2) Public/legacy CU endpoints — best-effort guesses.
    const headers: Record<string, string> = {};
    if (env.CU_SHUTTLE_TOKEN) headers.authorization = `Bearer ${env.CU_SHUTTLE_TOKEN}`;

    for (const url of PUBLIC_ENDPOINT_GUESSES) {
      const payload = await fetchJsonOrNull<{ vehicles?: ShuttleVehicle[] }>(url, { headers });
      if (payload?.vehicles && payload.vehicles.length > 0) {
        return {
          features: payload.vehicles,
          meta: {
            source: "cu-shuttle-live",
            fetchedAt,
            ageMinutes: cacheAgeMinutes(fetchedAt),
            fallbackTier: "live" as const,
          },
        };
      }
    }

    // No upstream — return scenario vehicles. UI knows fallbackTier="scenario".
    return {
      features: scenarioVehicles(),
      meta: {
        source: "cu-shuttle-scenario",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: "scenario" as const,
      },
    };
  });
}
