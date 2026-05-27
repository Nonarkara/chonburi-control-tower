/**
 * Pure fishery zone assessment logic — no React, no I/O.
 *
 * Extracted from FisheryPanel so it can be unit-tested without a DOM or
 * React rendering environment. FisheryPanel imports from here.
 */

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

export interface FisheryZone {
  id: string;
  nameTh: string;
  nameEn: string;
  type: "oyster" | "shrimp" | "mussel" | "artisanal" | "offshore";
  /** Wave threshold for safe operations (m) */
  waveThreshold: number;
  /** SST upper limit for stock health (°C) */
  sstLimit: number;
}

export const ZONES: FisheryZone[] = [
  { id: "angsila",  nameTh: "อ่างศิลา",    nameEn: "Ang Sila oyster",  type: "oyster",    waveThreshold: 0.8, sstLimit: 31 },
  { id: "bangsaen", nameTh: "บ้านแสน",     nameEn: "Bang Saen shrimp", type: "shrimp",    waveThreshold: 0.6, sstLimit: 32 },
  { id: "bangphra", nameTh: "บางพระ",      nameEn: "Bang Phra mussel", type: "mussel",    waveThreshold: 0.9, sstLimit: 31 },
  { id: "bay",      nameTh: "อ่าวชลบุรี", nameEn: "Chonburi Bay",    type: "artisanal", waveThreshold: 1.5, sstLimit: 34 },
  { id: "offshore", nameTh: "เกาะสีชัง",   nameEn: "Koh Si Chang",    type: "offshore",  waveThreshold: 2.5, sstLimit: 35 },
];

// Seasonal calendar — months when stock is most at risk or protected
// (simplified; based on Thai Fisheries Dept seasonal advisories)
export const SEASON_NOTES: Record<FisheryZone["type"], { month: number; note: string }[]> = {
  oyster:    [{ month: 3,  note: "Pre-spawn — avoid stirring substrate" },
              { month: 4,  note: "Spawning — harvesting restricted" },
              { month: 10, note: "Post-monsoon — best oyster quality" }],
  shrimp:    [{ month: 5,  note: "Rainy season — disease risk rises" },
              { month: 11, note: "Cool season — peak growth" }],
  mussel:    [{ month: 4,  note: "Summer stress — high mortality risk above 31°C" }],
  artisanal: [{ month: 6,  note: "Monsoon — restrict small-boat operations" },
              { month: 7,  note: "Monsoon — restrict small-boat operations" }],
  offshore:  [{ month: 7,  note: "Tropical cyclone season — monitor TMD" },
              { month: 8,  note: "Tropical cyclone season — monitor TMD" }],
};

export function zoneStatus(
  zone: FisheryZone,
  marine: MarineSnapshot | null,
  tide: TideSnapshot | null,
  precipMm: number | null,
): { level: "go" | "caution" | "hold"; reason: string } {
  if (!marine) return { level: "caution", reason: "No marine data" };

  const wave   = marine.waveHeightM ?? 0;
  const sst    = marine.sstC ?? 28;
  const rain   = precipMm ?? 0;
  const spring = tide?.springTide ?? false;

  const reasons: string[] = [];
  if (wave > zone.waveThreshold)                           reasons.push(`wave ${wave.toFixed(1)}m`);
  if (sst > zone.sstLimit)                                 reasons.push(`SST ${sst.toFixed(1)}°C`);
  if (rain > 20 && zone.type !== "offshore")               reasons.push("runoff risk");
  if (spring && zone.type !== "offshore")                  reasons.push("spring tide");

  if (reasons.length === 0) return { level: "go", reason: "All clear" };

  if (wave > zone.waveThreshold * 1.5 || sst > zone.sstLimit + 1)
    return { level: "hold", reason: reasons.join(" · ") };

  return { level: "caution", reason: reasons.join(" · ") };
}
