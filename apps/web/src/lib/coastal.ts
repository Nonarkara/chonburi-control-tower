/**
 * Pure coastal/AQI display helpers — extracted from CoastalBrief and
 * KpiStrip so they can be unit-tested without a DOM or React environment.
 */

const COMPASS_DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/**
 * Convert wind direction degrees to a compass abbreviation.
 * Returns "—" for null input.
 */
export function compass(deg: number | null): string {
  if (deg == null) return "—";
  return COMPASS_DIRS[Math.round(deg / 45) % 8];
}

/**
 * Format a nullable number to a fixed-decimal string with optional unit suffix.
 * Returns "—" for null or NaN.
 */
export function fmt(n: number | null, digits = 1, unit = ""): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}${unit}`;
}

/**
 * Map a US AQI integer to a CSS color token for use in the KPI strip.
 *
 * Thresholds: ≤50 good, ≤100 moderate, ≤150 unhealthy (sensitive), else critical.
 */
export function aqiColor(aqi: number): string {
  if (aqi <= 50) return "var(--good)";
  if (aqi <= 100) return "var(--warn)";
  if (aqi <= 150) return "var(--bad)";
  return "var(--crit)";
}

/**
 * Map a US AQI integer to its text category label.
 *
 * Thresholds follow US EPA AQI scale (0–50 Good, 51–100 Moderate,
 * 101–150 Unhealthy for Sensitive Groups, 151–200 Unhealthy, >200 Hazardous).
 */
export function aqiBand(aqi: number): string {
  if (aqi <= 50) return "GOOD";
  if (aqi <= 100) return "MODERATE";
  if (aqi <= 150) return "UNHEALTHY·SG";
  if (aqi <= 200) return "UNHEALTHY";
  return "HAZARDOUS";
}

/**
 * Map a Beaufort number to a CSS colour token.
 *   ≥8 → bad (gale), ≥6 → warn (strong breeze), ≥4 → accent (moderate), else good.
 */
export function beaufortColor(bf: number): string {
  if (bf >= 8) return "var(--bad)";
  if (bf >= 6) return "var(--warn)";
  if (bf >= 4) return "var(--accent)";
  return "var(--good)";
}

/**
 * Map a storm-surge peak height (metres) to a CSS colour token.
 *   ≥2 m → bad (major surge), ≥1.2 m → warn (moderate), else good.
 */
export function surgeColor(surgePeakM: number): string {
  if (surgePeakM >= 2) return "var(--bad)";
  if (surgePeakM >= 1.2) return "var(--warn)";
  return "var(--good)";
}

/**
 * Return a CSS colour token for a boolean safe/unsafe state.
 */
export function safeColor(safe: boolean): string {
  return safe ? "var(--good)" : "var(--bad)";
}
