/**
 * Pure helpers for PanelHeader — extracted for unit testing.
 *
 * ageClass() drives the CSS freshness chip on every panel section header.
 * Getting the thresholds wrong silently shows stale colours to operators.
 */

import type { FallbackTier } from '@chonburi/shared';

/**
 * Map data age + fallback tier → CSS freshness class.
 *
 * Tier overrides take priority:
 *   unavailable → data-age--crit (offline / missing API key)
 *   scenario    → data-age--warn (synthetic / pre-generated data)
 *
 * Minute thresholds (when tier is live/cache):
 *   < 5   → data-age--fresh (green)
 *   < 30  → ""              (neutral — normal polling window)
 *   < 120 → data-age--warn  (yellow)
 *   ≥ 120 → data-age--stale (red)
 */
export function ageClass(minutes?: number | null, tier?: FallbackTier): string {
  if (tier === 'unavailable') return 'data-age--crit';
  if (tier === 'scenario') return 'data-age--warn';
  if (minutes == null) return '';
  if (minutes < 5) return 'data-age--fresh';
  if (minutes < 30) return '';
  if (minutes < 120) return 'data-age--warn';
  return 'data-age--stale';
}
