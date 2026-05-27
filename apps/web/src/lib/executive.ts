/**
 * Pure display helpers for the Executive Briefing panel — extracted from
 * ExecutiveBriefing.tsx so they can be unit-tested without DOM/React.
 *
 * Note: aqiBand and aqiColor here use abbreviated executive-style labels
 * ("MOD", "USG", "VERY UNHEALTHY") distinct from the operational-panel
 * versions in coastal.ts ("MODERATE", "UNHEALTHY·SG", "HAZARDOUS").
 */

/** AQI band label for the executive summary row (abbreviated). */
export function execAqiBand(aqi: number): string {
  if (aqi <= 50)  return "GOOD";
  if (aqi <= 100) return "MOD";
  if (aqi <= 150) return "USG";
  if (aqi <= 200) return "UNHEALTHY";
  return "VERY UNHEALTHY";
}

/** AQI color token for the executive summary row. */
export function execAqiColor(aqi: number): string {
  if (aqi <= 50)  return "var(--good)";
  if (aqi <= 100) return "var(--data)";
  if (aqi <= 150) return "var(--warn)";
  return "var(--bad)";
}

/** Format a nullable number to 1 decimal place; null → "—". */
export function fmt1(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toFixed(1);
}

/** Format a nullable number as a rounded, comma-separated integer; null → "—". */
export function fmtInt(v: number | null | undefined): string {
  if (v == null) return "—";
  return Math.round(v).toLocaleString();
}

/** Average capacity % across all reservoirs that have a non-null, finite value. */
export function avgCapacityPct(reservoirs: Array<{ capacityPct: number | null }>): number | null {
  const vals = reservoirs
    .map((r) => r.capacityPct)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
