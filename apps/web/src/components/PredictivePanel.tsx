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

import { useEffect, useMemo, useRef, useState } from "react";
import type { LayerId } from "../map/presets";
import { PanelHeader } from "./PanelHeader";

interface ForecastPoint {
  time: string;
  p50: number;
  p10: number | null;
  p90: number | null;
}

export interface ForecastMetric {
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

/** Maps each forecast metric to the map layers it should enable when clicked. */
export const METRIC_LAYER_MAP: Record<string, { layers: LayerId[]; flyToCoast?: boolean }> = {
  "precipitation.forecast": { layers: ["satellite-imerg"] },
  "tideHeight.forecast":    { layers: ["ferry-terminals"], flyToCoast: true },
  "incidentRate.forecast":  { layers: ["incidents-city-reports"] },
  "aqi.forecast":           { layers: ["satellite-aerosol", "satellite-no2"] },
  "vesselCount.forecast":   { layers: ["ais-vessels"] },
};

/** Human-readable metric names for the ForecastAlertBadge. */
export const METRIC_LABEL: Record<string, string> = {
  "precipitation.forecast": "RAIN",
  "tideHeight.forecast":    "TIDE",
  "incidentRate.forecast":  "INCIDENTS",
  "aqi.forecast":           "AQI",
  "vesselCount.forecast":   "VESSELS",
};

interface Props {
  apiBase: string;
  onMetricClick?: (metric: string) => void;
  onAlert?: (metric: string) => void;
  onForecastsLoaded?: (forecasts: ForecastMetric[]) => void;
  ageMinutes?: number | null;
  fallbackTier?: import("@chonburi/shared").FallbackTier;
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
        stroke={isAlert ? "var(--warn, #d97706)" : "rgba(255,255,255,0.55)"}
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

export function PredictivePanel({ apiBase, onMetricClick, onAlert, onForecastsLoaded, ageMinutes, fallbackTier }: Props) {
  const [data, setData] = useState<PredictionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track which alert metrics have already been reported to avoid re-firing on polls
  const reportedAlerts = useRef<Set<string>>(new Set());

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
          if (!active) return;
          setData(d);
          setLoading(false);
          setError(null);
          onForecastsLoaded?.(d.forecasts);
          // Fire alert callbacks for newly-breached thresholds
          if (onAlert) {
            for (const fm of d.forecasts) {
              const isAlert = fm.horizon.length > 0 &&
                Math.max(...fm.horizon.map((p) => p.p50)) > fm.alertThreshold;
              if (isAlert && !reportedAlerts.current.has(fm.metric)) {
                reportedAlerts.current.add(fm.metric);
                onAlert(fm.metric);
              }
            }
          }
        })
        .catch((e: Error) => {
          if (active) { setError(e.message); setLoading(false); }
        });
    };
    fetch_();
    const id = window.setInterval(fetch_, 5 * 60_000); // refresh every 5 min
    return () => { active = false; window.clearInterval(id); };
  }, [apiBase, onAlert, onForecastsLoaded]);

  const hasAnyData = useMemo(
    () => data?.forecasts.some((f) => f.horizon.length > 0),
    [data]
  );

  return (
    <div className="col predictive-panel">
      <PanelHeader
        title="PREDICTIVE INTELLIGENCE"
        ageMinutes={ageMinutes}
        fallbackTier={fallbackTier}
        source="timesfm·zs"
      />

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
        const clickable = !!onMetricClick;
        return (
          <div
            key={fm.metric}
            className={`forecast-strip${clickable ? " forecast-strip-clickable" : ""}`}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={clickable ? `Enable ${fm.label} on map` : undefined}
            onClick={clickable ? () => onMetricClick(fm.metric) : undefined}
            onKeyDown={clickable ? (e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onMetricClick(fm.metric); }
            } : undefined}
          >
            <div className="forecast-header">
              <span className="forecast-label mono">{fm.label}</span>
              {isAlert && (
                <span className="forecast-alert-chip mono">
                  ▲ {fm.alertThreshold}{fm.unit}
                </span>
              )}
              <span className="forecast-peak mono">{peakLabel(fm.horizon, fm.unit)}</span>
              {clickable && (
                <span className="eyebrow mono" style={{ color: "var(--text-3)", marginLeft: "auto" }}>
                  →MAP
                </span>
              )}
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
