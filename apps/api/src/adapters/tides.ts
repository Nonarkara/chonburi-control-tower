/**
 * Harmonic tide prediction for Si Racha / Chonburi Bay, Gulf of Thailand.
 *
 * No API key required — uses known tidal constituents from:
 *   Royal Thai Navy Hydrographic Department, Station: Si Racha (Thailand)
 *   + IHO publications for Gulf of Thailand.
 *
 * The Gulf of Thailand has a mixed diurnal / semi-diurnal regime:
 *   - One high + one low per day (diurnal, K1 dominant)
 *   - Sometimes a second smaller tide per day (semi-diurnal, M2)
 *   - Tidal range: typically 0.2–1.6 m; spring tides 1.4–1.8 m
 *
 * Constituents used (amplitude in m, phase in degrees Greenwich epoch):
 *   K1  (23.93 h)  — principal lunar diurnal, dominant in Gulf
 *   O1  (25.82 h)  — principal lunar diurnal
 *   M2  (12.42 h)  — principal lunar semi-diurnal
 *   S2  (12.00 h)  — principal solar semi-diurnal
 *   M4  ( 6.21 h)  — compound (shallow water effect)
 *
 * Sources: Thai Hydrographic Chart + IOC UHSLC station 011 (Ko Lak ~240 km
 * south; Si Racha constituents are ~ +0.05 m amplitude and 12° phase ahead).
 *
 * WARNING: These are approximate regional constituents, NOT verified against
 * a calibrated local gauge. For civil engineering decisions, always cross-check
 * with the official HDRTN tide tables.
 */

import type { NormalizedFeed } from "@chonburi/shared";
import { cacheAgeMinutes, cachedWithStale as cached } from "../lib/cache.js";

// ── Harmonic constituents (Si Racha approximation) ──────────────────────
// H = amplitude (m), g = phase lag (degrees, astronomical argument)
// Derived from published constituent tables and regional adjustments.
interface Constituent {
  name: string;
  period_h: number;  // hours
  H: number;         // amplitude (m)
  g: number;         // phase (degrees)
}

const CONSTITUENTS: Constituent[] = [
  { name: "M2",  period_h: 12.4206,  H: 0.12, g: 155 },  // semi-diurnal
  { name: "S2",  period_h: 12.0000,  H: 0.07, g: 168 },
  { name: "K1",  period_h: 23.9345,  H: 0.25, g: 162 },  // diurnal (dominant)
  { name: "O1",  period_h: 25.8193,  H: 0.20, g: 138 },
  { name: "P1",  period_h: 24.0659,  H: 0.07, g: 157 },
  { name: "M4",  period_h:  6.2103,  H: 0.03, g: 310 },  // shallow water
  { name: "MS4", period_h:  6.1033,  H: 0.02, g: 295 },
];

// Mean sea level above chart datum (CD) for Si Racha approximation
const MSL_ABOVE_CD = 0.85;   // metres above chart datum

// Reference epoch: J2000.0 = 2000-01-01T12:00:00Z
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

function deg2rad(d: number): number { return d * Math.PI / 180; }

/**
 * Predict tide height (metres above chart datum) at time `ts` (ms epoch).
 * h(t) = Z0 + Σ H_n · cos(2π(t−t0)/T_n − g_n)
 */
function predictTide(tsMs: number): number {
  const dtH = (tsMs - J2000_MS) / 3_600_000;   // hours since J2000
  let h = MSL_ABOVE_CD;
  for (const c of CONSTITUENTS) {
    const phase = (2 * Math.PI * dtH) / c.period_h - deg2rad(c.g);
    h += c.H * Math.cos(phase);
  }
  return Math.round(h * 100) / 100;   // cm precision
}

export interface TideExtreme {
  at: string;       // ISO
  heightM: number;
  type: "high" | "low";
  hoursFromNow: number;
}

export interface TideSnapshot {
  observedAt: string;
  heightM: number;           // current predicted height
  rising: boolean;           // tide coming in?
  nextHigh: TideExtreme | null;
  nextLow: TideExtreme | null;
  prev12h: Array<{ at: string; heightM: number }>;   // 10-min intervals, 12 h back
  next24h: Array<{ at: string; heightM: number }>;   // 10-min intervals, 24 h ahead
  moonPhase: number;         // 0-1 (0=new, 0.5=full)
  moonPhaseName: string;
  springNeap: "spring" | "neap" | "rising" | "falling";
  /** Flood risk multiplier: high spring + high wave = elevated coastal flood */
  springTide: boolean;
  chartDatumNote: string;
}

