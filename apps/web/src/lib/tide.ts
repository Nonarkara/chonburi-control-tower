/**
 * Pure tide-display helpers — extracted from TidePanel.tsx so they can be
 * unit-tested without a DOM or React rendering environment.
 *
 * TidePanel imports from here and re-exports nothing — this module is the
 * single source of truth for the countdown and moon-phase display logic.
 */

/**
 * Format a fractional hour count into a human-readable countdown string.
 *
 * @example
 * fmtCountdown(-1)   // "—"  (already past)
 * fmtCountdown(0.5)  // "30m"
 * fmtCountdown(2.25) // "2h 15m"
 */
export function fmtCountdown(hours: number): string {
  if (hours < 0) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/**
 * Map a moon phase fraction (0–1) to the corresponding moon emoji.
 *
 * The standard 8-phase wheel:
 *   🌑 New (≈ 0 or 1), 🌒 Waxing crescent, 🌓 First quarter,
 *   🌔 Waxing gibbous, 🌕 Full (≈ 0.5), 🌖 Waning gibbous,
 *   🌗 Last quarter, 🌘 Waning crescent.
 */
export function moonEmoji(phase: number): string {
  if (phase < 0.04 || phase > 0.96) return "🌑";
  if (phase < 0.21) return "🌒";
  if (phase < 0.29) return "🌓";
  if (phase < 0.46) return "🌔";
  if (phase < 0.54) return "🌕";
  if (phase < 0.71) return "🌖";
  if (phase < 0.79) return "🌗";
  return "🌘";
}
