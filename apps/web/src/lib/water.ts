/**
 * Pure helpers for the WaterPanel reservoir display —
 * extracted from WaterPanel.tsx for unit testing.
 */

/**
 * Classify remaining water supply into an alert level.
 *
 * Thresholds (days of supply remaining):
 *   null   → "ok"      (unknown — don't alarm)
 *   < 10   → "critical"
 *   < 30   → "low"
 *   < 120  → "watch"
 *   ≥ 120  → "ok"
 */
export function alertLevel(days: number | null): "critical" | "low" | "watch" | "ok" {
  if (days == null) return "ok";
  if (days < 10)   return "critical";
  if (days < 30)   return "low";
  if (days < 120)  return "watch";
  return "ok";
}