// Moon phase — approximate, based on known new moon + 29.53-day cycle
function moonPhase(tsMs: number): number {
  // Known new moon: 2024-01-11T11:57:00Z
  const knownNewMoon = Date.UTC(2024, 0, 11, 11, 57, 0);
  const LUNAR_MONTH_MS = 29.530588853 * 24 * 60 * 60 * 1000;
  const elapsed = ((tsMs - knownNewMoon) % LUNAR_MONTH_MS + LUNAR_MONTH_MS) % LUNAR_MONTH_MS;
  return elapsed / LUNAR_MONTH_MS;
}

function moonPhaseName(phase: number): string {
  if (phase < 0.04 || phase > 0.96) return "New Moon";
  if (phase < 0.21) return "Waxing Crescent";
  if (phase < 0.29) return "First Quarter";
  if (phase < 0.46) return "Waxing Gibbous";
  if (phase < 0.54) return "Full Moon";
  if (phase < 0.71) return "Waning Gibbous";
  if (phase < 0.79) return "Last Quarter";
  return "Waning Crescent";
}

// Spring tides occur near new/full moon; neap tides near quarters
function springNeapLabel(phase: number): TideSnapshot["springNeap"] {
  const dist = Math.min(phase, 1 - phase);             // 0 = new, 0.5 = full
  const distFromSyzygy = Math.min(dist, 0.5 - dist);   // 0 at new/full
  if (distFromSyzygy < 0.05) return "spring";
  if (distFromSyzygy < 0.12) return distFromSyzygy < 0.08 ? "rising" : "falling";
  return "neap";
}

/** Find next N extremes (high or low) after `fromMs`. */
function findNextExtremes(fromMs: number, n: number): TideExtreme[] {
  const STEP_MS = 5 * 60_000;  // 5-min search step
  const extremes: TideExtreme[] = [];
  let prev = predictTide(fromMs);
  let prevSlope = 0;
  let t = fromMs + STEP_MS;
  const maxSearch = fromMs + 4 * 24 * 60 * 60_000;   // search up to 4 days

  while (extremes.length < n && t < maxSearch) {
    const cur = predictTide(t);
    const slope = cur - prev;
    if (prevSlope > 0 && slope <= 0) {
      // Was rising, now falling → local high
      const atIso = new Date(t - STEP_MS).toISOString();
      extremes.push({
        at: atIso,
        heightM: prev,
        type: "high",
        hoursFromNow: (t - STEP_MS - fromMs) / 3_600_000,
      });
    } else if (prevSlope < 0 && slope >= 0) {
      // Was falling, now rising → local low
      const atIso = new Date(t - STEP_MS).toISOString();
      extremes.push({
        at: atIso,
        heightM: prev,
        type: "low",
        hoursFromNow: (t - STEP_MS - fromMs) / 3_600_000,
      });
    }
    prevSlope = slope;
    prev = cur;
    t += STEP_MS;
  }
  return extremes;
}

export async function fetchTides(): Promise<NormalizedFeed<TideSnapshot>> {
  return cached("tides", 600, async () => {   // 10-min cache (tides change slowly)
    const fetchedAt = new Date().toISOString();
    const nowMs = Date.now();
    const INTERVAL_MS = 10 * 60_000;  // 10-min intervals

    // Current tide + direction
    const h0 = predictTide(nowMs);
    const h1 = predictTide(nowMs + INTERVAL_MS);
    const rising = h1 > h0;

    // Past 12 h (for sparkline context)
    const prev12h: TideSnapshot["prev12h"] = [];
    for (let i = -72; i <= 0; i++) {
      const t = nowMs + i * INTERVAL_MS;
      prev12h.push({ at: new Date(t).toISOString(), heightM: predictTide(t) });
    }

    // Next 24 h
    const next24h: TideSnapshot["next24h"] = [];
    for (let i = 1; i <= 144; i++) {
      const t = nowMs + i * INTERVAL_MS;
      next24h.push({ at: new Date(t).toISOString(), heightM: predictTide(t) });
    }

    // Next extremes
    const extremes = findNextExtremes(nowMs, 4);
    const nextHigh = extremes.find((e) => e.type === "high") ?? null;
    const nextLow  = extremes.find((e) => e.type === "low")  ?? null;

    // Moon + spring/neap
    const phase = moonPhase(nowMs);
    const springNeap = springNeapLabel(phase);

    const snap: TideSnapshot = {
      observedAt: fetchedAt,
      heightM: h0,
      rising,
      nextHigh,
      nextLow,
      prev12h,
      next24h,
      moonPhase: Math.round(phase * 100) / 100,
      moonPhaseName: moonPhaseName(phase),
      springNeap,
      springTide: springNeap === "spring",
      chartDatumNote: "Approx. chart datum. Cross-check HDRTN tide tables for civil work.",
    };

    return {
      features: [snap],
      meta: {
        source: "harmonic-tide-si-racha",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: "reference" as const,
      },
    };
  });
}
