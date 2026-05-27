/**
 * Pure time-display helpers — extracted from FacebookPanel and NewsTicker
 * (which had two slightly-different `ago()` implementations) into a single
 * canonical version.
 *
 * Uses lowercase labels matching the NewsTicker convention ("now", "m", "h",
 * "d") and adds a NaN guard from the Facebook version. Returns "—" for
 * invalid ISO strings rather than silently showing NaN arithmetic.
 */

/**
 * Format an ISO datetime string as a short human-readable age.
 *
 * @returns "now" (< 1 min), "Nm" (minutes), "Nh" (hours), "Nd" (days),
 *          or "—" for invalid/null input.
 */
export function ago(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const ms = Date.now() - t;
  const m = Math.round(ms / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
