/**
 * Port operations adapter — Laem Chabang and Chonburi town port.
 *
 * Laem Chabang is Thailand's largest container port (~100 km TEU/year) and
 * the EEC's main maritime gateway. Real-time berth + throughput data is
 * commercially sensitive; this adapter documents what's available and provides
 * mock data until a data-sharing agreement is reached.
 *
 * ## Metrics
 * - Vessels in port (anchored + berthed)
 * - Berth utilisation %
 * - TEU throughput (daily, rolling 7d)
 * - Hazardous cargo alerts
 *
 * ## API status (as of 2026-05)
 *
 * **PAT (Port Authority of Thailand)** — port.co.th is protected by Incapsula
 * WAF. No public JSON API found. No datasets on data.go.th.
 * Contact: https://www.port.co.th/en/contact-us
 *
 * **MarineTraffic / VesselFinder** — Thai port density not in free tier.
 * Paid API (from ~$50/month) has port call data + berth status:
 * https://www.marinetraffic.com/en/ais-api-services/details/ps:5
 *
 * **AIS vessel count proxy** — already available via aisstream.io (see
 * ais.ts). Vessels within the Laem Chabang anchorage bbox
 * (100.88–100.93°E, 13.07–13.12°N) can serve as a vessel-count proxy
 * at zero marginal cost while the full port ops feed is negotiated.
 *
 * ## Recommended path forward
 *
 * 1. Use AIS bbox count as a free-tier vessel-in-port metric immediately.
 * 2. Reach out to PAT's Smart Port (Laem Chabang Phase 3) team for pilot.
 * 3. Check EEC Digital Platform (eec.or.th) for aggregated port statistics.
 * 4. Fallback: scrape PAT's public statistics page (monthly PDF, automate
 *    with pdfplumber → monthly time-series ingestion).
 */

import type { NormalizedFeed } from "@chonburi/shared";
import { cacheAgeMinutes } from "../lib/cache.js";

export interface PortOpsSnapshot {
  portId: string;
  portName: string;
  portNameTh: string;
  lat: number;
  lng: number;
  observedAt: string;
  // Vessel counts — null until AIS or PAT API wired
  vesselsBerthed: number | null;
  vesselsAnchorage: number | null;
  berthUtilisationPct: number | null;
  // Throughput — null until PAT data sharing
  teuTodayEstimate: number | null;
  teuRolling7d: number | null;
  // Status
  operationalStatus: "normal" | "busy" | "disrupted" | "unknown";
}

const MOCK_PORTS: PortOpsSnapshot[] = [
  {
    portId: "THLCH",            // UN/LOCODE
    portName: "Laem Chabang",
    portNameTh: "ท่าเรือแหลมฉบัง",
    lat: 13.098,
    lng: 100.900,
    observedAt: new Date().toISOString(),
    vesselsBerthed: null,       // TODO: wire AIS bbox filter 100.88–100.93°E, 13.07–13.12°N
    vesselsAnchorage: null,
    berthUtilisationPct: null,  // TODO: PAT data sharing
    teuTodayEstimate: null,
    teuRolling7d: null,
    operationalStatus: "unknown",
  },
  {
    portId: "THCBI",            // UN/LOCODE for Chonburi
    portName: "Chonburi Town Pier",
    portNameTh: "ท่าเทียบเรือชลบุรี",
    lat: 13.361,
    lng: 100.979,
    observedAt: new Date().toISOString(),
    vesselsBerthed: null,
    vesselsAnchorage: null,
    berthUtilisationPct: null,
    teuTodayEstimate: null,
    teuRolling7d: null,
    operationalStatus: "unknown",
  },
];

export async function fetchPortOps(): Promise<NormalizedFeed<PortOpsSnapshot>> {
  // TODO: replace with live PAT endpoint or AIS bbox counter once available.
  // Interim AIS proxy pattern (example, not yet wired):
  //   const aisVessels = fetchAisVessels();
  //   const laemChabangBbox = [100.88, 13.07, 100.93, 13.12];
  //   const berthed = aisVessels.features.filter(v =>
  //     v.lng >= laemChabangBbox[0] && v.lng <= laemChabangBbox[2] &&
  //     v.lat >= laemChabangBbox[1] && v.lat <= laemChabangBbox[3]
  //   ).length;

  const fetchedAt = new Date().toISOString();
  return {
    features: MOCK_PORTS,
    meta: {
      source: "port-ops-stub",
      fetchedAt,
      ageMinutes: cacheAgeMinutes(fetchedAt),
      fallbackTier: "scenario",
    },
  };
}
