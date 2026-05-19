/**
 * MarineBrief — sea-state readout for the mayor.
 *
 * Three text sizes only: --size-h1 (display) for the verdict numerals,
 * --size-body for label lines, --size-eyebrow (micro) for eyebrows + meta.
 * No inline rem values; type stays in the canonical hierarchy.
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
    <div className="col marine-brief">
      <div className="spread" style={{ alignItems: "center" }}>
        <span className="eyebrow">SEA STATE // GULF OF THAILAND</span>
        <span className="eyebrow mono" style={{ color: "var(--text-3)" }}>
          {ageMinutes != null ? `${ageMinutes}M AGO` : ""}
        </span>
      </div>

      {/* Verdict tiles — body weight + colour, micro eyebrow + micro caption */}
      <div className="marine-verdicts">
        <div className="marine-verdict" style={{ borderColor: boatColor }}>
          <div className="eyebrow">SMALL-BOAT</div>
          <div className="mono marine-verdict-value" style={{ color: boatColor }}>
            {data.smallBoatSafe ? "✓ SAFE" : "✕ HOLD"}
          </div>
          <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>
            wave {fmt(data.waveHeightM, 2, " m")}
          </div>
        </div>
        <div className="marine-verdict" style={{ borderColor: sstColor }}>
          <div className="eyebrow">SST</div>
          <div className="mono marine-verdict-value" style={{ color: sstColor }}>
            {fmt(data.sstC, 1, "°C")}
          </div>
          <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>
            {data.thermalStress ? "⚠ shellfish stress" : "normal"}
          </div>
        </div>
      </div>

      {/* Detail grid — micro eyebrow, body line below */}
      <div className="marine-detail-grid">
        <div>
          <div className="eyebrow">WIND-SEA</div>
          <div className="mono">{fmt(data.waveHeightM, 2, " m")} · {fmt(data.wavePeriodS, 1, "s")} · {compass(data.waveDirectionDeg)}</div>
        </div>
        <div>
          <div className="eyebrow">SWELL</div>
          <div className="mono">{fmt(data.swellHeightM, 2, " m")} · {fmt(data.swellPeriodS, 1, "s")} · {compass(data.swellDirectionDeg)}</div>
        </div>
        <div>
          <div className="eyebrow">CURRENT</div>
          <div className="mono">{fmt(data.currentKmh, 1, " km/h")} · {compass(data.currentDirectionDeg)}</div>
        </div>
        <div>
          <div className="eyebrow">SURGE PEAK · 24H</div>
          <div className="mono" style={{ color: surgeColor }}>{fmt(data.surgePeakNext24hM, 2, " m")}</div>
        </div>
      </div>

      {/* 24h wave sparkline */}
      {data.next24h.length > 0 && (
        <div>
          <div className="eyebrow">WAVE NEXT 24 H · {data.next24h.length} HOURLY</div>
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

      <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>
        SOURCE · OPEN-METEO MARINE · 3KM CELL · 100.95E 13.34N
      </div>
    </div>
  );
}
