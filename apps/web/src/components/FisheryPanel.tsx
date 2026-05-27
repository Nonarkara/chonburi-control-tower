/**
 * FisheryPanel — real-time fishery conditions for Chonburi coastal zones.
 *
 * Per-zone status derived from marine state (wave + SST + wind) and
 * rainfall runoff risk. Seasonal calendar shows what's currently
 * in season or in spawning protection period.
 *
 * Pure assessment logic lives in ../lib/fishery.ts (unit-tested separately).
 */

import type { FallbackTier } from "@chonburi/shared";
import { PanelHeader } from "./PanelHeader";
import { ZONES, SEASON_NOTES, zoneStatus } from "../lib/fishery";
import type { MarineSnapshot, TideSnapshot, FisheryZone } from "../lib/fishery";

// Re-export interfaces so existing importers don't break
export type { MarineSnapshot, TideSnapshot };

interface Props {
  marine: MarineSnapshot | null;
  tide: TideSnapshot | null;
  /** Latest precipitation (mm) from weather/nowcast — indicates runoff risk */
  precipMm: number | null;
  ageMinutes?: number;
  fallbackTier?: FallbackTier;
  source?: string;
}

const TYPE_EMOJI: Record<FisheryZone["type"], string> = {
  oyster:    "🦪",
  shrimp:    "🦐",
  mussel:    "🐚",
  artisanal: "⛵",
  offshore:  "🚢",
};

const STATUS_COLOR = { go: "var(--good)", caution: "var(--warn)", hold: "var(--bad)" } as const;
const STATUS_GLYPH = { go: "✓", caution: "⚠", hold: "✕" } as const;

export function FisheryPanel({ marine, tide, precipMm, ageMinutes, fallbackTier, source }: Props) {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12

  return (
    <div className="col" style={{ gap: 6 }}>
      <PanelHeader
        title="FISHERY CONDITIONS // CHONBURI"
        ageMinutes={ageMinutes}
        fallbackTier={fallbackTier}
        source={source ?? "open-meteo-marine"}
        actions={
          <span className="eyebrow mono" style={{ color: "var(--text-3)" }}>
            {now.toLocaleString("th-TH", { month: "short", year: "2-digit" }).toUpperCase()}
          </span>
        }
      />

      {/* Per-zone status */}
      {ZONES.map(zone => {
        const { level, reason } = zoneStatus(zone, marine, tide, precipMm);
        const seasonNote = SEASON_NOTES[zone.type].find(s => s.month === month);
        return (
          <div key={zone.id} style={{
            borderLeft: `2px solid ${STATUS_COLOR[level]}`,
            paddingLeft: 8,
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: STATUS_COLOR[level] }} className="mono">
                {STATUS_GLYPH[level]}
              </span>
              <span style={{ flex: 1 }}>
                {TYPE_EMOJI[zone.type]} {zone.nameEn}
              </span>
              <span className="eyebrow mono" style={{ color: "var(--text-3)" }}>
                ≤{zone.waveThreshold}m
              </span>
            </div>
            <div className="eyebrow mono" style={{ color: STATUS_COLOR[level] }}>
              {reason}
            </div>
            {seasonNote && (
              <div className="eyebrow mono" style={{ color: "var(--accent)" }}>
                📅 {seasonNote.note}
              </div>
            )}
            <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>
              {zone.nameTh}
            </div>
          </div>
        );
      })}

      {/* Runoff risk summary */}
      {precipMm != null && precipMm > 10 && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 6 }}>
          <div className="eyebrow">RAIN RUNOFF RISK</div>
          <div className="mono" style={{ color: precipMm > 30 ? "var(--bad)" : "var(--warn)" }}>
            {precipMm.toFixed(1)} mm · {precipMm > 30 ? "HIGH — aquaculture contamination risk" : "MODERATE — monitor drainage"}
          </div>
        </div>
      )}

      <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>
        DERIVED FROM OPEN-METEO MARINE · WAVE / SST / WIND
      </div>
    </div>
  );
}
