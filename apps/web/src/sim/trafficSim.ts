import type { FeatureCollection, LineString } from "geojson";

export type RoadClass = "arterial" | "collector" | "local" | "campus-internal";

// OSM highway tag → our internal road class.
const OSM_HIGHWAY_CLASS: Record<string, RoadClass> = {
  motorway: "arterial",
  trunk: "arterial",
  primary: "arterial",
  secondary: "collector",
  tertiary: "collector",
  residential: "local",
  unclassified: "local",
  living_street: "local",
  service: "campus-internal",
};

function classifyOsm(highway: string | undefined, name: string | null): RoadClass {
  if (!highway) return "local";
  // Anything inside campus (Soi Chula) defaults to campus-internal
  if (name && /Soi Chula|จุฬา/i.test(name) && (highway === "residential" || highway === "service" || highway === "living_street")) {
    return "campus-internal";
  }
  return OSM_HIGHWAY_CLASS[highway] ?? "local";
}

export interface RoadProps {
  // OSM-shaped fields (real data)
  name?: string | null;
  nameEn?: string | null;
  nameTh?: string | null;
  highway?: string;
  // Optional pre-classified field for back-compat with the old hand-traced file
  roadClass?: RoadClass;
}

export interface HeatPoint {
  position: [number, number];
  weight: number; // 0..1
  road: string;
  roadClass: RoadClass;
}

// Linear interpolation between two lat/lng pairs.
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function sampleLine(line: LineString, perKmPoints: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < line.coordinates.length - 1; i++) {
    const [aLng, aLat] = line.coordinates[i].slice(0, 2) as [number, number];
    const [bLng, bLat] = line.coordinates[i + 1].slice(0, 2) as [number, number];
    // Approx degrees -> km near Bangkok (1 deg lat ~ 110.6 km, 1 deg lng ~ 107.5 km)
    const dKm = Math.hypot((bLng - aLng) * 107.5, (bLat - aLat) * 110.6);
    const steps = Math.max(2, Math.round(dKm * perKmPoints));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      pts.push([lerp(aLng, bLng, t), lerp(aLat, bLat, t)]);
    }
  }
  return pts;
}

const ROAD_CLASS_BASE: Record<RoadClass, number> = {
  arterial: 0.55,
  collector: 0.35,
  local: 0.18,
  "campus-internal": 0.15,
};

// Peak-hour multiplier modeled as two Gaussians + weekday/weekend modifier.
function hourMultiplier(hour: number, roadClass: RoadClass, isWeekend: boolean): number {
  const morningPeak = 8;
  const eveningPeak = 17.5;
  const morningWeight = Math.exp(-Math.pow((hour - morningPeak) / 1.4, 2));
  const eveningWeight = Math.exp(-Math.pow((hour - eveningPeak) / 1.6, 2));
  const overnight = hour >= 22 || hour < 5 ? 0.15 : 0.4; // floor traffic
  const peakComponent = Math.max(morningWeight, eveningWeight) * (isWeekend ? 0.55 : 1);
  let total = overnight + 0.85 * peakComponent;

  if (roadClass === "campus-internal") {
    // Class hour bursts: 9, 10, 13, 15
    const classBoost =
      Math.exp(-Math.pow((hour - 9) / 0.7, 2)) +
      Math.exp(-Math.pow((hour - 13) / 0.7, 2));
    total += 0.4 * classBoost * (isWeekend ? 0.2 : 1);
  }
  return Math.min(1.3, total);
}

export function buildTrafficSamples(
  roads: FeatureCollection<LineString, RoadProps>,
  hour: number,
  options?: { isWeekend?: boolean; perKmPoints?: number },
): HeatPoint[] {
  const isWeekend = options?.isWeekend ?? false;
  // OSM road geometry is dense already (multi-vertex polylines), so we sample
  // sparsely to keep the heatmap snappy with ~1300 roads in the bbox.
  const perKmPoints = options?.perKmPoints ?? 14;
  const out: HeatPoint[] = [];

  for (const feature of roads.features) {
    const props = feature.properties;
    if (!props) continue;
    const roadClass: RoadClass = props.roadClass ?? classifyOsm(props.highway, props.name ?? null);
    const base = ROAD_CLASS_BASE[roadClass] ?? 0.2;
    const mult = hourMultiplier(hour, roadClass, isWeekend);
    const points = sampleLine(feature.geometry, perKmPoints);
    for (const position of points) {
      // Per-point jitter for visual texture (deterministic-ish)
      const jitter = 0.85 + ((position[0] * 1000) % 3) * 0.05;
      out.push({
        position,
        weight: Math.max(0, Math.min(1, base * mult * jitter)),
        road: props.name ?? "",
        roadClass,
      });
    }
  }
  return out;
}

// For the hour-rail visual indicator: which hours have a "peak"?
export const PEAK_HOURS = new Set([7, 8, 9, 17, 18, 19]);
