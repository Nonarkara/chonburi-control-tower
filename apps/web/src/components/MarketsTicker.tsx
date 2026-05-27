import { useMemo } from "react";
import type { MarketSnapshot } from "@chonburi/shared";
import { fmtValue, fmtPct, arrow, tickColor } from "../lib/markets";

interface Props {
  snapshot: MarketSnapshot | null;
  loading: boolean;
}


/**
 * Brokerage-floor scrolling ticker for global markets.
 * Renders all ticks twice in series so the CSS animation loops seamlessly.
 * Each cell: NAME · VALUE · ▲ ±pct.  SET Bangkok always leads.
 */
export function MarketsTicker({ snapshot, loading }: Props) {
  const ticks = useMemo(() => {
    if (!snapshot) return [];
    // Lead with THB-USD, Asian indices (^N225, ^HSI, ^STI), then S&P + WTI + VIX + yields
    const lead = ["DEXTHUS", "^N225", "^HSI", "^STI", "^GSPC", "DCOILWTICO", "VIXCLS", "DGS10"];
    const leadTicks = lead
      .map((s) => snapshot.ticks.find((t) => t.symbol === s))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
    const rest = snapshot.ticks.filter((t) => !lead.includes(t.symbol));
    return [...leadTicks, ...rest];
  }, [snapshot]);

  if (loading) {
    return (
      <div className="markets-ticker">
        <span className="markets-ticker-tag mono">MARKETS</span>
        <div className="markets-ticker-track markets-ticker-empty">
          <span className="caption">Loading global markets…</span>
        </div>
      </div>
    );
  }

  if (!snapshot || ticks.length === 0) {
    return (
      <div className="markets-ticker">
        <span className="markets-ticker-tag mono">MARKETS</span>
        <div className="markets-ticker-track markets-ticker-empty">
          <span className="caption" style={{ color: "var(--text-3)" }}>Markets unavailable · retrying…</span>
        </div>
      </div>
    );
  }

  const seconds = Math.max(90, ticks.length * 6);

  return (
    <div className="markets-ticker" aria-label="Live markets ticker">
      <span className="markets-ticker-tag mono">MARKETS</span>
      <div
        className="markets-ticker-track"
        style={{ animationDuration: `${seconds}s` }}
        aria-hidden={false}
      >
        {[0, 1].map((pass) => (
          <div className="markets-ticker-pass" key={pass}>
            {ticks.map((t) => (
              <span key={`${pass}-${t.symbol}`} className="markets-ticker-item">
                <span className="markets-ticker-name mono">{t.name}</span>
                <span className="markets-ticker-value mono">{fmtValue(t.value, t.group)}</span>
                <span
                  className="markets-ticker-delta mono"
                  style={{ color: tickColor(t.changePct) }}
                >
                  {arrow(t.changePct)} {fmtPct(t.changePct)}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
