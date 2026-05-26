import { useMemo, useState } from "react";
import { SOURCE_CATALOG, type SourceCategory, type SourceEntry, type SourceStatus } from "@chonburi/shared";

const STATUS_COLOR: Record<SourceStatus, string> = {
  live: "var(--good)",
  ready: "var(--data)",
  planned: "var(--warn)",
  research: "var(--text-3)",
  stub: "var(--text-3)",
};

const CATEGORY_LABEL: Record<SourceCategory, string> = {
  mobility: "MOB",
  incidents: "INC",
  environment: "ENV",
  imagery: "IMG",
  vibes: "VIB",
  infrastructure: "INF",
  maritime: "MAR",
  "open-data": "OPN",
  campus: "LEG",
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
    const c = { live: 0, ready: 0, planned: 0, research: 0, stub: 0 } as Record<SourceStatus, number>;
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
          <button onClick={onClose} aria-label="Close source catalog" className="mono">[ESC] CLOSE</button>
        </header>

        <div className="modal-summary mono">
          <span><span className="dot live" /> LIVE {counts.live}</span>
          <span><span className="dot cache" /> READY {counts.ready}</span>
          <span><span className="dot scenario" /> PLANNED {counts.planned}</span>
          <span><span className="dot unavailable" /> RESEARCH {counts.research}</span>
          {counts.stub > 0 && <span><span className="dot unavailable" /> STUB {counts.stub}</span>}
        </div>

        <div className="modal-filter">
          {(["all", "live", "ready", "planned", "research", "stub"] as const).map((f) => (
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

        <div className="modal-standards">
          <header className="catalog-section-head">
            <span className="lcars-bar" />
            <span className="eyebrow mono">FRAMEWORK ALIGNMENT</span>
          </header>
          <div className="standards-grid mono">
            <div className="standard-card">
              <div className="standard-title">UNDP · JTC</div>
              <div className="standard-subtitle">Digital Twins for Cities, Jul 2025</div>
              <div className="standard-badge">LEVEL 2 — INFORMATIVE</div>
              <div className="standard-desc caption">
                Real-time multi-source feeds · 3D building fabric · Live sensor data ·
                Municipal ops dashboard · Citizen intelligence interface (ASK CTM).
                Next: Level 3 Predictive — wire twin_state time-series into trend models.
              </div>
            </div>
            <div className="standard-card">
              <div className="standard-title">ADB</div>
              <div className="standard-subtitle">Digital Twin Framework: A Practical Guide, May 2025</div>
              <div className="standard-badge">DIGITAL TWIN LITE · 4/5 FOUNDATIONS</div>
              <div className="standard-desc caption">
                ✓ F1 Data flow (AIS · weather · CCTV · GISTDA · news) ·
                ✓ F2 Dynamic 3D representation (20K buildings · satellite · vector layers) ·
                ✓ F3 Purpose-built (municipal ops + mayor's desk) ·
                ✓ F4 Continuous updates (3-min to 6-hr refresh per source) ·
                ◯ F5 Maturing insights — twin_state DB foundation ready, predictive models pending.
              </div>
            </div>
          </div>
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
