import { fmtAge, tierLabel } from '@chonburi/shared';
import type { FallbackTier } from '@chonburi/shared';
import { ageClass } from '../lib/panelHeader';

interface PanelHeaderProps {
  /** Section title — rendered as eyebrow */
  title: string;
  /** Data age in minutes from NormalizedFeed.meta.ageMinutes */
  ageMinutes?: number | null;
  /** Fallback tier from NormalizedFeed.meta.fallbackTier */
  fallbackTier?: FallbackTier;
  /** Short source identifier e.g. "open-meteo" | "aqicn" */
  source?: string;
  /** Extra content on the right side (e.g. a refresh button) */
  actions?: React.ReactNode;
}

/**
 * PanelHeader — standard section header for all dashboard panels.
 *
 * Shows the panel title (eyebrow style) on the left, and on the right:
 * - source tag (if provided)
 * - tier warning badge (if not live)
 * - data-age freshness chip (color-coded: green < 5m, yellow < 2h, red > 2h)
 *
 * Addresses the "context and metadata for every indicator" best practice
 * from the Taipei City Dashboard pattern and UNDP smart city guidelines.
 */
export function PanelHeader({ title, ageMinutes, fallbackTier, source, actions }: PanelHeaderProps) {
  const tier = fallbackTier ?? 'live';
  const tl = tierLabel(tier);

  return (
    <div className="panel-hdr">
      <span className="eyebrow mono">{title}</span>

      {source && (
        <span className="panel-source-tag mono" title={`Data source: ${source}`}>
          {source.toUpperCase()}
        </span>
      )}

      {tl && (
        <span
          className={`panel-tier-warn mono${tier === 'unavailable' ? ' panel-tier-warn--crit' : ''}`}
          title={`Data quality: ${tier} — not live`}
        >
          {tl}
        </span>
      )}

      {(ageMinutes != null || tier === 'unavailable') && (
        <span
          className={`data-age mono ${ageClass(ageMinutes, tier)}`}
          title={`Last updated: ${fmtAge(ageMinutes)} ago · tier: ${tier}`}
        >
          {tier === 'unavailable' ? 'OFFLINE' : fmtAge(ageMinutes)}
        </span>
      )}

      {actions}
    </div>
  );
}
