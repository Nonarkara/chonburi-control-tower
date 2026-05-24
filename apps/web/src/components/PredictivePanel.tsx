/**
 * PredictivePanel — TimesFM zero-shot forecast strips for 5 municipal metrics.
 *
 * Data source: /api/twin/predictions (Cloudflare Worker reads from twin_state
 * rows written by the Python forecast service every hour).
 *
 * Each metric row shows:
 *   • Metric label + horizon
 *   • Inline SVG sparkline with p10/p90 confidence band + p50 line
 *   • Amber alert chip when max forecast > threshold
 *   • "No data" fallback when the Python service hasn't run yet
 */

import { useEffect, useMemo, useState } from "react";

interface ForecastPoint {
  time: string;
  p50: number;
  p10: number | null;
  p90: number | null;
}

interface ForecastMetric {
  metric: string;
  label: string;
  unit: string;
  alertThreshold: number;
  generatedAt: string | null;
  horizon: ForecastPoint[];
}

interface PredictionsResponse {
  forecasts: ForecastMetric[];
  count: number;
}

interface Props {
  apiBase: string;
}

// Width × height of each sparkline SVG in px
const W = 120;
const H = 32;
const PAD = 2;

function Sparkline({ points, alertThreshold }: { points: ForecastPoint[]; alertThreshold: number }) {
  if (points.length < 2) return <span className="mono eyebrow" style={{ color: "var(--text-3)" }}>—</span>;

  const vals = points.map((p) => p.p50);
  const lo   = points.map((p) => p.p10 ?? p.p50);
  const hi   = points.map((p) => p.p90 ?? p.p50);

  const yMin = Math.min(...lo, 0);
  const yMax = Math.max(...hi, alertThreshold * 0.5);
  const yRange = yMax - yMin || 1;

  const xScale = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const yScale = (v: number) => H - PAD - ((v - yMin) / yRange) * (H - PAD * 2);

  // Confidence band polygon (p10 bottom, p90 top, clockwise)
  const bandPts = [
    ...points.map((p, i) => `${xScale(i)},${yScale(p.p90 ?? p.p50)}`),
    ...[...points].reverse().map((p, ri) => `${xScale(points.length - 1 - ri)},${yScale(p.p10 ?? p.p50)}`),
  ].join(" ");

  // p50 polyline
  const linePts = vals.map((v, i) => `${xScale(i)},${yScale(v)}`).join(" ");

  // Alert threshold line
  const threshY = yScale(alertThreshold);
  const isAlert = Math.max(...vals) > alertThreshold;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* Confidence band */}
      <polygon
        points={bandPts}
        fill={isAlert ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.06)"}
      />
      {/* Threshold line */}
      {threshY >= PAD && threshY <= H - PAD && (
        <line
          x1={PAD} y1={threshY} x2={W - PAD} y2={threshY}
          stroke={isAlert ? "var(--bad, #dc2626)" : "rgba(255,255,255,0.15)"}
          strokeWidth={0.5}
          strokeDasharray="2,2"
        />
      )}
      {/* p50 forecast line */}
      <polyline
        points={linePts}
        fill="none"
        stroke={isAlert ? "var(--warn, #f59e0b)" : "rgba(255,255,255,0.55)"}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatAge(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function peakLabel(points: ForecastPoint[], unit: string): string {
  if (!points.length) return "—";
  const peak = Math.max(...points.map((p) => p.p50));
  return `${peak.toFixed(1)}${unit ? " " + unit : ""} peak`;
}

export function PredictivePanel({ apiBase }: Props) {
  const [data, setData] = useState<PredictionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetch_ = () => {
      setLoading(true);
      fetch(`${apiBase}/api/twin/predictions`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<PredictionsResponse>;
        })
        .then((d) => {
          if (active) { setData(d); setLoading(false); setError(null); }
        })
        .catch((e: Error) => {
          if (active) { setError(e.message); setLoading(false); }
        });
    };
    fetch_();
    const id = window.setInterval(fetch_, 5 * 60_000); // refresh every 5 min
    return () => { active = false; window.clearInterval(id); };
  }, [apiBase]);

  const hasAnyData = useMemo(
    () => data?.forecasts.some((f) => f.horizon.length > 0),
    [data]
  );

  return (
    <div className="col predictive-panel">
      <div className="spread" style={{ alignItems: "center" }}>
        <span className="eyebrow">PREDICTIVE INTELLIGENCE</span>
        <span className="eyebrow mono" style={{ color: "var(--text-3)", fontSize: "0.58rem" }}>
          TIMESFM·ZS
        </span>
      </div>

      {loading && !data && (
        <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>LOADING …</div>
      )}

      {error && (
        <div className="eyebrow mono" style={{ color: "var(--warn)" }}>
          Forecast service offline · {error}
        </div>
      )}

      {!loading && !error && !hasAnyData && (
        <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>
          No forecast data yet — Python service has not run.<br />
          <span style={{ color: "var(--text-3)" }}>Deploy apps/forecast/ to Render to activate.</span>
        </div>
      )}

      {data?.forecasts.map((fm) => {
        if (!fm.horizon.length) return null;
        const isAlert = Math.max(...fm.horizon.map((p) => p.p50)) > fm.alertThreshold;
        return (
          <div key={fm.metric} className="forecast-strip">
            <div className="forecast-header">
              <span className="forecast-label mono">{fm.label}</span>
              {isAlert && (
                <span className="forecast-alert-chip mono">
                  ▲ {fm.alertThreshold}{fm.unit}
                </span>
              )}
              <span className="forecast-peak mono">{peakLabel(fm.horizon, fm.unit)}</span>
            </div>
            <div className="forecast-sparkline-row">
              <Sparkline points={fm.horizon} alertThreshold={fm.alertThreshold} />
              <span className="forecast-horizon-label mono">
                {fm.horizon.length}h
              </span>
            </div>
            {fm.generatedAt && (
              <div className="eyebrow mono" style={{ color: "var(--text-3)", marginTop: 1 }}>
                {formatAge(fm.generatedAt)}
              </div>
            )}
          </div>
        );
      })}

      <div className="eyebrow mono" style={{ color: "var(--text-3)", marginTop: 4 }}>
        GOOGLE TIMESFM 2.0 · 200M · ZERO-SHOT INFERENCE
      </div>
    </div>
  );
}
