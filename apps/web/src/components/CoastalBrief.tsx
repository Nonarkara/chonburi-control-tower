/**
 * CoastalBrief — replaces the old MarineBrief.
 *
 * Adds: Beaufort scale, vessel safety matrix (3 tiers), wind gusts,
 * wave trend sparkline, fishery thermal-stress indicator.
 * Three text sizes only (display/body/micro). No inline rem.
 */

import { useMemo } from "react";
import type { FallbackTier } from "@chonburi/shared";
import { PanelHeader } from "./PanelHeader";
import { compass, fmt, beaufortColor, surgeColor, safeColor } from "../lib/coastal";

export interface MarineSnapshot {
  observedAt: string;
  waveHeightM: number | null;
  waveDirectionDeg: number | null;
  wavePeriodS: number | null;
  windKmh: number | null;
  windGustsKmh: number | null;
  windDirectionDeg: number | null;
  beaufort: number | null;
  swellHeightM: number | null;
  swellDirectionDeg: number | null;
  swellPeriodS: number | null;
  sstC: number | null;
  currentKmh: number | null;
  currentDirectionDeg: number | null;
  next24h: Array<{ at: string; waveHeightM: number | null; windKmh: number | null; sstC: number | null }>;
  smallBoatSafe: boolean;
  fishingTrawlerSafe: boolean;
  ferrySafe: boolean;
  thermalStress: boolean;
  surgePeakNext24hM: number | null;
}

interface Props {
  data: MarineSnapshot | null;
  loading: boolean;
  ageMinutes?: number;
  fallbackTier?: FallbackTier;
  source?: string;
}

const BEAUFORT_LABEL = [
  "Calm","Light air","Light breeze","Gentle breeze","Moderate breeze",
  "Fresh breeze","Strong breeze","Near gale","Gale","Strong gale",
  "Storm","Violent storm","Hurricane",
];


export function CoastalBrief({ data, loading, ageMinutes, fallbackTier, source }: Props) {
  if (loading && !data) {
    return (
      <div className="col">
        <PanelHeader title="SEA STATE // GULF OF THAILAND" source={source} />
        <div className="skeleton" style={{ height: 32, marginTop: 8 }} />
        <div className="skeleton" style={{ height: 12, width: "70%", marginTop: 8 }} />
      </div>
    );
  }
  if (!data) return null;

  const bf = data.beaufort ?? 0;
  const bfLabel = BEAUFORT_LABEL[Math.min(bf, 12)];
  const bfColor = beaufortColor(bf);

  const surgePeak = data.surgePeakNext24hM ?? 0;
  const surgeColorValue = surgeColor(surgePeak);
  const sstColor = data.thermalStress ? "var(--warn)" : "var(--data)";

  // Sparkline: wave height next 24h
  const sparkPath = useMemo(() => {
    const pts = data.next24h.slice(0, 24);
    if (!pts.length) return "";
    const max = Math.max(0.5, ...pts.map(p => p.waveHeightM ?? 0));
    return pts.map((p, i) => {
      const x = (i / Math.max(1, pts.length - 1)) * 240;
      const y = 26 - ((p.waveHeightM ?? 0) / max) * 22;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  }, [data.next24h]);

  return (
    <div className="col marine-brief">
      <PanelHeader
        title="SEA STATE // GULF OF THAILAND"
        ageMinutes={ageMinutes}
        fallbackTier={fallbackTier}
        source={source ?? "open-meteo-marine"}
      />

      {/* Vessel safety matrix */}
      <div className="marine-verdicts">
        <div className="marine-verdict" style={{ borderColor: safeColor(data.smallBoatSafe) }}>
          <div className="eyebrow">SMALL BOAT</div>
          <div className="mono marine-verdict-value" style={{ color: safeColor(data.smallBoatSafe) }}>
            {data.smallBoatSafe ? "✓ GO" : "✕ HOLD"}
          </div>
          <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>
            wave {fmt(data.waveHeightM, 2, "m")} · wind {fmt(data.windKmh, 0, "km/h")}
          </div>
        </div>
        <div className="marine-verdict" style={{ borderColor: safeColor(data.fishingTrawlerSafe) }}>
          <div className="eyebrow">FISHING BOAT</div>
          <div className="mono marine-verdict-value" style={{ color: safeColor(data.fishingTrawlerSafe) }}>
            {data.fishingTrawlerSafe ? "✓ GO" : "✕ HOLD"}
          </div>
          <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>
            gust {fmt(data.windGustsKmh, 0, "km/h")}
          </div>
        </div>
        <div className="marine-verdict" style={{ borderColor: safeColor(data.ferrySafe) }}>
          <div className="eyebrow">FERRY</div>
          <div className="mono marine-verdict-value" style={{ color: safeColor(data.ferrySafe) }}>
            {data.ferrySafe ? "✓ GO" : "✕ HOLD"}
          </div>
          <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>
            swell {fmt(data.swellHeightM, 2, "m")}
          </div>
        </div>
        <div className="marine-verdict" style={{ borderColor: sstColor }}>
          <div className="eyebrow">SST</div>
          <div className="mono marine-verdict-value" style={{ color: sstColor }}>
            {fmt(data.sstC, 1, "°C")}
          </div>
          <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>
            {data.thermalStress ? "⚠ shellfish" : "normal"}
          </div>
        </div>
      </div>

      {/* Beaufort + wind */}
      <div className="marine-detail-grid">
        <div>
          <div className="eyebrow">BEAUFORT</div>
          <div className="mono" style={{ color: bfColor }}>B{bf} · {bfLabel}</div>
        </div>
        <div>
          <div className="eyebrow">WIND</div>
          <div className="mono">{fmt(data.windKmh, 0, "km/h")} {compass(data.windDirectionDeg)}</div>
        </div>
        <div>
          <div className="eyebrow">WIND-SEA</div>
          <div className="mono">{fmt(data.waveHeightM, 2, "m")} · {fmt(data.wavePeriodS, 1, "s")} · {compass(data.waveDirectionDeg)}</div>
        </div>
        <div>
          <div className="eyebrow">SWELL</div>
          <div className="mono">{fmt(data.swellHeightM, 2, "m")} · {fmt(data.swellPeriodS, 1, "s")} · {compass(data.swellDirectionDeg)}</div>
        </div>
        <div>
          <div className="eyebrow">CURRENT</div>
          <div className="mono">{fmt(data.currentKmh, 1, "km/h")} · {compass(data.currentDirectionDeg)}</div>
        </div>
        <div>
          <div className="eyebrow">SURGE PEAK 24H</div>
          <div className="mono" style={{ color: surgeColorValue }}>{fmt(surgePeak, 2, "m")}</div>
        </div>
      </div>

      {/* Wave sparkline */}
      {sparkPath && (
        <div>
          <div className="eyebrow">WAVE NEXT 24H</div>
          <svg viewBox="0 0 240 28" width="100%" height="28" style={{ display: "block" }}>
            <path d={sparkPath} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
            <line x1="0" y1="26" x2="240" y2="26" stroke="var(--line)" strokeWidth="0.5" />
          </svg>
        </div>
      )}

      <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>
        OPEN-METEO MARINE · 100.85E 13.00N · SI RACHA OFFSHORE
      </div>
    </div>
  );
}
