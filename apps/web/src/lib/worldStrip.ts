/**
 * Pure display helpers for the WorldStrip component —
 * extracted for unit testing.
 */

/**
 * Convert a wind bearing (0–360°) to a compass direction label.
 * Returns "—" for null.
 */
export function windDirLabel(deg: number | null): string {
  if (deg == null) return "—";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
  return dirs[Math.round(deg / 45) % 8];
}

export interface UvBand {
  label: string;
  color: string;
}

/**
 * Classify a UV index into a severity band with display label and CSS colour token.
 *
 * WHO UV index scale:
 *   < 3  → low
 *   < 6  → moderate
 *   < 8  → high
 *   < 11 → very high
 *   ≥ 11 → extreme
 */
export function uvBand(uv: number | null): UvBand {
  if (uv == null) return { label: "—", color: "var(--text-3)" };
  if (uv < 3)  return { label: "low",       color: "var(--good)" };
  if (uv < 6)  return { label: "moderate",  color: "var(--warn)" };
  if (uv < 8)  return { label: "high",      color: "var(--bad)" };
  if (uv < 11) return { label: "very high", color: "var(--bad)" };
  return { label: "extreme", color: "var(--crit)" };
}
