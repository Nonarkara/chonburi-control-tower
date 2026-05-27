/**
 * Pure helpers for the AqiBadge component —
 * extracted for unit testing.
 */

export interface TrendPoint {
  at: string;
  aqi: number | null;
  pm25?: number | null;
}

export interface AqiTrendInput {
  current: { aqi: number | null };
  next8h: TrendPoint[];
}

/**
 * Compute the maximum AQI over the current reading + next-8-hour forecast.
 * Falls back to current AQI (or 0) when forecast points have null AQI.
 */
export function maxAqiNext8h(trend: AqiTrendInput): number {
  return trend.next8h.reduce(
    (m, p) => Math.max(m, p.aqi ?? m),
    trend.current.aqi ?? 0,
  );
}

/**
 * Format an ISO timestamp to a zero-padded hour string, e.g. "08h", "14h".
 */
export function fmtHour(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}h`;
}
