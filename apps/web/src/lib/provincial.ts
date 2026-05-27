/**
 * Pure display helpers for the ProvincialKPIs panel —
 * extracted for unit testing.
 */

/**
 * Format a number with automatic SI abbreviation for large values.
 *
 *   ≥ 1,000,000 → "1.0M"
 *   ≥ 1,000     → "1K"
 *   otherwise   → toFixed(decimals)
 *   null/NaN    → "—"
 */
export function fmtN(n: number | null | undefined, decimals = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toFixed(decimals);
}
