import type { BuildingProperties } from "../map/layers";

interface Props {
  building: BuildingProperties | null;
  onClose: () => void;
}

/**
 * Right-anchored card showing the picked building's metadata.
 * Closes on backdrop click or ESC (wired in App.tsx).
 */
export function BuildingCard({ building, onClose }: Props) {
  if (!building) return null;
  const name = building.nameEn || building.name || building.nameTh || "Untitled building";
  const altName = building.nameTh && building.nameTh !== name ? building.nameTh : null;

  return (
    <aside className="building-card" role="dialog" aria-label={`Building: ${name}`}>
      <header className="building-card-head">
        <div>
          <span className="eyebrow mono">CHULA · BUILDING</span>
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
        <dd className="mono">{building.id}</dd>
      </dl>
    </aside>
  );
}
