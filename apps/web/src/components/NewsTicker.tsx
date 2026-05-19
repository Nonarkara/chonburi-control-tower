import { useMemo } from "react";
import type { IntelligenceItem } from "@chonburi/shared";
import { safeUrl } from "../lib/safeUrl";

interface Props {
  items: IntelligenceItem[];
  loading: boolean;
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/**
 * Stock-market-style horizontal scrolling marquee.
 * Renders the top 10 news items twice in series so the CSS animation can
 * loop seamlessly (the second pass picks up where the first ends).
 * Animation duration is proportional to item count so reading speed stays
 * comfortable as the list grows.
 */
export function NewsTicker({ items, loading }: Props) {
  const top = useMemo(() => items.slice(0, 10), [items]);
  const seconds = Math.max(60, top.length * 14);

  if (loading || top.length === 0) {
    return (
      <div className="news-ticker">
        <span className="news-ticker-tag mono">LIVE · NEWS</span>
        <div className="news-ticker-track news-ticker-empty">
          <span className="caption">Loading Chonburi headlines…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="news-ticker" aria-label="Live news ticker">
      <span className="news-ticker-tag mono">LIVE · NEWS</span>
      <div
        className="news-ticker-track"
        style={{ animationDuration: `${seconds}s` }}
        aria-hidden={false}
      >
        {[0, 1].map((pass) => (
          <div className="news-ticker-pass" key={pass}>
            {top.map((it) => (
              <a
                key={`${pass}-${it.id}`}
                className="news-ticker-item"
                href={safeUrl(it.sourceUrl) ?? "#"}
                target="_blank"
                rel="noreferrer noopener"
                title={`${it.source} · ${ago(it.publishedAt)} ago`}
              >
                <span className="news-ticker-source mono">{it.source}</span>
                <span className="news-ticker-title">{it.title}</span>
                <span className="news-ticker-age mono">{ago(it.publishedAt)}</span>
              </a>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
