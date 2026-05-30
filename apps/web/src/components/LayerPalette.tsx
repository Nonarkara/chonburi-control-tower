import { useMemo, useState } from "react";
import type { FallbackTier } from "@chonburi/shared";
import {
  ALL_LAYERS,
  COMPUTED_LAYERS,
  LAYER_GROUP_LABEL,
  LENSES,
  satelliteFreshness,
  type LayerGroup,
  type LayerId,
  type LensId,
} from "../map/presets";

/** Per-layer health for the subset of toggles backed by a live feed. Lets the
 *  palette show *why* a layer is empty — "needs key" vs simply no features —
 *  instead of a silent dead toggle. */
export interface LayerStatus {
  tier?: FallbackTier | "loading";
  note?: string;
}

interface Props {
  lens: LensId;
  onLensChange: (l: LensId) => void;
  enabled: Set<LayerId>;
  onToggleLayer: (id: LayerId) => void;
  /** Feature counts per layer — when present, shown next to each label so
   *  the operator immediately sees "AIS 0" vs "AIS 14" without looking at the map. */
  counts?: Partial<Record<LayerId, number>>;
  /** Feed health per layer — drives the "needs key" pill on degraded feeds. */
  statuses?: Partial<Record<LayerId, LayerStatus>>;
}

const GROUP_ORDER: LayerGroup[] = ["municipality", "maritime", "mobility", "incidents", "open-data", "environment", "imagery"];

export function LayerPalette({ lens, onLensChange, enabled, onToggleLayer, counts, statuses }: Props) {
  // group → list of layers (preserve declaration order within each group)
  const grouped = useMemo(() => {
    const m = new Map<LayerGroup, typeof ALL_LAYERS>();
    for (const g of GROUP_ORDER) m.set(g, []);
    for (const l of ALL_LAYERS) m.get(l.group)?.push(l);
    return m;
  }, []);

  const [collapsed, setCollapsed] = useState<Record<LayerGroup, boolean>>(() => ({
    municipality: false,
    maritime: false,
    mobility: false,
    incidents: true,
    "open-data": true,
    environment: true,
    imagery: true,
  }));
  const toggleGroup = (g: LayerGroup) => setCollapsed((c) => ({ ...c, [g]: !c[g] }));

  const enabledByGroup = (g: LayerGroup) =>
    (grouped.get(g) ?? []).filter((l) => enabled.has(l.id)).length;

  return (
    <div className="col">
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Lens</div>
        <div className="lens">
          {LENSES.map((l) => (
            <button
              key={l.id}
              onClick={() => onLensChange(l.id)}
              aria-pressed={lens === l.id}
              className={lens === l.id ? "active" : ""}
              title={l.describe}
              aria-label={l.describe}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="lens-explainer caption">
          {LENSES.find((l) => l.id === lens)?.describe}
        </div>
      </div>

      <hr className="divider" />

      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Layers</div>
        <p className="caption" style={{ marginBottom: 12, opacity: 0.8, lineHeight: 1.4 }}>Toggle spatial data layers. Layers actively updating from APIs show feature counts.</p>
        <div className="layer-groups">
          {GROUP_ORDER.map((g) => {
            const list = grouped.get(g) ?? [];
            if (list.length === 0) return null;
            const on = enabledByGroup(g);
            const isCollapsed = collapsed[g];
            return (
              <section key={g} className={`layer-group ${isCollapsed ? "is-collapsed" : ""}`}>
                <button
                  type="button"
                  className="layer-group-head"
                  onClick={() => toggleGroup(g)}
                  aria-expanded={!isCollapsed}
                  aria-label={`${LAYER_GROUP_LABEL[g]} layers (${on} of ${list.length} on)`}
                >
                  <span className="layer-group-name mono">{LAYER_GROUP_LABEL[g]}</span>
                  <span className="layer-group-meta mono">{on}/{list.length}</span>
                  <span className="layer-group-chevron mono">{isCollapsed ? "▸" : "▾"}</span>
                </button>
                {!isCollapsed && (
                  <div className="layer-toggles">
                    {list.map((l) => {
                      const isOn = enabled.has(l.id);
                      const status = statuses?.[l.id];
                      const needsKey = status?.tier === "unavailable";
                      const freshness = satelliteFreshness(l.id);
                      const fullTitle = freshness
                        ? `${l.describe}\n\nImagery date: ${freshness.date} (${freshness.label})`
                        : l.describe;
                      return (
                        <button
                          type="button"
                          key={l.id}
                          className={`layer-toggle ${isOn ? "on" : "off"}`}
                          role="checkbox"
                          aria-checked={isOn}
                          title={fullTitle}
                          aria-label={`${l.label} — ${l.describe}`}
                          onClick={() => onToggleLayer(l.id)}
                        >
                          <span className="row">
                            <span className="swatch" style={{ background: l.swatch }} />
                            <span>{l.label}</span>
                          </span>
                          <span className="row" style={{ gap: 6 }}>
                            {freshness && (
                              <span className="mono caption layer-age" title={`Imagery date: ${freshness.date}`}>
                                {freshness.label}
                              </span>
                            )}
                            {/* Degraded feed (e.g. missing API key) — say so explicitly instead of a
                                silent "0" that looks like a bug. The note explains what's wrong. */}
                            {needsKey ? (
                              <span
                                className="mono caption layer-needs-key"
                                title={status?.note ?? "Feed unavailable — check API key / connectivity"}
                              >
                                needs key
                              </span>
                            ) : /* Computed/decorative layers have no feature collection — a "0" count would
                                falsely suggest a failed feed. Fall back to on/off for those. */
                            !COMPUTED_LAYERS.has(l.id) && counts != null && counts[l.id] != null ? (
                              <span
                                className={`mono caption layer-count ${counts[l.id]! > 0 ? "layer-count-ok" : "layer-count-zero"}`}
                                title={`${counts[l.id]!.toLocaleString()} features loaded`}
                              >
                                {counts[l.id]!.toLocaleString()}
                              </span>
                            ) : (
                              <span className="mono caption">{isOn ? "on" : "off"}</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
