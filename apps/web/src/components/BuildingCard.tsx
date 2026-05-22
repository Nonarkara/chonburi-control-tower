import type { BuildingProperties } from "../map/layers";
import { useTwinBuilding } from "../hooks/useTwinBuilding";
import { API_BASE } from "../lib/apiBase";

interface Props {
  building: BuildingProperties | null;
  onClose: () => void;
}

/**
 * Right-anchored card showing the picked building's metadata.
 * Enhanced with digital-twin data: related sensors + live state from the twin store.
 * Closes on backdrop click or ESC (wired in App.tsx).
 */
export function BuildingCard({ building, onClose }: Props) {
  if (!building) return null;
  const name = building.nameEn || building.name || building.nameTh || "Untitled building";
  const altName = building.nameTh && building.nameTh !== name ? building.nameTh : null;
  const osmId = building.id;

  // Query the semantic twin for this building
  const twin = useTwinBuilding(osmId);

  // Find sensors that monitor this building
  const sensors = twin.related.filter(
    (r) => r.object.kind === "sensor" && (r.relation.predicate === "monitors" || r.relation.predicate === "located_in"),
  );

  return (
    <aside className="building-card" role="dialog" aria-label={`Building: ${name}`}>
      <header className="building-card-head">
        <div>
          <span className="eyebrow mono">CHONBURI · BUILDING</span>
          <h3 className="building-card-title">{name}</h3>
          {altName && <div className="building-card-alt">{altName}</div>}
        </div>
        <button onClick={onClose} aria-label="Close" className="building-card-close mono">
          ESC
        </button>
      </header>
      <dl className="building-card-meta mono">
        {building.building && building.building !== "yes" && (
          <>
            <dt>TYPE</dt>
            <dd>{building.building}</dd>
          </>
        )}
        {building.levels != null && (
          <>
            <dt>LEVELS</dt>
            <dd>{building.levels}</dd>
          </>
        )}
        {building.height != null && (
          <>
            <dt>HEIGHT</dt>
            <dd>{building.height} m</dd>
          </>
        )}
        {building.operator && (
          <>
            <dt>OPERATOR</dt>
            <dd>{building.operator}</dd>
          </>
        )}
        <dt>OSM</dt>
        <dd className="mono">{osmId}</dd>
      </dl>

      {/* ── Digital Twin: Related Sensors ── */}
      {sensors.length > 0 && (
        <div className="building-card-section">
          <span className="eyebrow mono">SENSORS ({sensors.length})</span>
          <ul className="building-card-sensors mono">
            {sensors.map((s) => (
              <li key={s.object.id}>
                <span className="sensor-name">{s.object.name}</span>
                <span className="sensor-pred">{s.relation.predicate}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Digital Twin: Latest State ── */}
      {twin.state.length > 0 && (
        <div className="building-card-section">
          <span className="eyebrow mono">LIVE STATE</span>
          <div className="building-card-state">
            {twin.state.map((pt) => (
              <div key={`${pt.metric}-${pt.time}`} className="state-row mono">
                <span className="state-metric">{pt.metric}</span>
                <span className="state-value">{pt.value.toFixed(1)}</span>
                <span className="state-source">{pt.source}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {twin.loading && (
        <div className="building-card-loading mono">
          <span className="dot loading" /> Querying twin…
        </div>
      )}

      {/* Link to full twin object */}
      {twin.object && (
        <a
          href={`${API_BASE}/api/twin/objects/${encodeURIComponent(osmId)}`}
          target="_blank"
          rel="noreferrer"
          className="building-card-link mono"
        >
          Open in Twin API →
        </a>
      )}
    </aside>
  );
}
