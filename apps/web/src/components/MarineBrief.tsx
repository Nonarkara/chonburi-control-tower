/**
 * MarineBrief — sea-state readout for the mayor.
 *
 * The bay just off Chonburi feeds two anxious constituencies:
 *   - Small-boat fishermen who need wave height < 1.5 m to launch safely
 *   - Coastal residents whose homes flood when swell + onshore wind stack
 *
 * This panel gives a one-glance "go / no-go" verdict + the 24h surge
 * forecast. Data: Open-Meteo Marine (free, no key, ~3 km cell).
 */

export interface MarineSnapshot {
  observedAt: string;
  waveHeightM: number | null;
  waveDirectionDeg: number | null;
  wavePeriodS: number | null;
  sstC: number | null;
  swellHeightM: number | null;
  swellDirectionDeg: number | null;
  swellPeriodS: number | null;
  currentKmh: number | null;
  currentDirectionDeg: number | null;
  next24h: Array<{ at: string; waveHeightM: number | null; sstC: number | null }>;
  smallBoatSafe: boolean;
  thermalStress: boolean;
  surgePeakNext24hM: number | null;
}

interface Props {
  data: MarineSnapshot | null;
  loading: boolean;
  ageMinutes?: number;
}

function compass(deg: number | null): string {
  if (deg == null) return "—";
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function fmt(n: number | null, digits = 1, unit = ""): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}${unit}`;
}

export function MarineBrief({ data, loading, ageMinutes }: Props) {
  if (loading && !data) {
    return (
      <div className="col">
        <div className="eyebrow">SEA STATE // GULF OF THAILAND</div>
        <div className="skeleton" style={{ height: 32, marginTop: 8 }} />
        <div className="skeleton" style={{ height: 12, width: "70%", marginTop: 8 }} />
      </div>
    );
  }
  if (!data) return null;

  const surgeColor =
    (data.surgePeakNext24hM ?? 0) >= 2 ? "var(--bad)" :
    (data.surgePeakNext24hM ?? 0) >= 1.2 ? "var(--warn)" :
    "var(--good)";

  const sstColor = data.thermalStress ? "var(--warn)" : "var(--data)";
  const boatColor = data.smallBoatSafe ? "var(--good)" : "var(--bad)";

  return (
    <div className="col" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="spread" style={{ alignItems: "center" }}>
        <span className="eyebrow">SEA STATE // GULF OF THAILAND</span>
        <span className="mono caption" style={{ color: "var(--text-3)" }}>
          {ageMinutes != null ? `${ageMinutes}M AGO` : ""}
        </span>
      </div>

      {/* Verdicts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        <div style={{ border: `1px solid ${boatColor}`, padding: "5px 8px" }}>
          <div className="caption mono" style={{ fontSize: "0.6rem", letterSpacing: "0.08em", color: "var(--text-3)" }}>
            SMALL-BOAT
          </div>
          <div className="mono" style={{ color: boatColor, fontSize: "0.85rem" }}>
            {data.smallBoatSafe ? "✓ SAFE" : "✕ HOLD"}
          </div>
          <div className="caption mono" style={{ fontSize: "0.62rem", color: "var(--text-3)" }}>
            wave {fmt(data.waveHeightM, 2, " m")}
          </div>
        </div>
        <div style={{ border: `1px solid ${sstColor}`, padding: "5px 8px" }}>
          <div className="caption mono" style={{ fontSize: "0.6rem", letterSpacing: "0.08em", color: "var(--text-3)" }}>
            SST
          </div>
          <div className="mono" style={{ color: sstColor, fontSize: "0.85rem" }}>
            {fmt(data.sstC, 1, "°C")}
          </div>
          <div className="caption mono" style={{ fontSize: "0.62rem", color: "var(--text-3)" }}>
            {data.thermalStress ? "⚠ shellfish stress" : "normal"}
          </div>
        </div>
      </div>

      {/* Detail grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 4 }}>
        <div>
          <div className="caption mono" style={{ fontSize: "0.6rem", color: "var(--text-3)" }}>WIND-SEA</div>
          <div className="mono" style={{ fontSize: "0.76rem" }}>
            {fmt(data.waveHeightM, 2, " m")} · {fmt(data.wavePeriodS, 1, "s")} · {compass(data.waveDirectionDeg)}
          </div>
        </div>
        <div>
          <div className="caption mono" style={{ fontSize: "0.6rem", color: "var(--text-3)" }}>SWELL</div>
          <div className="mono" style={{ fontSize: "0.76rem" }}>
            {fmt(data.swellHeightM, 2, " m")} · {fmt(data.swellPeriodS, 1, "s")} · {compass(data.swellDirectionDeg)}
          </div>
        </div>
        <div>
          <div className="caption mono" style={{ fontSize: "0.6rem", color: "var(--text-3)" }}>CURRENT</div>
          <div className="mono" style={{ fontSize: "0.76rem" }}>
            {fmt(data.currentKmh, 1, " km/h")} · {compass(data.currentDirectionDeg)}
          </div>
        </div>
        <div>
          <div className="caption mono" style={{ fontSize: "0.6rem", color: "var(--text-3)" }}>SURGE PEAK · 24H</div>
          <div className="mono" style={{ fontSize: "0.76rem", color: surgeColor }}>
            {fmt(data.surgePeakNext24hM, 2, " m")}
          </div>
        </div>
      </div>

      {/* Mini sparkline of next 24h wave height */}
      {data.next24h.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div className="caption mono" style={{ fontSize: "0.6rem", color: "var(--text-3)", letterSpacing: "0.08em" }}>
            WAVE NEXT 24 H · {data.next24h.length} HOURLY
          </div>
          <svg viewBox="0 0 240 28" width="100%" height="28" style={{ display: "block" }}>
            {(() => {
              const pts = data.next24h.slice(0, 24);
              const max = Math.max(0.5, ...pts.map((p) => p.waveHeightM ?? 0));
              const path = pts.map((p, i) => {
                const x = (i / Math.max(1, pts.length - 1)) * 240;
                const y = 26 - ((p.waveHeightM ?? 0) / max) * 22;
                return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
              }).join(" ");
              return (
                <>
                  <path d={path} fill="none" stroke="var(--brand)" strokeWidth="1.5" />
                  <line x1="0" y1="26" x2="240" y2="26" stroke="var(--line)" strokeWidth="0.5" />
                </>
              );
            })()}
          </svg>
        </div>
      )}

      <div className="caption mono" style={{ fontSize: "0.6rem", color: "var(--text-3)", marginTop: 2 }}>
        SOURCE · OPEN-METEO MARINE · 3KM CELL · BAY OFF CHONBURI 100.95E 13.34N
      </div>
    </div>
  );
}
