import type { MapViewState } from "../map/presets";

interface MapOverlayControlsProps {
  mapViewState: MapViewState;
  onAerialOnly: () => void;
  onClearOverlays: () => void;
  onRestoreLens: () => void;
}

export function MapOverlayControls({
  mapViewState,
  onAerialOnly,
  onClearOverlays,
  onRestoreLens,
}: MapOverlayControlsProps) {
  const isCustom = mapViewState.kind === "custom";
  const label = isCustom ? (mapViewState as { kind: "custom"; label: string }).label : null;

  return (
    <div className="map-overlay-controls">
      {isCustom && label && (
        <span className="map-view-status" role="status" aria-live="polite">
          <span className="map-view-status-dot" />
          {label}
        </span>
      )}
      <div className="map-overlay-actions">
        {isCustom ? (
          <button
            onClick={onRestoreLens}
            aria-label="Restore default layers for the current lens"
            title="Restore lens"
          >
            RESTORE LENS
          </button>
        ) : (
          <>
            <button
              onClick={onAerialOnly}
              aria-label="Switch to aerial-only view — disables all data overlays"
              title="Aerial only"
            >
              AERIAL
            </button>
            <button
              onClick={onClearOverlays}
              aria-label="Clear all active map overlays"
              title="Clear overlays"
            >
              CLEAR
            </button>
          </>
        )}
      </div>
    </div>
  );
}
