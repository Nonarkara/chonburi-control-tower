import { maxAqiNext8h, fmtHour } from "../lib/aqi";

interface TrendPoint {
  at: string;
  aqi: number | null;
  pm25: number | null;
}

export interface AqiTrend {
  station: string;
  category: "good" | "moderate" | "unhealthy-sg" | "unhealthy" | "very-unhealthy" | "hazardous" | null;
  current: { aqi: number | null; pm25: number | null; observedAt: string };
  next8h: TrendPoint[];
  source: string;
}

interface Props {
  trend: AqiTrend | null;
  loading: boolean;
}

const BAND: Record<
  NonNullable<AqiTrend["category"]>,
  { color: string; label: string; advice: string }
> = {
  // Colours reference CSS tokens defined in tokens.css (US EPA standard scale).
  good:            { color: "var(--aqi-good)",           label: "GOOD",            advice: "Outdoor activity normal." },
  moderate:        { color: "var(--aqi-moderate)",       label: "MODERATE",        advice: "Sensitive groups: limit prolonged outdoor exertion." },
  "unhealthy-sg":  { color: "var(--aqi-unhealthy-sg)",   label: "UNHEALTHY · SG",  advice: "Sensitive groups should reduce outdoor activity." },
  unhealthy:       { color: "var(--aqi-unhealthy)",      label: "UNHEALTHY",       advice: "Everyone: reduce outdoor exertion. Masks recommended." },
  "very-unhealthy":{ color: "var(--aqi-very-unhealthy)", label: "VERY UNHEALTHY",  advice: "Avoid outdoor exertion. N95 masks outdoors." },
  hazardous:       { color: "var(--aqi-hazardous)",      label: "HAZARDOUS",       advice: "Stay indoors. Run filtration. Cancel outdoor events." },
};

export function AqiBadge({ trend, loading }: Props) {
  if (loading || !trend || trend.current.aqi == null || trend.category == null) {
    return (
      <div className="aqi-badge" aria-busy={loading}>
        <div className="aqi-bar" style={{ background: "var(--line-2)" }} />
        <div className="aqi-readout">
          <div className="eyebrow mono">AIR QUALITY · US AQI</div>
          <div className="aqi-num skeleton" style={{ width: 90, height: 56 }} />
          <div className="caption mono" style={{ color: "var(--text-3)" }}>
            {loading ? "Connecting…" : "Unavailable"}
          </div>
        </div>
      </div>
    );
  }

  const band = BAND[trend.category];
  const peak = maxAqiNext8h(trend);
  const trending = peak - trend.current.aqi;
  const trendArrow = trending >= 4 ? "▲" : trending <= -4 ? "▼" : "→";
  const trendDir = trending >= 4 ? "rising" : trending <= -4 ? "falling" : "stable";
  const trendColor = trending >= 4 ? "var(--bad)" : trending <= -4 ? "var(--good)" : "var(--text-2)";

  // Sparkline for next8h (current + 8 points)
  const series = [trend.current.aqi, ...trend.next8h.map((p) => p.aqi)].filter((v): v is number => v != null);
  const maxVal = Math.max(...series, 50);
  const minVal = Math.min(...series, 0);
  const span = Math.max(1, maxVal - minVal);
  const w = 200;
  const h = 32;
  const pts = series
    .map((v, i) => {
      const x = series.length > 1 ? (i / (series.length - 1)) * w : w / 2;
      const y = h - ((v - minVal) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <section
      className="aqi-badge"
      role="status"
      aria-label={`Air quality ${band.label}, AQI ${trend.current.aqi}`}
      style={{ ["--aqi-color" as never]: band.color }}
    >
      <div className="aqi-bar" />
      <div className="aqi-readout">
        <div className="aqi-head">
          <span className="eyebrow mono">AIR QUALITY · US AQI</span>
          <span className="aqi-band mono">{band.label}</span>
        </div>
        <div className="aqi-row">
          <div className="aqi-num" style={{ color: band.color }}>
            {Math.round(trend.current.aqi)}
          </div>
          <div className="aqi-stats mono">
            <div>
              <span className="caption">PM2.5</span>
              <strong>{(trend.current.pm25 ?? 0).toFixed(1)}</strong>
              <span className="caption" style={{ textTransform: "none" }}>µg/m³</span>
            </div>
            <div>
              <span className="caption">PEAK 8H</span>
              <strong style={{ color: trendColor }}>{Math.round(peak)}</strong>
              <span style={{ color: trendColor }} aria-label={trendDir}>{trendArrow}</span>
            </div>
          </div>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="aqi-spark" aria-hidden="true">
          <polyline points={pts} stroke={band.color} strokeWidth="1.5" fill="none" />
          <line x1="0" y1={h - ((100 - minVal) / span) * h} x2={w} y2={h - ((100 - minVal) / span) * h}
                stroke="var(--line-2)" strokeWidth="0.5" strokeDasharray="2 2" />
        </svg>
        <div className="aqi-foot">
          <span className="caption">{trend.station}</span>
          <span className="caption mono">{fmtHour(trend.current.observedAt)}</span>
        </div>
        <div className="aqi-advice">{band.advice}</div>
      </div>
    </section>
  );
}
