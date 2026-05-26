/**
 * FisheryPanel — real-time fishery conditions for Chonburi coastal zones.
 *
 * Per-zone status derived from marine state (wave + SST + wind) and
 * rainfall runoff risk. Seasonal calendar shows what's currently
 * in season or in spawning protection period.
 */

import type { FallbackTier } from "@chonburi/shared";
import { PanelHeader } from "./PanelHeader";

export interface MarineSnapshot {
  waveHeightM: number | null;
  windKmh: number | null;
  sstC: number | null;
  swellHeightM: number | null;
  thermalStress: boolean;
  smallBoatSafe: boolean;
}

export interface TideSnapshot {
  springTide: boolean;
  heightM: number;
}

interface Props {
  marine: MarineSnapshot | null;
  tide: TideSnapshot | null;
  /** Latest precipitation (mm) from weather/nowcast — indicates runoff risk */
  precipMm: number | null;
  ageMinutes?: number;
  fallbackTier?: FallbackTier;
  source?: string;
}

interface FisheryZone {
  id: string;
  nameTh: string;
  nameEn: string;
  type: "oyster" | "shrimp" | "mussel" | "artisanal" | "offshore";
  /** Wave threshold for safe operations (m) */
  waveThreshold: number;
  /** SST upper limit for stock health (°C) */
  sstLimit: number;
}

const ZONES: FisheryZone[] = [
  { id: "angsila",  nameTh: "อ่างศิลา", nameEn: "Ang Sila oyster",  type: "oyster",    waveThreshold: 0.8, sstLimit: 31 },
  { id: "bangsaen", nameTh: "บ้านแสน", nameEn: "Bang Saen shrimp", type: "shrimp",    waveThreshold: 0.6, sstLimit: 32 },
  { id: "bangphra", nameTh: "บางพระ",  nameEn: "Bang Phra mussel", type: "mussel",    waveThreshold: 0.9, sstLimit: 31 },
  { id: "bay",      nameTh: "อ่าวชลบุรี", nameEn: "Chonburi Bay",  type: "artisanal", waveThreshold: 1.5, sstLimit: 34 },
  { id: "offshore", nameTh: "เกาะสีชัง", nameEn: "Koh Si Chang",  type: "offshore",  waveThreshold: 2.5, sstLimit: 35 },
];

const TYPE_EMOJI: Record<FisheryZone["type"], string> = {
  oyster:    "🦪",
  shrimp:    "🦐",
  mussel:    "🐚",
  artisanal: "⛵",
  offshore:  "🚢",
};

// Seasonal calendar — months when stock is most at risk or protected
// (simplified; based on Thai Fisheries Dept seasonal advisories)
const SEASON_NOTES: Record<FisheryZone["type"], { month: number; note: string }[]> = {
  oyster:    [{ month: 3, note: "Pre-spawn — avoid stirring substrate" },
              { month: 4, note: "Spawning — harvesting restricted" },
              { month: 10, note: "Post-monsoon — best oyster quality" }],
  shrimp:    [{ month: 5, note: "Rainy season — disease risk rises" },
              { month: 11, note: "Cool season — peak growth" }],
  mussel:    [{ month: 4, note: "Summer stress — high mortality risk above 31°C" }],
  artisanal: [{ month: 6, note: "Monsoon — restrict small-boat operations" },
              { month: 7, note: "Monsoon — restrict small-boat operations" }],
  offshore:  [{ month: 7, note: "Tropical cyclone season — monitor TMD" },
              { month: 8, note: "Tropical cyclone season — monitor TMD" }],
};

function zoneStatus(zone: FisheryZone, marine: MarineSnapshot | null, tide: TideSnapshot | null, precipMm: number | null):
  { level: "go" | "caution" | "hold"; reason: string } {
  if (!marine) return { level: "caution", reason: "No marine data" };
  const wave = marine.waveHeightM ?? 0;
  const sst  = marine.sstC ?? 28;
  const rain = precipMm ?? 0;
  const spring = tide?.springTide ?? false;

  const reasons: string[] = [];
  if (wave > zone.waveThreshold)     reasons.push(`wave ${wave.toFixed(1)}m`);
  if (sst > zone.sstLimit)           reasons.push(`SST ${sst.toFixed(1)}°C`);
  if (rain > 20 && zone.type !== "offshore") reasons.push("runoff risk");
  if (spring && zone.type !== "offshore")    reasons.push("spring tide");

  if (reasons.length === 0) return { level: "go", reason: "All clear" };
  if (wave > zone.waveThreshold * 1.5 || sst > zone.sstLimit + 1)
    return { level: "hold", reason: reasons.join(" · ") };
  return { level: "caution", reason: reasons.join(" · ") };
}

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
