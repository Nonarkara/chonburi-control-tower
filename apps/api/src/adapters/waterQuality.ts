/**
 * Water quality adapter — coastal monitoring stations for Chonburi.
 *
 * Target metrics: DO₂ (dissolved oxygen, mg/L), salinity (ppt), turbidity
 * (NTU), pH. Monitoring stations: Bang Saen, Bang Phra, Ang Sila, Si Racha.
 *
 * ## API status (as of 2026-05)
 *
 * No real-time machine-readable API exists from Thai government agencies:
 *
 * - **PCD** (Pollution Control Department): Marine Water Quality Index datasets
 *   on data.go.th (annual aggregates only, CSV). No streaming endpoint.
 *   Dataset: https://data.go.th/dataset/402c771a-4b35-4dd7-aca8-d222fab61a49
 *
 * - **DMCR** (Marine Dept.): 58 datasets on data.go.th (coastal erosion,
 *   community profiles, CSV/XLSX). No real-time sensor feed.
 *
 * - **ONEP / กรมชลประทาน**: Environmental monitoring publications, PDF only.
 *
 * ## Next steps
 *
 * 1. Contact PCD (division of Marine Environment) for direct station API:
 *    https://www.pcd.go.th → ข้อมูลและบริการ → คุณภาพน้ำทะเล
 * 2. Contact DMCR for real-time sensor feed (research stations):
 *    https://www.dmcr.go.th/webs/166/
 * 3. If partnerships fail: deploy low-cost YSI or Atlas Scientific sensors at
 *    Ang Sila pier + Bang Saen beach and self-host the feed.
 *
 * Until a live feed is available this module returns clearly-labelled mock
 * data so the dashboard can render the panel without crashing.
 */

import type { NormalizedFeed } from "@chonburi/shared";
import { cacheAgeMinutes } from "../lib/cache.js";

export interface WaterQualityReading {
  stationId: string;
  stationName: string;
  stationNameTh: string;
  lat: number;
  lng: number;
  observedAt: string;
  // Core metrics — null when sensor offline
  doMgL: number | null;          // Dissolved oxygen (mg/L). Healthy: >5
  salinityPpt: number | null;    // Salinity (ppt). Gulf typical: 28–34
  turbidityNtu: number | null;   // Turbidity (NTU). Clear: <5
  pH: number | null;             // pH. Healthy: 7.8–8.5
  tempC: number | null;          // Water temperature (°C)
  // Derived verdict
  doVerdict: "healthy" | "stressed" | "critical" | null;
}

// TODO: replace with real PCD/DMCR station IDs once API is obtained
const MOCK_STATIONS: WaterQualityReading[] = [
  {
    stationId: "WQ-BANGSAN-01",
    stationName: "Bang Saen Beach",
    stationNameTh: "หาดบางแสน",
    lat: 13.278,
    lng: 100.921,
    observedAt: new Date().toISOString(),
    doMgL: null,
    salinityPpt: null,
    turbidityNtu: null,
    pH: null,
    tempC: null,
    doVerdict: null,
  },
  {
    stationId: "WQ-ANGSILA-01",
    stationName: "Ang Sila Oyster Zone",
    stationNameTh: "อ่างศิลา",
    lat: 13.329,
    lng: 100.976,
    observedAt: new Date().toISOString(),
    doMgL: null,
    salinityPpt: null,
    turbidityNtu: null,
    pH: null,
    tempC: null,
    doVerdict: null,
  },
  {
    stationId: "WQ-BANGPHRA-01",
    stationName: "Bang Phra Reservoir Estuary",
    stationNameTh: "อ่างเก็บน้ำบางพระ",
    lat: 13.19,
    lng: 101.05,
    observedAt: new Date().toISOString(),
    doMgL: null,
    salinityPpt: null,
    turbidityNtu: null,
    pH: null,
    tempC: null,
    doVerdict: null,
  },
];

export async function fetchWaterQuality(): Promise<NormalizedFeed<WaterQualityReading>> {
  // TODO: replace with live PCD/DMCR endpoint once API key + endpoint confirmed.
  // Pattern when live:
  //   const data = await fetchJsonOrThrow<PcdApiResponse>(PCD_ENDPOINT);
  //   return { features: normalise(data), meta: { ... fallbackTier: "live" } };

  const fetchedAt = new Date().toISOString();
  return {
    features: MOCK_STATIONS,
    meta: {
      source: "water-quality-stub",
      fetchedAt,
      ageMinutes: cacheAgeMinutes(fetchedAt),
      fallbackTier: "scenario",
    },
  };
}
