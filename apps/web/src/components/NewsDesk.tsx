import type { IntelligenceItem } from "@chonburi/shared";
import { safeUrl } from "../lib/safeUrl";

function ago(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const ms = Date.now() - t;
  const m = Math.round(ms / 60000);
  if (m < 1) return "NOW";
  if (m < 60) return `${m}M`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}H`;
  return `${Math.round(h / 24)}D`;
}

function scoreColor(score: number): string {
  if (score >= 1000) return "var(--bad)";
  if (score >= 500)  return "var(--warn)";
  return "var(--text-3)";
}

interface Props {
  items: IntelligenceItem[];
  loading: boolean;
  ageMinutes?: number;
  onRefresh?: () => void;
}

export function NewsDesk({ items, loading, ageMinutes, onRefresh }: Props) {
  if (loading && items.length === 0) {
    return (
      <div className="col">
        <div className="eyebrow">INTEL FEED // CAMPUS</div>
        <div className="skeleton" style={{ height: 10, marginTop: 8 }} />
        <div className="skeleton" style={{ height: 10, width: "80%", marginTop: 6 }} />
        <div className="skeleton" style={{ height: 10, width: "60%", marginTop: 6 }} />
      </div>
    );
  }

  return (
    <div className="col">
      <div className="spread news-head-row">
        <span className="eyebrow">INTEL FEED // CAMPUS</span>
        <span className="news-count-cluster">
          <span className="news-count mono">{String(items.length).padStart(3, "0")}</span>
          {onRefresh && (
            <button
              type="button"
              className="news-refresh mono"
              onClick={onRefresh}
              disabled={loading}
              title={ageMinutes != null ? `Refreshed ${ageMinutes}m ago — click to refresh` : "Refresh"}
              aria-label="Refresh news"
            >
              {loading ? "…" : "↻"}
            </button>
          )}
        </span>
      </div>
      <div>
        {items.slice(0, 12).map((it, i) => (
          <a key={it.id} href={safeUrl(it.sourceUrl) ?? "#"} target="_blank" rel="noreferrer noopener" className="news-item">
            <div className="news-header">
              <span className="news-ref mono">[{String(i + 1).padStart(3, "0")}]</span>
              <span className="news-score mono" style={{ color: scoreColor(it.score) }}>
                REL·{it.score}
              </span>
            </div>
            <div className="title">{it.title}</div>
            <div className="meta">
              <span>{it.source.toUpperCase()}</span>
              <span>·</span>
              <span className="mono">{ago(it.publishedAt)}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
