import { useMemo, useState } from "react";
import {
  ALL_LAYERS,
  LAYER_GROUP_LABEL,
  LENSES,
  type LayerGroup,
  type LayerId,
  type LensId,
} from "../map/presets";

interface Props {
  lens: LensId;
  onLensChange: (l: LensId) => void;
  enabled: Set<LayerId>;
  onToggleLayer: (id: LayerId) => void;
}

const GROUP_ORDER: LayerGroup[] = ["municipality", "maritime", "mobility", "incidents", "open-data", "environment", "imagery"];

export function LayerPalette({ lens, onLensChange, enabled, onToggleLayer }: Props) {
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
                      return (
                        <div
                          key={l.id}
                          className={`layer-toggle ${isOn ? "on" : "off"}`}
                          role="checkbox"
                          aria-checked={isOn}
                          tabIndex={0}
                          title={l.describe}
                          aria-label={`${l.label} — ${l.describe}`}
                          onClick={() => onToggleLayer(l.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onToggleLayer(l.id);
                            }
                          }}
                        >
                          <span className="row">
                            <span className="swatch" style={{ background: l.swatch }} />
                            <span>{l.label}</span>
                          </span>
                          <span className="mono caption">{isOn ? "on" : "off"}</span>
                        </div>
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
