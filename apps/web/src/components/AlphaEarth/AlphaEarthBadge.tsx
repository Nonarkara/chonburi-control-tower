import type { AlphaEarthState } from "./ChangeOverlay";

interface Props {
  state: AlphaEarthState;
}

export function AlphaEarthBadge({ state }: Props) {
  const { loading, active } = state;
  return (
    <section aria-label="AlphaEarth status" role="status">
      <div className="eyebrow mono">ALPHAEARTH · LAND CHANGE</div>
      {loading ? (
        <div className="caption mono" style={{ color: "var(--text-3)", marginTop: 6 }}>
          Loading manifest…
        </div>
      ) : active ? (
        <>
          <div
            className="mono"
            style={{ marginTop: 6, fontSize: "var(--text-body)", color: "var(--text-1)" }}
          >
            {active.entry.years.a} → {active.entry.years.b}
          </div>
          <div
            className="caption mono"
            style={{ color: "var(--text-2)", marginTop: 4, lineHeight: 1.5 }}
          >
            <div>
              MED Δ <strong>{active.sidecar.stats.median_l2.toFixed(2)}</strong> · MAX Δ{" "}
              <strong>{active.sidecar.stats.max_l2.toFixed(2)}</strong>
            </div>
            <div>
              ramp p{active.sidecar.stats.ramp_low_pctile.toFixed(0)} ={" "}
              {active.sidecar.stats.p_low.toFixed(2)} → p
              {active.sidecar.stats.ramp_high_pctile.toFixed(0)} ={" "}
              {active.sidecar.stats.p_high.toFixed(2)}
            </div>
            <div style={{ color: "var(--text-3)" }}>{active.sidecar.dataset}</div>
          </div>
        </>
      ) : (
        <div
          className="caption mono"
          style={{ marginTop: 6, color: "var(--text-3)", lineHeight: 1.5 }}
        >
          No baked rasters yet. Run{" "}
          <code style={{ color: "var(--accent)" }}>scripts/alphaearth/</code> to
          populate <code>/data/alphaearth/</code>.
        </div>
      )}
    </section>
  );
}
