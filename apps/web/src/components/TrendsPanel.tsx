import { useMemo, useState } from "react";
import { safeUrl } from "../lib/safeUrl";

interface TrendPoint { time: string; value: number }
interface RelatedQuery { query: string; value: number; link?: string | null }

export interface TrendsSnapshot {
  lang: "en" | "th" | "zh-CN";
  keyword: string;
  geo: string;
  interestOverTime: TrendPoint[];
  relatedTop: RelatedQuery[];
  relatedRising: RelatedQuery[];
  fetchedAt: string;
  err?: string;
}

interface Props {
  snapshots: TrendsSnapshot[];
  loading: boolean;
  ageMinutes: number;
  onRefresh: () => void;
}

const LANGS: Array<{ id: TrendsSnapshot["lang"]; label: string }> = [
  { id: "en",    label: "EN" },
  { id: "th",    label: "TH" },
  { id: "zh-CN", label: "CN" },
];

/**
 * Trends panel — top of the right rail. Shows what people are searching for
 * around the active "Chula" keyword in each language, with the past-90-day
 * interest curve as a tiny sparkline.
 */
export function TrendsPanel({ snapshots, loading, ageMinutes, onRefresh }: Props) {
  const [lang, setLang] = useState<TrendsSnapshot["lang"]>("en");
  const active = useMemo(
    () => snapshots.find((s) => s.lang === lang) ?? snapshots[0] ?? null,
    [snapshots, lang],
  );

  const sparkline = useMemo(() => {
    if (!active?.interestOverTime?.length) return null;
    const values = active.interestOverTime.map((p) => p.value);
    const maxV = Math.max(...values, 1);
    const w = 280;
    const h = 36;
    const denom = Math.max(1, values.length - 1);
    const pts = values
      .map((v, i) => {
        const x = (i / denom) * w;
        const y = h - (v / maxV) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    const peak = Math.max(...values);
    const last = values[values.length - 1];
    return { pts, w, h, peak, last };
  }, [active]);

  return (
    <section className="trends-panel">
      <header className="trends-head">
        <div className="trends-tag">
          <span className="eyebrow mono">Trends · #Chula · 90 d</span>
          {active && <span className="trends-keyword">{active.keyword}</span>}
        </div>
        <button
          type="button"
          className="trends-refresh mono"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh trends"
          title={`Refreshed ${ageMinutes}m ago — click to refresh`}
        >
          {loading ? "…" : "↻"}
        </button>
      </header>

      <div className="trends-lang">
        {LANGS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLang(l.id)}
            className={`trends-lang-btn mono ${lang === l.id ? "active" : ""}`}
            aria-pressed={lang === l.id}
          >
            {l.label}
          </button>
        ))}
      </div>

      {active ? (
        <>
          {sparkline ? (
            <div className="trends-spark">
              <svg viewBox={`0 0 ${sparkline.w} ${sparkline.h}`} aria-hidden="true">
                <polyline
                  points={sparkline.pts}
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                  fill="none"
                />
              </svg>
              <div className="trends-spark-foot mono">
                <span>peak {sparkline.peak}</span>
                <span>now {sparkline.last}</span>
              </div>
            </div>
          ) : (
            <div className="trends-empty">
              {active.err
                ? `Trends unavailable: ${active.err}`
                : "No interest data yet — refresh to retry."}
            </div>
          )}

          {active.relatedTop.length > 0 && (
            <div>
              <div className="eyebrow mono trends-section-label">Top related</div>
              <ul className="trends-related">
                {active.relatedTop.slice(0, 6).map((q, i) => (
                  <li key={`top-${q.query}-${i}`}>
                    <a
                      href={safeUrl(q.link) ?? `https://trends.google.com/trends/explore?q=${encodeURIComponent(q.query)}`}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <span className="trends-q">{q.query}</span>
                      <span className="trends-v mono">{q.value}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {active.relatedRising.length > 0 && (
            <div>
              <div className="eyebrow mono trends-section-label">Rising ↑</div>
              <ul className="trends-related">
                {active.relatedRising.slice(0, 6).map((q, i) => (
                  <li key={`rise-${q.query}-${i}`}>
                    <a
                      href={safeUrl(q.link) ?? `https://trends.google.com/trends/explore?q=${encodeURIComponent(q.query)}`}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <span className="trends-q">{q.query}</span>
                      <span className="trends-v mono trends-v-rise">
                        {q.value >= 5000 ? "Breakout" : `+${q.value}%`}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="trends-empty">Loading Google Trends…</div>
      )}
    </section>
  );
}
