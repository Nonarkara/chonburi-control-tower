/**
 * Pure helpers for the PredictivePanel TimesFM forecast display —
 * extracted for unit testing.
 */

export interface ForecastPoint {
  time: string;
  p50: number;
  p10: number | null;
  p90: number | null;
}

/**
 * Format the age of a forecast generation timestamp.
 * Returns "" when iso is null (no data yet).
 * Returns "Nm ago" for < 1 hour, "Nh ago" for longer.
 */
export function formatAge(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

/**
 * Summarise the peak p50 value across a forecast horizon.
 * Returns "—" when there are no points.
 * Returns "N.N unit peak" when unit is provided, "N.N peak" otherwise.
 */
export function peakLabel(points: ForecastPoint[], unit: string): string {
  if (!points.length) return "—";
  const peak = Math.max(...points.map((p) => p.p50));
  return `${peak.toFixed(1)}${unit ? " " + unit : ""} peak`;
}
