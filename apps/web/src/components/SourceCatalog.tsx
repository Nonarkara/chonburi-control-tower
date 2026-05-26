import { useEffect, useMemo, useState } from "react";
import { SOURCE_CATALOG, type SourceCategory, type SourceEntry, type SourceStatus, type AdapterHealth } from "@chonburi/shared";

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

/**
 * Map an apiPath ending segment / pattern → adapter name used by /api/health/detailed.
 * Adapter names come from the second arg of `safeFeed(c, fn, "adapter-name")` in apps/api/src/index.ts.
 * Keep this in sync when new routes are added.
 */
const API_PATH_TO_ADAPTER: Array<[RegExp, string]> = [
  [/\/api\/incidents\/city-reports$/, "city-reports"],
  [/\/api\/incidents\/itic$/, "itic"],
  [/\/api\/news$/, "news"],
  [/\/api\/weather$/, "weather"],
  [/\/api\/precip-nowcast$/, "precip-nowcast"],
  [/\/api\/air-quality$/, "air-quality"],
  [/\/api\/air-quality\/trend$/, "air-quality-trend"],
  [/\/api\/air-quality\/aqicn$/, "aqicn"],
  [/\/api\/cctv\/longdo$/, "cctv"],
  [/\/api\/trends$/, "trends"],
  [/\/api\/datago\/datasets$/, "datago-datasets"],
  [/\/api\/datago\/reservoirs$/, "reservoirs"],
  [/\/api\/datago\/disasters$/, "disasters"],
  [/\/api\/datago\/fahfon$/, "fahfon"],
  [/\/api\/marine$/, "marine"],
  [/\/api\/tides$/, "tides"],
  [/\/api\/gistda\/poi$/, "gistda-poi"],
  [/\/api\/gistda\/solar$/, "gistda-solar"],
  [/\/api\/gistda\/landuse$/, "gistda-landuse"],
  [/\/api\/nasa\/earth-readings$/, "nasa-power"],
  [/\/api\/social\/facebook$/, "facebook"],
  [/\/api\/markets$/, "markets"],
  [/\/api\/maritime\/ais$/, "ais"],
];

function adapterNameFor(apiPath: string | undefined): string | null {
  if (!apiPath) return null;
  for (const [re, name] of API_PATH_TO_ADAPTER) if (re.test(apiPath)) return name;
  return null;
}

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

interface HealthPayload {
  system: { status: string; healthy: number; degraded: number; down: number; total: number };
  adapters: AdapterHealth[];
}

interface Props { open: boolean; onClose: () => void }

export function SourceCatalog({ open, onClose }: Props) {
  const [filter, setFilter] = useState<"all" | SourceStatus>("all");
  const [health, setHealth] = useState<HealthPayload | null>(null);

  // Fetch detailed adapter health when the modal opens. Refetch every 60 s while open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health/detailed`);
        if (!res.ok) return;
        const json = (await res.json()) as HealthPayload;
        if (!cancelled) setHealth(json);
      } catch {
        // Silent — health surface is best-effort
      }
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [open]);

  const healthByAdapter = useMemo(() => {
    const map = new Map<string, AdapterHealth>();
    for (const a of health?.adapters ?? []) map.set(a.name, a);
    return map;
  }, [health]);

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

  const sysStatus = health?.system;

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

        {/* Runtime adapter health — distinguish "configured live" from "actually working" */}
        {sysStatus && (
          <div className="modal-summary mono" role="status" aria-live="polite">
            <span style={{ color: "var(--text-3)" }}>RUNTIME ·</span>
            <span style={{ color: "var(--good)" }}>{sysStatus.healthy} healthy</span>
            {sysStatus.degraded > 0 && <span style={{ color: "var(--warn)" }}>{sysStatus.degraded} degraded</span>}
            {sysStatus.down > 0 && <span style={{ color: "var(--bad)" }}>{sysStatus.down} down</span>}
            <span style={{ color: "var(--text-3)" }}>· of {sysStatus.total} tracked</span>
          </div>
        )}

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
                {items.map((s) => {
                  const adapter = adapterNameFor(s.apiPath);
                  const h = adapter ? healthByAdapter.get(adapter) : null;
                  const isMissingKey = h?.lastErrorMessage?.startsWith("Missing ") ?? false;
                  return (
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
                          {h && h.status !== "healthy" && h.status !== "unknown" && (
                            <span
                              className={`mono caption ${h.status === "down" ? "data-age--crit" : "data-age--warn"}`}
                              title={h.lastErrorMessage ?? `Adapter status: ${h.status}`}
                              style={{ marginLeft: 8 }}
                            >
                              {isMissingKey ? `⚠ KEY MISSING${s.keyEnv ? ` · ${s.keyEnv}` : ""}` : `⚠ ${h.status.toUpperCase()}`}
                            </span>
                          )}
                        </div>
                        <div className="caption" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.describe}
                        </div>
                        <div className="catalog-meta mono caption">
                          {s.apiPath && <span>api {s.apiPath}</span>}
                          {s.endpoint && !s.apiPath && <span>upstream {s.endpoint.replace(/^https?:\/\//, "").slice(0, 56)}</span>}
                          {s.pollSeconds && <span>poll {s.pollSeconds}s</span>}
                          {s.keyEnv && <span>key {s.keyEnv}</span>}
                          {h && h.consecutiveFailures > 0 && (
                            <span style={{ color: "var(--bad)" }}>
                              {h.consecutiveFailures} consec. {h.consecutiveFailures === 1 ? "failure" : "failures"}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
