import { useMemo, useState } from "react";
import type { IntelligenceItem } from "@chonburi/shared";
import { safeUrl } from "../lib/safeUrl";
import { ago } from "../lib/time";

interface Props {
  items: IntelligenceItem[];
  loading: boolean;
}


/**
 * Stock-market-style horizontal scrolling marquee.
 * Renders the top 10 news items twice in series so the CSS animation can
 * loop seamlessly (the second pass picks up where the first ends).
 * Animation duration is proportional to item count so reading speed stays
 * comfortable as the list grows.
 */
export function NewsTicker({ items, loading }: Props) {
  const [paused, setPaused] = useState(false);
  const top = useMemo(() => items.slice(0, 10), [items]);
  const seconds = Math.max(60, top.length * 14);

  if (loading) {
    return (
      <div className="news-ticker">
        <span className="news-ticker-tag mono">LIVE · NEWS</span>
        <div className="news-ticker-track news-ticker-empty">
          <span className="caption">Loading Chonburi headlines…</span>
        </div>
      </div>
    );
  }

  if (top.length === 0) {
    return (
      <div className="news-ticker">
        <span className="news-ticker-tag mono">LIVE · NEWS</span>
        <div className="news-ticker-track news-ticker-empty">
          <span className="caption" style={{ color: "var(--text-3)" }}>No headlines available · retrying…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="news-ticker" aria-label="Live news headlines">
      <button
        className="mono news-ticker-pause eyebrow"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label={paused ? "Resume news ticker" : "Pause news ticker"}
        title={paused ? "Resume" : "Pause"}
      >
        {paused ? "▶" : "⏸"}
      </button>
      <span className="news-ticker-tag mono">LIVE · NEWS</span>
      <div
        className="news-ticker-track"
        style={{
          animationDuration: `${seconds}s`,
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        {[0, 1].map((pass) => (
          <div className="news-ticker-pass" key={pass}>
            {top.map((it) => (
              <a
                key={`${pass}-${it.id}`}
                className="news-ticker-item"
                href={safeUrl(it.sourceUrl) ?? undefined}
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
