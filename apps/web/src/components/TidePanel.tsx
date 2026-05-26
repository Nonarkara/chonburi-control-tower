/**
 * TidePanel — harmonic tide prediction for Chonburi Bay.
 *
 * Shows: current tide height + direction, time to next high/low,
 * 12h+24h sparkline (past grey, future amber), moon phase, spring/neap.
 *
 * Data: computed from Gulf of Thailand tidal constituents — no API key.
 */

import type { FallbackTier } from "@chonburi/shared";
import { PanelHeader } from "./PanelHeader";

export interface TideExtreme {
  at: string;
  heightM: number;
  type: "high" | "low";
  hoursFromNow: number;
}

export interface TideSnapshot {
  observedAt: string;
  heightM: number;
  rising: boolean;
  nextHigh: TideExtreme | null;
  nextLow: TideExtreme | null;
  prev12h: Array<{ at: string; heightM: number }>;
  next24h: Array<{ at: string; heightM: number }>;
  moonPhase: number;
  moonPhaseName: string;
  springNeap: "spring" | "neap" | "rising" | "falling";
  springTide: boolean;
  chartDatumNote: string;
}

interface Props {
  data: TideSnapshot | null;
  loading: boolean;
  ageMinutes?: number;
  fallbackTier?: FallbackTier;
  source?: string;
}

function fmtCountdown(hours: number): string {
  if (hours < 0) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function moonEmoji(phase: number): string {
  if (phase < 0.04 || phase > 0.96) return "🌑";
  if (phase < 0.21) return "🌒";
  if (phase < 0.29) return "🌓";
  if (phase < 0.46) return "🌔";
  if (phase < 0.54) return "🌕";
  if (phase < 0.71) return "🌖";
  if (phase < 0.79) return "🌗";
  return "🌘";
}

const SPRING_NEAP_COLOR: Record<string, string> = {
  spring:  "var(--bad)",    // high tidal range — coastal flood risk
  rising:  "var(--warn)",   // approaching spring
  falling: "var(--data)",   // falling toward neap
  neap:    "var(--good)",   // low tidal range — safe
};

export function TidePanel({ data, loading, ageMinutes, fallbackTier, source }: Props) {
  if (loading && !data) {
    return (
      <div className="col">
        <PanelHeader title="TIDAL PREDICTION // SI RACHA STATION" source={source} />
        <div className="skeleton" style={{ height: 32, marginTop: 8 }} />
        <div className="skeleton" style={{ height: 12, width: "80%", marginTop: 8 }} />
      </div>
    );
  }
  if (!data) return null;

  const allPts = [...data.prev12h, ...data.next24h];
  const minH = Math.min(...allPts.map(p => p.heightM));
  const maxH = Math.max(...allPts.map(p => p.heightM));
  const range = Math.max(0.5, maxH - minH);
  const pivotX = data.prev12h.length;
  const totalPts = allPts.length;

  const sparkPath = allPts.map((p, i) => {
    const x = (i / Math.max(1, totalPts - 1)) * 240;
    const y = 30 - ((p.heightM - minH) / range) * 26;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");

  // Split at pivot for past (grey) vs future (accent)
  const pastPath = allPts.slice(0, pivotX + 1).map((p, i) => {
    const x = (i / Math.max(1, totalPts - 1)) * 240;
    const y = 30 - ((p.heightM - minH) / range) * 26;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");

  const futurePath = allPts.slice(pivotX).map((p, i) => {
    const x = ((pivotX + i) / Math.max(1, totalPts - 1)) * 240;
    const y = 30 - ((p.heightM - minH) / range) * 26;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");

  const snColor = SPRING_NEAP_COLOR[data.springNeap] ?? "var(--data)";

  void sparkPath; // built but split; use pastPath + futurePath

  return (
    <div className="col" style={{ gap: 6 }}>
      <PanelHeader
        title="TIDAL PREDICTION // SI RACHA STATION"
        ageMinutes={ageMinutes}
        fallbackTier={fallbackTier}
        source={source ?? "open-meteo-tides"}
        actions={
          <span className="eyebrow mono" style={{ color: snColor }}>
            {data.springNeap.toUpperCase()}
          </span>
        }
      />

      {/* Current height + moon */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div>
          <div className="eyebrow">NOW</div>
          <div className="mono" style={{ fontSize: "var(--size-h2)", color: "var(--accent)" }}>
            {data.heightM.toFixed(2)}<span style={{ fontSize: "var(--size-body)", opacity: 0.7 }}> m</span>
          </div>
          <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>
            {data.rising ? "↑ RISING" : "↓ FALLING"}
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div className="eyebrow">MOON</div>
          <div style={{ fontSize: "var(--size-h2)", lineHeight: 1 }}>{moonEmoji(data.moonPhase)}</div>
          <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>{data.moonPhaseName}</div>
        </div>
      </div>

      {/* Next high + low */}
      <div className="marine-detail-grid">
        {data.nextHigh && (
          <div>
            <div className="eyebrow">NEXT HIGH</div>
            <div className="mono">{data.nextHigh.heightM.toFixed(2)} m</div>
            <div className="eyebrow mono" style={{ color: "var(--accent)" }}>
              in {fmtCountdown(data.nextHigh.hoursFromNow)}
            </div>
          </div>
        )}
        {data.nextLow && (
          <div>
            <div className="eyebrow">NEXT LOW</div>
            <div className="mono">{data.nextLow.heightM.toFixed(2)} m</div>
            <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>
              in {fmtCountdown(data.nextLow.hoursFromNow)}
            </div>
          </div>
        )}
        <div>
          <div className="eyebrow">TIDAL RANGE</div>
          <div className="mono">{(maxH - minH).toFixed(2)} m</div>
          <div className="eyebrow mono" style={{ color: snColor }}>
            {data.springTide ? "⚠ SPRING — flood risk" : "normal"}
          </div>
        </div>
        <div>
          <div className="eyebrow">CHART DATUM</div>
          <div className="mono">{minH.toFixed(2)} m</div>
          <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>lowest in range</div>
        </div>
      </div>

      {/* Sparkline: past 12h (grey) + next 24h (amber) */}
      <div>
        <div className="eyebrow">TIDE CURVE · PAST 12H → NEXT 24H</div>
        <svg viewBox="0 0 240 32" width="100%" height="32" style={{ display: "block" }}>
          {/* Reference lines */}
          <line x1="0" y1="31" x2="240" y2="31" stroke="var(--line)" strokeWidth="0.5" />
          {/* Vertical "now" marker */}
          <line
            x1={((pivotX / Math.max(1, totalPts - 1)) * 240).toFixed(1)}
            y1="0"
            x2={((pivotX / Math.max(1, totalPts - 1)) * 240).toFixed(1)}
            y2="32"
            stroke="var(--text-3)"
            strokeWidth="0.7"
            strokeDasharray="2,2"
          />
          {/* Past: grey dim */}
          {pastPath && <path d={pastPath} fill="none" stroke="var(--text-3)" strokeWidth="1.2" />}
          {/* Future: amber accent */}
          {futurePath && <path d={futurePath} fill="none" stroke="var(--accent)" strokeWidth="1.5" />}
        </svg>
      </div>

      <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>
        HARMONIC · {data.chartDatumNote}
      </div>
    </div>
  );
}
