import type { IntelligenceItem } from "@chonburi/shared";
import { safeUrl } from "../lib/safeUrl";
import { PanelHeader } from './PanelHeader';
import { ago } from "../lib/time";
import { scoreColor } from "../lib/newsDesk";

// Mayor's Action tag legend — 2-char code → short label, colour, glyph
// Colours use CSS token variables defined in tokens.css.
const ACTION_TAG: Record<string, { label: string; color: string; glyph: string; do: string }> = {
  EM: { label: "Emergency",        color: "var(--bad)",         glyph: "▲", do: "go to scene / coordinate response" },
  FU: { label: "Funeral",          color: "var(--tag-funeral)", glyph: "✚", do: "attend or send wreath" },
  PO: { label: "Police friction",  color: "var(--tag-police)",  glyph: "◆", do: "consider mediation" },
  HO: { label: "Honour",           color: "var(--good)",        glyph: "★", do: "congratulate" },
  FE: { label: "Festival",         color: "var(--tag-festival)",glyph: "✦", do: "attend opening" },
  IN: { label: "Infrastructure",   color: "var(--data)",        glyph: "▣", do: "chase department" },
  BZ: { label: "EEC / Business",   color: "var(--accent)",      glyph: "◢", do: "attend signing" },
  PU: { label: "Public health",    color: "var(--tag-health)",  glyph: "✚", do: "visit / congratulate staff" },
};

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
        <div className="eyebrow">MAYOR&apos;S DESK // CHONBURI</div>
        <div className="skeleton" style={{ height: 10, marginTop: 8 }} />
        <div className="skeleton" style={{ height: 10, width: "80%", marginTop: 6 }} />
        <div className="skeleton" style={{ height: 10, width: "60%", marginTop: 6 }} />
      </div>
    );
  }

  // Split into actionable vs general — actionable items first
  const actionable = items.filter((it) => it.tags && it.tags.length > 0).slice(0, 8);
  const others = items.filter((it) => !it.tags || it.tags.length === 0).slice(0, 6);
  const visible = [...actionable, ...others].slice(0, 14);

  return (
    <div className="col">
      <PanelHeader
        title="MAYOR'S DESK // CHONBURI"
        ageMinutes={ageMinutes}
        actions={
          <span className="news-count-cluster">
            <span className="news-count mono" title={`${actionable.length} actionable / ${items.length} total`}>
              {String(actionable.length).padStart(2, "0")}<span style={{ opacity: 0.5 }}>/{String(items.length).padStart(3, "0")}</span>
            </span>
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
        }
      />
      <div>
        {visible.map((it, i) => (
          <a key={it.id} href={safeUrl(it.sourceUrl) ?? undefined} target="_blank" rel="noreferrer noopener" className="news-item">
            <div className="news-header">
              <span className="news-ref mono">[{String(i + 1).padStart(3, "0")}]</span>
              {(it.tags ?? []).map((t) => {
                const a = ACTION_TAG[t];
                if (!a) return null;
                return (
                  <span key={t} className="eyebrow mono action-chip" title={`${a.label} — ${a.do}`}
                    style={{ color: a.color, borderColor: a.color }}>
                    {a.glyph} {t}
                  </span>
                );
              })}
              <span className="news-score mono" style={{ color: scoreColor(it.score), marginLeft: "auto" }}>
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
        {visible.length === 0 && (
          <div className="caption" style={{ marginTop: 8, color: "var(--text-3)" }}>
            No headlines yet — refreshes every 3 min.
          </div>
        )}
      </div>
      {actionable.length > 0 && (
        <div className="eyebrow mono" style={{ marginTop: 8, color: "var(--text-3)" }}>
          ACTION LEGEND:&nbsp;
          ▲EM emergency · ✚FU funeral · ◆PO police · ★HO honour · ✦FE festival · ▣IN infra · ◢BZ business · ✚PU health
        </div>
      )}
    </div>
  );
}
