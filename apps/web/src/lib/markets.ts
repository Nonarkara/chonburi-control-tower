/**
 * Pure market-display helpers — extracted from MarketsTicker.tsx so they
 * can be unit-tested without a DOM or React environment.
 */

/**
 * Format a market value with group-appropriate decimal precision.
 *
 * Groups:
 *  - "forex"  → ≥100: 2dp, <100: 4dp  (e.g. USD/THB vs EUR/USD)
 *  - "macro"  → always 2dp             (e.g. bond yields, oil)
 *  - default  → ≥1000: comma-formatted, <1000: 2dp
 */
export function fmtValue(v: number | null, group: string): string {
  if (v == null) return "—";
  if (group === "forex") return v >= 100 ? v.toFixed(2) : v.toFixed(4);
  if (group === "macro") return v.toFixed(2);
  if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return v.toFixed(2);
}

/**
 * Format a percentage change with sign prefix.
 * Returns empty string for null (no % data available).
 */
export function fmtPct(p: number | null): string {
  if (p == null) return "";
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(2)}%`;
}

/**
 * Map a percentage change to a directional arrow glyph.
 * Dead-zone ±0.05% is treated as neutral (·).
 */
export function arrow(p: number | null): string {
  if (p == null) return "·";
  if (p > 0.05) return "▲";
  if (p < -0.05) return "▼";
  return "·";
}

/**
 * Map a percentage change to a CSS color variable.
 * Dead-zone ±0.05% is treated as neutral.
 */
export function tickColor(p: number | null): string {
  if (p == null) return "var(--text-3)";
  if (p > 0.05) return "var(--good)";
  if (p < -0.05) return "var(--bad)";
  return "var(--text-2)";
}
