import { useMemo, useState } from "react";
import { SOURCE_CATALOG, type SourceCategory, type SourceEntry, type SourceStatus } from "@chula/shared";

const STATUS_COLOR: Record<SourceStatus, string> = {
  live: "var(--good)",
  ready: "var(--data)",
  planned: "var(--warn)",
  research: "var(--text-3)",
};

const CATEGORY_LABEL: Record<SourceCategory, string> = {
  mobility: "MOB",
  incidents: "INC",
  environment: "ENV",
  imagery: "IMG",
  vibes: "VIB",
  infrastructure: "INF",
  campus: "CMP",
};

interface Props { open: boolean; onClose: () => void }

export function SourceCatalog({ open, onClose }: Props) {
  const [filter, setFilter] = useState<"all" | SourceStatus>("all");

  const grouped = useMemo(() => {
    const list = filter === "all"
      ? SOURCE_CATALOG
      : SOURCE_CATALOG.filter((s) => s.status === filter);
    const map = new Map<SourceCategory, SourceEntry[]>();
    for (const s of list) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return [...map.entries()];
  }, [filter]);

  const counts = useMemo(() => {
    const c = { live: 0, ready: 0, planned: 0, research: 0 } as Record<SourceStatus, number>;
    for (const s of SOURCE_CATALOG) c[s.status]++;
    return c;
  }, []);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Source catalog">
        <header className="modal-head">
          <div className="col">
            <span className="eyebrow">Data pipelines</span>
            <h2 className="mono">SOURCE CATALOG · {SOURCE_CATALOG.length}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="mono">[ESC] CLOSE</button>
        </header>

        <div className="modal-summary mono">
          <span><span className="dot live" /> LIVE {counts.live}</span>
          <span><span className="dot cache" /> READY {counts.ready}</span>
          <span><span className="dot scenario" /> PLANNED {counts.planned}</span>
          <span><span className="dot unavailable" /> RESEARCH {counts.research}</span>
        </div>

        <div className="modal-filter">
          {(["all", "live", "ready", "planned", "research"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={filter === f ? "active mono" : "mono"}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {grouped.map(([cat, items]) => (
            <section key={cat} className="catalog-section">
              <header className="catalog-section-head">
                <span className="lcars-bar" />
                <span className="eyebrow mono">{CATEGORY_LABEL[cat]} · {cat}</span>
                <span className="mono caption">{items.length}</span>
              </header>
              <ul className="catalog-list">
                {items.map((s) => (
                  <li key={s.id} className="catalog-row">
                    <span
                      className="catalog-status mono"
                      style={{ background: STATUS_COLOR[s.status] }}
                      aria-label={s.status}
                    >
                      {s.status.toUpperCase()}
                    </span>
                    <div className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                      <div className="catalog-title">
                        <strong>{s.label}</strong>
                        <span className="caption">· {s.vendor}</span>
                      </div>
                      <div className="caption" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.describe}
                      </div>
                      <div className="catalog-meta mono caption">
                        {s.apiPath && <span>api {s.apiPath}</span>}
                        {s.endpoint && !s.apiPath && <span>upstream {s.endpoint.replace(/^https?:\/\//, "").slice(0, 56)}</span>}
                        {s.pollSeconds && <span>poll {s.pollSeconds}s</span>}
                        {s.keyEnv && <span>key {s.keyEnv}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
