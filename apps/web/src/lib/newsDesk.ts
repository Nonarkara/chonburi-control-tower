/**
 * Pure helpers for the NewsDesk component —
 * extracted for unit testing.
 */

/**
 * Map a Traffy Fondue complaint score to a severity colour token.
 * Score reflects cumulative engagement (views + votes).
 *
 *   ≥ 1000 → var(--bad)   — high-profile issue
 *   ≥ 500  → var(--warn)  — notable issue
 *   < 500  → var(--text-3) — routine
 */
export function scoreColor(score: number): string {
  if (score >= 1000) return "var(--bad)";
  if (score >= 500)  return "var(--warn)";
  return "var(--text-3)";
}
