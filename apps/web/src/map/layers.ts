import { GeoJsonLayer, IconLayer, PathLayer, TextLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { ScatterplotLayer } from "@deck.gl/layers";
import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer } from "@deck.gl/layers";
import type { Feature, FeatureCollection, Polygon, MultiPolygon, LineString, Point } from "geojson";
import type { IncidentFeature, CampusZoneProperties } from "@chonburi/shared";
import type { HeatPoint } from "../sim/trafficSim";

export interface CctvCamera {
  id: string;
  name: string;
  lat: number;
  lng: number;
  vendor: string;
  imageUrl?: string;
}
export interface ShuttleVehicle {
  id: string;
  line: string;
  lat: number;
  lng: number;
  bearing?: number;
  occupancy?: string;
}

export interface RouteProps { route: string; color: string; label: string }
export interface StopProps { id: string; name: string; lines: string[] }
export interface StationProps { id: string; name: string; system: "BTS" | "MRT"; line: string; code: string }
export interface TransitLineProps { id: string; system: "BTS" | "MRT" | "ART"; line: string; color: string; ref: string }
export interface GateProps { id: string; kind: "gate" | "lift-gate" | "entrance"; name: string | null; nameTh: string | null; named: boolean }
export interface ClassifiedRoadProps { name: string | null; nameEn: string | null; nameTh: string | null; highway: string; priority: number; oneway: boolean }
export interface NeighborhoodBuildingProps { id: string; name: string | null; nameEn: string | null; height: number; levels: number | null; building: string }

const ZONE_COLORS: Record<string, [number, number, number]> = {
  academic: [56, 189, 248],
  residential: [167, 139, 250],
  athletic: [245, 158, 11],
  park: [52, 211, 153],
  commercial: [14, 165, 233],
  service: [122, 132, 151],
  perimeter: [14, 165, 233],
};

type ZoneFeature = Feature<Polygon | MultiPolygon, CampusZoneProperties>;

export function campusBoundaryLayer(
  collection: FeatureCollection<Polygon | MultiPolygon, CampusZoneProperties>,
  options: { extruded?: boolean } = {},
) {
  return new GeoJsonLayer({
    id: "campus-boundary",
    data: collection as unknown as FeatureCollection,
    stroked: true,
    filled: true,
    pickable: true,
    extruded: options.extruded ?? false,
    getFillColor: ((f: ZoneFeature) => {
      const z = ZONE_COLORS[f.properties.zoneType] ?? [120, 120, 120];
      return [z[0], z[1], z[2], 38] as [number, number, number, number];
    }) as unknown as [number, number, number, number],
    getLineColor: ((f: ZoneFeature) => {
      const z = ZONE_COLORS[f.properties.zoneType] ?? [200, 200, 200];
      return [z[0], z[1], z[2], 200] as [number, number, number, number];
    }) as unknown as [number, number, number, number],
    getLineWidth: 1.5,
    lineWidthMinPixels: 1,
    getElevation: ((f: ZoneFeature) => f.properties.height ?? 0) as unknown as number,
  });
}

export function trafficHeatmapLayer(data: HeatPoint[]) {
  return new HeatmapLayer<HeatPoint>({
    id: "traffic-heatmap",
    data,
    getPosition: (d) => d.position,
    getWeight: (d) => d.weight,
    radiusPixels: 38,
    intensity: 1.2,
    threshold: 0.04,
    aggregation: "SUM",
    colorRange: [
      [56, 189, 248, 0],
      [56, 189, 248, 120],
      [167, 139, 250, 180],
      [245, 158, 11, 210],
      [248, 113, 113, 235],
      [239, 68, 68, 255],
    ],
  });
}

const INCIDENT_COLORS: Record<IncidentFeature["category"], [number, number, number]> = {
  "traffic-accident": [239, 68, 68],
  "traffic-congestion": [245, 158, 11],
  construction: [251, 191, 36],
  flooding: [56, 189, 248],
  waste: [168, 162, 158],
  lighting: [253, 224, 71],
  sidewalk: [167, 139, 250],
  drainage: [125, 211, 252],
  trees: [52, 211, 153],
  other: [148, 163, 184],
};

export function incidentLayer(id: string, data: IncidentFeature[]) {
  return new ScatterplotLayer<IncidentFeature>({
    id,
    data,
    getPosition: (d) => [d.lng, d.lat],
    getFillColor: (d) => {
      const c = INCIDENT_COLORS[d.category] ?? [200, 200, 200];
      return [...c, d.status === "resolved" ? 90 : 220] as [number, number, number, number];
    },
    getRadius: (d) => (d.severity === "high" ? 26 : d.severity === "medium" ? 18 : 12),
    radiusMinPixels: 4,
    radiusMaxPixels: 22,
    stroked: true,
    getLineColor: [10, 14, 20, 230],
    lineWidthMinPixels: 1,
    pickable: true,
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [200, 200, 200];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function shuttleRoutesLayer(collection: FeatureCollection<LineString, RouteProps>) {
  return new GeoJsonLayer({
    id: "cu-shuttle-routes",
    data: collection as unknown as FeatureCollection,
    stroked: true,
    filled: false,
    pickable: true,
    getLineColor: ((f: Feature<LineString, RouteProps>) => {
      const c = hexToRgb(f.properties.color);
      return [c[0], c[1], c[2], 220] as [number, number, number, number];
    }) as unknown as [number, number, number, number],
    getLineWidth: 3,
    lineWidthMinPixels: 2,
    lineWidthMaxPixels: 5,
  });
}

/**
 * Render a single CU shuttle route (one line of the 5). Per-line toggles let
 * the user isolate a route to read it; the colour comes from the route's own
 * `color` property (color-codes municipal land zones).
 */
export function shuttleRouteLineLayer(
  routeId: string,
  collection: FeatureCollection<LineString, RouteProps>,
) {
  const feature = collection.features.find((f) => f.properties.route === routeId);
  if (!feature) return null;
  const rgb = hexToRgb(feature.properties.color);
  return new GeoJsonLayer({
    id: `cu-shuttle-line-${routeId}`,
    data: { type: "FeatureCollection", features: [feature] } as unknown as FeatureCollection,
    stroked: true,
    filled: false,
    pickable: true,
    getLineColor: [rgb[0], rgb[1], rgb[2], 230],
    getLineWidth: 4,
    lineWidthMinPixels: 3,
    lineWidthMaxPixels: 6,
  });
}

export function shuttleStopsLayer(collection: FeatureCollection<Point, StopProps>) {
  return new ScatterplotLayer({
    id: "cu-shuttle-stops",
    data: collection.features,
    getPosition: ((f: Feature<Point, StopProps>) => f.geometry.coordinates) as unknown as [number, number],
    getRadius: 18,
    radiusMinPixels: 3,
    radiusMaxPixels: 7,
    getFillColor: [251, 191, 36, 230],
    stroked: true,
    getLineColor: [10, 14, 20, 255],
    lineWidthMinPixels: 1,
    pickable: true,
  });
}

export function shuttleVehiclesLayer(vehicles: ShuttleVehicle[]) {
  return new ScatterplotLayer<ShuttleVehicle>({
    id: "cu-shuttle-vehicles",
    data: vehicles,
    getPosition: (v) => [v.lng, v.lat],
    getRadius: 38,
    radiusMinPixels: 6,
    radiusMaxPixels: 12,
    getFillColor: [34, 211, 238, 240],
    stroked: true,
    getLineColor: [10, 14, 20, 255],
    lineWidthMinPixels: 2,
    pickable: true,
  });
}

export function transitStationsLayer(collection: FeatureCollection<Point, StationProps>) {
  return new ScatterplotLayer({
    id: "transit-stations",
    data: collection.features,
    getPosition: ((f: Feature<Point, StationProps>) => f.geometry.coordinates) as unknown as [number, number],
    getRadius: 32,
    radiusMinPixels: 5,
    radiusMaxPixels: 10,
    getFillColor: ((f: Feature<Point, StationProps>) =>
      f.properties.system === "BTS"
        ? [56, 189, 248, 240]
        : [96, 165, 250, 240]) as unknown as [number, number, number, number],
    stroked: true,
    getLineColor: [10, 14, 20, 255],
    lineWidthMinPixels: 1.5,
    pickable: true,
  });
}

export interface CuLandProperties {
  id: string;
  name: { en: string; th: string; zh: string };
  kind: "commercial" | "mixed-use" | "athletic" | "park" | "residential" | "healthcare" | "cultural" | "education";
  operator: string;
  color: string;
  describe: string;
}

export function cuLandsLayer(collection: FeatureCollection<Polygon | MultiPolygon, CuLandProperties>) {
  return new GeoJsonLayer({
    id: "cu-lands",
    data: collection as unknown as FeatureCollection,
    stroked: true,
    filled: true,
    pickable: true,
    getFillColor: ((f: Feature<Polygon | MultiPolygon, CuLandProperties>) => {
      const c = hexToRgb(f.properties.color);
      return [c[0], c[1], c[2], 70] as [number, number, number, number];
    }) as unknown as [number, number, number, number],
    getLineColor: ((f: Feature<Polygon | MultiPolygon, CuLandProperties>) => {
      const c = hexToRgb(f.properties.color);
      return [c[0], c[1], c[2], 230] as [number, number, number, number];
    }) as unknown as [number, number, number, number],
    getLineWidth: 1.5,
    lineWidthMinPixels: 1.5,
    extruded: false,
  });
}

// ─── Campus building footprints (real OSM data) ──────────────────────────
export interface BuildingProperties {
  id: string;
  name: string | null;
  nameEn: string | null;
  nameTh: string | null;
  building: string;
  levels: number | null;
  height: number | null;
  operator: string | null;
  // OSM civic tags — present on landmark buildings
  amenity?: string | null;
  tourism?: string | null;
  religion?: string | null;
  "building:use"?: string | null;
  office?: string | null;
  healthcare?: string | null;
  shop?: string | null;
}

function buildingHeightMeters(props: BuildingProperties): number {
  if (props.height) return props.height;
  if (props.levels) return props.levels * 3;
  // Landmark minimum heights — the polygon may be the compound not the spire;
  // enforce a minimum that reads correctly in the 3D skyline.
  const kind = classifyBuilding(props);
  if (kind === "temple") return 28; // chedi/prang minimum
  if (kind === "church")          return 20; // bell tower minimum
  if (kind === "mosque")          return 22; // minaret minimum
  if (kind === "hospital")        return 18; // multi-storey minimum
  if (kind === "government")      return 15; // civic building minimum
  if (kind === "university")      return 15;
  if (kind === "hotel")           return 20; // hotels tend tall
  return 9;
}

/**
 * Classify a building into a landmark category from its OSM tags.
 * Returns a semantic type string, or null for ordinary buildings.
 *
 * Category palette (amber = civic importance, then semantic data colours):
 *   hotel       → amber/gold     — tourism anchor, draws investment
 *   temple      → bright gold    — cultural backbone, mayor attends regularly
 *   government  → sky-400        — public institutions, mayor's own offices
 *   police      → cyan           — safety infrastructure
 *   fire        → orange         — emergency response
 *   hospital    → coral-red      — health anchor
 *   school      → violet         — education, community
 *   egat/power  → amber          — infrastructure, EGAT = Electricity Gen Auth Thailand
 *   tall (≥50m) → sky-300        — skyline marker, height gradient continues
 */
export type LandmarkKind =
  | "residential"   // houses, apartments — warm terracotta; every household
  | "hotel" | "temple" | "church" | "mosque"
  | "government" | "police" | "fire" | "hospital" | "clinic"
  | "school" | "university" | "power" | "tall" | null;

export function classifyBuilding(props: BuildingProperties): LandmarkKind {
  const a  = (props.amenity    ?? "").toLowerCase();
  const t  = (props.tourism    ?? "").toLowerCase();
  const b  = (props.building   ?? "").toLowerCase();
  const r  = (props.religion   ?? "").toLowerCase();
  const op = (props.operator   ?? "").toLowerCase();
  const hc = (props.healthcare ?? "").toLowerCase();
  const of = (props.office     ?? "").toLowerCase();
  const nm = ((props.name ?? "") + " " + (props.nameEn ?? "") + " " + (props.nameTh ?? "")).toLowerCase();

  // Civic + landmark priority
  if (a === "hospital"  || hc === "hospital") return "hospital";
  if (a === "clinic"    || hc === "clinic" || hc === "doctor") return "clinic";
  if (a === "police")   return "police";
  if (a === "fire_station") return "fire";
  if (a === "school" || a === "kindergarten") return "school";
  if (a === "university" || a === "college") return "university";
  if (a === "place_of_worship") {
    if (r === "christian") return "church";
    if (r === "muslim")    return "mosque";
    return "temple";
  }
  if (a === "townhall" || of === "government" || a === "courthouse") return "government";
  if (t === "hotel" || b === "hotel") return "hotel";
  if (op.includes("egat") || op.includes("pea ") || op.includes("การไฟฟ้า")) return "power";
  if (nm.includes("egat") || nm.includes("การไฟฟ้า")) return "power";
  if (nm.includes("hotel") || nm.includes("โรงแรม")) return "hotel";
  if (nm.includes("โรงพยาบาล") || nm.includes("hospital")) return "hospital";
  if (nm.includes("วัด") || nm.includes("temple") || nm.includes("wat ")) return "temple";
  if (nm.includes("สถานีตำรวจ") || nm.includes("police")) return "police";
  // Compute height directly here to avoid recursion (buildingHeightMeters calls back into classifyBuilding)
  const directHeight = props.height ?? (props.levels ? props.levels * 3 : 0);
  if (directHeight >= 50) return "tall";

  // Residential / household — every house, apartment, row-house
  // Warm terracotta so households read as warm inhabited fabric vs blue civic.
  if (
    b === "house" || b === "detached" || b === "semidetached_house" ||
    b === "terrace" || b === "row_house" || b === "bungalow" ||
    b === "apartments" || b === "residential" || b === "dormitory" ||
    b === "hut" || b === "cabin"
  ) return "residential";

  return null;
}

// Landmark fill colours — one decision per category, legible in both 2D + 3D.
// Amber = civic importance (hotels, power). Semantic palette for safety/health.
const LANDMARK_COLOR: Record<NonNullable<LandmarkKind>, [number, number, number]> = {
  residential: [210, 110, 65],  // warm terracotta — household fabric, distinct from blue civic
  hotel:       [245, 158, 11],  // amber — tourism anchor
  temple:     [251, 191, 36],   // bright gold — cultural backbone
  church:     [253, 224, 71],   // pale gold
  mosque:     [250, 204, 21],   // gold variant
  government: [56,  189, 248],  // sky-400 — public institutions
  police:     [34,  211, 238],  // cyan — safety
  fire:       [251, 146, 60],   // orange — emergency
  hospital:   [239,  68,  68],  // red — health
  clinic:     [251, 113, 133],  // pink-red
  school:     [167, 139, 250],  // violet — education
  university: [196, 181, 253],  // light violet
  power:      [245, 158, 11],   // amber — EGAT/PEA infrastructure
  tall:       [125, 211, 252],  // sky-300 — skyline marker
};

// Height ramp for ordinary (non-landmark) buildings in 3D.
function heightColor(h: number): [number, number, number] {
  if (h >= 50) return [125, 211, 252]; // sky-300 — very tall
  if (h >= 30) return [56,  189, 248]; // sky-400
  if (h >= 15) return [14,  165, 233]; // sky-500
  return             [3,   105, 161];  // sky-700 — low-rise
}

/**
 * Render every municipality building as a filled, tappable 3D box.
 *
 * 2D: hairline footprints — landmarks warmer, ordinary buildings dim.
 * 3D: extruded to real height. Landmarks get their category colour at full
 *     vibrancy regardless of height. Ordinary buildings stay on the blue
 *     height-ramp (sky-300 → sky-700). The result: the mayor can read the
 *     urban topology — the gold temple cluster, amber hotel strip, red
 *     hospital district — all visible in a single 3D view.
 * 3DS: ghosted for the substructure (utilities) cutaway view.
 */
export function buildingsLayer(
  collection: FeatureCollection<Polygon | MultiPolygon, BuildingProperties>,
  options: { extruded?: boolean; ghosted?: boolean } = {},
) {
  const extruded = options.extruded ?? false;
  const ghosted  = options.ghosted  ?? false;
  const fillA = ghosted ? 32  : undefined; // undefined → per-building alpha
  const lineA = ghosted ? 110 : 220;

  return new GeoJsonLayer({
    id: "municipality-buildings",
    data: collection as unknown as FeatureCollection,
    stroked: true,
    filled: true,
    pickable: true,
    extruded,
    material: extruded && !ghosted
      ? { ambient: 0.65, diffuse: 0.75, shininess: 18, specularColor: [255, 240, 200] }
      : false,
    getFillColor: ((f: Feature<Polygon | MultiPolygon, BuildingProperties>) => {
      const kind = classifyBuilding(f.properties);
      if (ghosted) {
        const base = kind ? LANDMARK_COLOR[kind] : heightColor(buildingHeightMeters(f.properties));
        return [base[0], base[1], base[2], 32] as [number, number, number, number];
      }
      if (extruded) {
        if (kind) {
          const c = LANDMARK_COLOR[kind];
          return [c[0], c[1], c[2], 230] as [number, number, number, number];
        }
        const c = heightColor(buildingHeightMeters(f.properties));
        return [c[0], c[1], c[2], 200] as [number, number, number, number];
      }
      // 2D flat view — landmarks stand out, ordinary buildings are dim
      if (kind) {
        const c = LANDMARK_COLOR[kind];
        return [c[0], c[1], c[2], 130] as [number, number, number, number];
      }
      return f.properties.name
        ? [14, 165, 233, 100] as [number, number, number, number]
        : [80, 110, 140, 60]  as [number, number, number, number];
    }) as unknown as [number, number, number, number],
    getLineColor: ((f: Feature<Polygon | MultiPolygon, BuildingProperties>) => {
      const kind = classifyBuilding(f.properties);
      if (kind) {
        const c = LANDMARK_COLOR[kind];
        return [c[0], c[1], c[2], lineA] as [number, number, number, number];
      }
      return f.properties.name
        ? [14, 165, 233, lineA] as [number, number, number, number]
        : [80, 110, 140, lineA] as [number, number, number, number];
    }) as unknown as [number, number, number, number],
    getLineWidth: ((f: Feature<Polygon | MultiPolygon, BuildingProperties>) =>
      classifyBuilding(f.properties) ? 1.2 : 0.6) as unknown as number,
    lineWidthMinPixels: 0.5,
    getElevation: ((f: Feature<Polygon | MultiPolygon, BuildingProperties>) =>
      buildingHeightMeters(f.properties)) as unknown as number,
    opacity: ghosted ? 0.35 : 1,
    updateTriggers: {
      getFillColor: [extruded, ghosted],
      getLineColor: [ghosted],
    },
  });
}

// ─── Underground / substructure PathLayer factories ─────────────────────
// Re-render utility line geometry at a negative z so we can see the
// network "buried" beneath the ghosted buildings. Depths are typical Bangkok
// burial: electricity ~2 m, water ~3 m, drainage ~4 m.

function lineFeaturesAt(
  collection: FeatureCollection,
  depthMeters: number,
): Array<{ path: [number, number, number][]; properties: Record<string, unknown> }> {
  const out: Array<{ path: [number, number, number][]; properties: Record<string, unknown> }> = [];
  for (const f of collection.features) {
    if (f.geometry.type !== "LineString") continue;
    const coords = (f.geometry.coordinates as [number, number][]).map(
      (c) => [c[0], c[1], -depthMeters] as [number, number, number],
    );
    out.push({ path: coords, properties: (f.properties ?? {}) as Record<string, unknown> });
  }
  return out;
}

export function electricityPathLayer(collection: FeatureCollection) {
  const paths = lineFeaturesAt(collection, 2);
  return [
    new PathLayer({
      id: "cu-electricity-paths-3ds",
      data: paths,
      getPath: (d) => d.path,
      getColor: (d) =>
        (d.properties as ElectricityProps).kind === "hv-backbone"
          ? [245, 158, 11, 255]
          : [253, 186, 116, 230],
      getWidth: (d) => ((d.properties as ElectricityProps).kind === "hv-backbone" ? 14 : 8),
      widthUnits: "pixels",
      widthMinPixels: 4,
      pickable: true,
    }),
    new TextLayer({
      id: "cu-electricity-labels-3ds",
      data: paths.filter((d) => ((d.properties as unknown as ElectricityProps).kind === "hv-backbone" || (d.properties as unknown as ElectricityProps).name)),
      getPosition: (d) => {
        const mid = Math.floor(d.path.length / 2);
        return d.path[mid];
      },
      getText: (d) => (d.properties as unknown as ElectricityProps).name || "",
      getSize: 14,
      getColor: [245, 158, 11, 240],
      getAngle: 0,
      getTextAnchor: "middle",
      getAlignmentBaseline: "center",
      billboard: true,
      fontFamily: "monospace",
      fontWeight: "bold",
      parameters: { depthTest: false },
      pickable: false,
    }),
  ];
}

export function waterPathLayer(collection: FeatureCollection) {
  const paths = lineFeaturesAt(collection, 3);
  return [
    new PathLayer({
      id: "cu-water-paths-3ds",
      data: paths,
      getPath: (d) => d.path,
      getColor: (d) =>
        (d.properties as WaterProps).kind === "main"
          ? [56, 189, 248, 250]
          : [147, 197, 253, 220],
      getWidth: (d) => ((d.properties as WaterProps).kind === "main" ? 12 : 7),
      widthUnits: "pixels",
      widthMinPixels: 4,
      pickable: true,
    }),
    new TextLayer({
      id: "cu-water-labels-3ds",
      data: paths.filter((d) => ((d.properties as unknown as WaterProps).kind === "main" || (d.properties as unknown as WaterProps).name)),
      getPosition: (d) => {
        const mid = Math.floor(d.path.length / 2);
        return d.path[mid];
      },
      getText: (d) => {
        const p = d.properties as unknown as WaterProps;
        const parts: string[] = [];
        if (p.name) parts.push(p.name);
        if (p.diameter) parts.push(`Ø${p.diameter}`);
        return parts.join(" ");
      },
      getSize: 13,
      getColor: [56, 189, 248, 235],
      getAngle: 0,
      getTextAnchor: "middle",
      getAlignmentBaseline: "center",
      billboard: true,
      fontFamily: "monospace",
      fontWeight: "bold",
      parameters: { depthTest: false },
      pickable: false,
    }),
  ];
}

export function drainagePathLayer(collection: FeatureCollection) {
  const paths = lineFeaturesAt(collection, 4);
  return [
    new PathLayer({
      id: "cu-drainage-paths-3ds",
      data: paths,
      getPath: (d) => d.path,
      getColor: (d) =>
        (d.properties as DrainageProps).kind === "main"
          ? [16, 185, 129, 250]
          : [110, 231, 183, 220],
      getWidth: (d) => ((d.properties as DrainageProps).kind === "main" ? 14 : 8),
      widthUnits: "pixels",
      widthMinPixels: 4,
      pickable: true,
    }),
    new TextLayer({
      id: "cu-drainage-labels-3ds",
      data: paths.filter((d) => ((d.properties as unknown as DrainageProps).kind === "main" || (d.properties as unknown as DrainageProps).name)),
      getPosition: (d) => {
        const mid = Math.floor(d.path.length / 2);
        return d.path[mid];
      },
      getText: (d) => {
        const p = d.properties as unknown as DrainageProps;
        const parts: string[] = [];
        if (p.name) parts.push(p.name);
        if (p.diameter) parts.push(`Ø${p.diameter}`);
        if (p.capacityM3) parts.push(`${p.capacityM3}m³`);
        return parts.join(" ");
      },
      getSize: 13,
      getColor: [16, 185, 129, 235],
      getAngle: 0,
      getTextAnchor: "middle",
      getAlignmentBaseline: "center",
      billboard: true,
      fontFamily: "monospace",
      fontWeight: "bold",
      parameters: { depthTest: false },
      pickable: false,
    }),
  ];
}

export interface BmaPoi {
  id: string;
  kind:
    | "hospital"
    | "health-center"
    | "school"
    | "fire-station"
    | "police-station"
    | "park"
    | "market"
    | "bma-office"
    | "flood-gate"
    | "pump-station"
    | "cctv"
    | "bus-stop"
    | "other";
  name: string;
  lat: number;
  lng: number;
  description?: string;
}

const POI_COLORS: Record<BmaPoi["kind"], [number, number, number]> = {
  hospital:        [239, 68, 68],
  "health-center": [248, 113, 113],
  school:          [56, 189, 248],
  "fire-station":  [251, 146, 60],
  "police-station":[59, 130, 246],
  park:            [52, 211, 153],
  market:          [251, 191, 36],
  "bma-office":    [168, 162, 158],
  "flood-gate":    [34, 211, 238],
  "pump-station":  [125, 211, 252],
  cctv:            [229, 231, 235],
  "bus-stop":      [167, 139, 250],
  other:           [148, 163, 184],
};

export function bmaPoiLayer(pois: BmaPoi[]) {
  return new ScatterplotLayer<BmaPoi>({
    id: "bma-pois",
    data: pois,
    getPosition: (p) => [p.lng, p.lat],
    getRadius: (p) => (p.kind === "hospital" ? 28 : p.kind === "fire-station" || p.kind === "police-station" ? 22 : 14),
    radiusMinPixels: 4,
    radiusMaxPixels: 10,
    getFillColor: (p) => {
      const c = POI_COLORS[p.kind] ?? [200, 200, 200];
      return [c[0], c[1], c[2], 230] as [number, number, number, number];
    },
    stroked: true,
    getLineColor: [10, 14, 20, 255],
    lineWidthMinPixels: 1,
    pickable: true,
  });
}

export function bmaParksLayer(collection: FeatureCollection<Polygon | MultiPolygon, { PARK_NAME_T?: string }>) {
  return new GeoJsonLayer({
    id: "bma-parks",
    data: collection as unknown as FeatureCollection,
    stroked: true,
    filled: true,
    pickable: true,
    getFillColor: [52, 211, 153, 50],
    getLineColor: [52, 211, 153, 200],
    getLineWidth: 0.8,
    lineWidthMinPixels: 0.5,
  });
}

export interface AqStation {
  id: string;
  name: string;
  address: string;
  pm25: number | null;
  pm10: number | null;
  lat: number;
  lng: number;
}

export function bmaAqStationsLayer(stations: AqStation[]) {
  return new ScatterplotLayer<AqStation>({
    id: "bma-aq-stations",
    data: stations,
    getPosition: (s) => [s.lng, s.lat],
    getRadius: 60,
    radiusMinPixels: 8,
    radiusMaxPixels: 16,
    getFillColor: (s) => {
      const v = s.pm25 ?? 0;
      if (v < 12) return [34, 197, 94, 255];
      if (v < 35) return [250, 204, 21, 255];
      if (v < 55) return [249, 115, 22, 255];
      if (v < 150) return [239, 68, 68, 255];
      return [127, 29, 29, 255];
    },
    stroked: true,
    getLineColor: [10, 14, 20, 255],
    lineWidthMinPixels: 2,
    pickable: true,
  });
}

export function cctvLayer(cameras: CctvCamera[]) {
  return new ScatterplotLayer<CctvCamera>({
    id: "cctv-cameras",
    data: cameras,
    getPosition: (c) => [c.lng, c.lat],
    getRadius: 24,
    radiusMinPixels: 4,
    radiusMaxPixels: 8,
    getFillColor: [229, 231, 235, 220],
    stroked: true,
    getLineColor: [10, 14, 20, 255],
    lineWidthMinPixels: 1,
    pickable: true,
  });
}

// IconLayer reference, kept so 3D-extruded buildings + vehicle icons can be added later.
export { IconLayer };

// ─── Surrounding buildings (urban fabric ~1km around campus) ─────────────
export interface SurroundingBuildingProperties {
  id: string;
  name: string | null;
  nameEn: string | null;
  nameTh: string | null;
  building: string;
  levels: number | null;
  height: number | null;
  operator: string | null;
}

function surroundingBuildingHeightMeters(props: SurroundingBuildingProperties): number {
  if (props.height) return props.height;
  if (props.levels) return props.levels * 3.2;
  return 12;
}

export function surroundingBuildingsLayer(
  collection: FeatureCollection<Polygon | MultiPolygon, SurroundingBuildingProperties>,
  options: { extruded?: boolean; ghosted?: boolean } = {},
) {
  const extruded = options.extruded ?? false;
  const ghosted = options.ghosted ?? false;
  const fillAlpha = ghosted ? 28 : 0.85;
  const lineAlpha = ghosted ? 90 : 180;

  return new GeoJsonLayer({
    id: "surrounding-buildings",
    data: collection as unknown as FeatureCollection,
    stroked: true,
    filled: true,
    pickable: true,
    extruded,
    material: extruded && !ghosted
      ? { ambient: 0.5, diffuse: 0.6, shininess: 8, specularColor: [200, 200, 220] }
      : false,
    getFillColor: ((f: Feature<Polygon | MultiPolygon, SurroundingBuildingProperties>) => {
      const h = surroundingBuildingHeightMeters(f.properties);
      // Cooler palette than campus buildings so campus reads as the warm focus
      if (h >= 100) return [160, 140, 200, ghosted ? fillAlpha : 200];
      if (h >= 60) return [120, 130, 180, ghosted ? fillAlpha : 185];
      if (h >= 35) return [90, 110, 150, ghosted ? fillAlpha : 170];
      return [70, 90, 120, ghosted ? fillAlpha : 155];
    }) as unknown as [number, number, number, number],
    getLineColor: ((f: Feature<Polygon | MultiPolygon, SurroundingBuildingProperties>) =>
      f.properties.name
        ? ([140, 160, 200, lineAlpha] as [number, number, number, number])
        : ([90, 110, 140, lineAlpha] as [number, number, number, number])) as unknown as [number, number, number, number],
    getLineWidth: 0.6,
    lineWidthMinPixels: 0.5,
    getElevation: ((f: Feature<Polygon | MultiPolygon, SurroundingBuildingProperties>) =>
      surroundingBuildingHeightMeters(f.properties)) as unknown as number,
    opacity: ghosted ? 0.3 : 0.9,
    updateTriggers: {
      getFillColor: [extruded, ghosted],
      getLineColor: [ghosted],
    },
  });
}

// ─── Bangkok district boundaries ─────────────────────────────────────────
export interface DistrictProperties {
  id: string;
  nameTh: string;
  nameEn: string;
  code: string;
  areaKm2: number;
}

export function districtBoundariesLayer(
  collection: FeatureCollection<Polygon | MultiPolygon, DistrictProperties>,
) {
  return new GeoJsonLayer({
    id: "bangkok-districts",
    data: collection as unknown as FeatureCollection,
    stroked: true,
    filled: false,
    pickable: true,
    getLineColor: [255, 255, 255, 160],
    getLineWidth: 2,
    lineWidthMinPixels: 1.5,
    lineWidthMaxPixels: 3,
  });
}

export function districtLabelsLayer(
  collection: FeatureCollection<Polygon | MultiPolygon, DistrictProperties>,
) {
  // Compute centroids for labels
  const labels = collection.features.map((f) => {
    let cx = 0, cy = 0, n = 0;
    const coords = f.geometry.type === "Polygon"
      ? f.geometry.coordinates[0]
      : f.geometry.coordinates[0][0];
    for (const [x, y] of coords) { cx += x; cy += y; n++; }
    return {
      position: [cx / n, cy / n, 0] as [number, number, number],
      text: `${f.properties.nameEn}`,
      sub: f.properties.nameTh,
    };
  });
  return new TextLayer({
    id: "bangkok-district-labels",
    data: labels,
    getPosition: (d) => d.position,
    getText: (d) => d.text,
    getSize: 16,
    getColor: [255, 255, 255, 200],
    getAngle: 0,
    getTextAnchor: "middle",
    getAlignmentBaseline: "center",
    billboard: true,
    fontFamily: "'IBM Plex Sans Condensed', sans-serif",
    fontWeight: "bold",
    getBackgroundColor: [0, 0, 0, 120],
    background: true,
    parameters: { depthTest: false },
    pickable: false,
  });
}

// ─── Flood-prone areas ───────────────────────────────────────────────────
export interface FloodAreaProperties {
  id: string;
  nameTh: string;
  nameEn: string;
  risk: "low" | "medium" | "high";
  cause: string;
  frequency: string;
  lastMajor: string;
}

const FLOOD_COLORS: Record<FloodAreaProperties["risk"], [number, number, number, number]> = {
  low:    [250, 204, 21, 70],
  medium: [245, 158, 11, 90],
  high:   [239, 68, 68, 110],
};

export function floodProneAreasLayer(
  collection: FeatureCollection<Polygon | MultiPolygon, FloodAreaProperties>,
) {
  return new GeoJsonLayer({
    id: "flood-prone-areas",
    data: collection as unknown as FeatureCollection,
    stroked: true,
    filled: true,
    pickable: true,
    getFillColor: ((f: Feature<Polygon | MultiPolygon, FloodAreaProperties>) =>
      FLOOD_COLORS[f.properties.risk] ?? [200, 200, 200, 60]) as unknown as [number, number, number, number],
    getLineColor: ((f: Feature<Polygon | MultiPolygon, FloodAreaProperties>) => {
      const c = FLOOD_COLORS[f.properties.risk] ?? [200, 200, 200, 60];
      return [c[0], c[1], c[2], 200] as [number, number, number, number];
    }) as unknown as [number, number, number, number],
    getLineWidth: 1.5,
    lineWidthMinPixels: 1,
    getLineDashArray: [4, 3],
    lineDashJustified: true,
  });
}

// ─── Utility layers ──────────────────────────────────────────────────────
// Electricity, water mains, storm drainage, WiFi survey. Geometry comes from
// hand-authored GeoJSONs at /geo/cu-electricity|water|drainage|wifi.geojson —
// see those files for sourcing notes (real substation names verified against
// the CU-MEA SMART CITY agreement; everything else is realistic
// approximation along the road network).

interface ElectricityProps {
  id: string;
  kind: "substation" | "ring-feeder" | "delivery" | "hv-backbone" | "mv-feeder" | "solar-pv" | "battery-storage";
  name: string;
  voltage?: number;
  capacityMva?: number;
  capacityKw?: number;
  capacityMwh?: number;
  status?: string;
  describe?: string;
}

export function electricityLineLayer(collection: FeatureCollection) {
  // Only LineString features (HV backbone, MV feeder).
  const fc = {
    type: "FeatureCollection",
    features: collection.features.filter((f) => f.geometry.type === "LineString"),
  } as FeatureCollection;
  return new GeoJsonLayer({
    id: "cu-electricity-lines",
    data: fc,
    stroked: true,
    filled: false,
    pickable: true,
    getLineColor: ((f: Feature<LineString, ElectricityProps>) =>
      f.properties.kind === "hv-backbone"
        ? ([245, 158, 11, 240] as [number, number, number, number]) // amber HV
        : ([253, 186, 116, 215] as [number, number, number, number])) as unknown as [number, number, number, number],
    getLineWidth: ((f: Feature<LineString, ElectricityProps>) =>
      f.properties.kind === "hv-backbone" ? 5 : 2.5) as unknown as number,
    lineWidthMinPixels: 2,
    lineWidthMaxPixels: 6,
  });
}

export function electricityNodeLayer(collection: FeatureCollection) {
  const points = collection.features.filter((f) => f.geometry.type === "Point");
  return new ScatterplotLayer({
    id: "cu-electricity-nodes",
    data: points,
    getPosition: ((f: Feature<Point, ElectricityProps>) =>
      f.geometry.coordinates) as unknown as [number, number],
    getRadius: ((f: Feature<Point, ElectricityProps>) => {
      const k = f.properties.kind;
      if (k === "substation") return 90;
      if (k === "delivery") return 60;
      if (k === "battery-storage") return 50;
      if (k === "solar-pv") return 45;
      return 35;
    }) as unknown as number,
    radiusMinPixels: 5,
    radiusMaxPixels: 14,
    getFillColor: ((f: Feature<Point, ElectricityProps>) => {
      const k = f.properties.kind;
      if (k === "substation") return [245, 158, 11, 240]; // amber
      if (k === "delivery") return [251, 191, 36, 220];
      if (k === "battery-storage") return [167, 139, 250, 230]; // violet
      if (k === "solar-pv") return [250, 204, 21, 230]; // yellow
      return [253, 186, 116, 220];
    }) as unknown as [number, number, number, number],
    stroked: true,
    getLineColor: [10, 14, 20, 255],
    lineWidthMinPixels: 1.5,
    pickable: true,
  });
}

interface WaterProps {
  id: string;
  kind: "supply-point" | "main" | "lateral" | "fire-hydrant";
  diameter?: number;
  status?: string;
  name?: string;
}

export function waterLineLayer(collection: FeatureCollection) {
  const fc = {
    type: "FeatureCollection",
    features: collection.features.filter((f) => f.geometry.type === "LineString"),
  } as FeatureCollection;
  return new GeoJsonLayer({
    id: "cu-water-lines",
    data: fc,
    stroked: true,
    filled: false,
    pickable: true,
    getLineColor: ((f: Feature<LineString, WaterProps>) =>
      f.properties.kind === "main"
        ? ([56, 189, 248, 230] as [number, number, number, number]) // cyan main
        : ([147, 197, 253, 200] as [number, number, number, number])) as unknown as [number, number, number, number],
    getLineWidth: ((f: Feature<LineString, WaterProps>) =>
      f.properties.kind === "main" ? 4 : 2) as unknown as number,
    lineWidthMinPixels: 1.5,
    lineWidthMaxPixels: 5,
  });
}

export function waterNodeLayer(collection: FeatureCollection) {
  const points = collection.features.filter((f) => f.geometry.type === "Point");
  return new ScatterplotLayer({
    id: "cu-water-nodes",
    data: points,
    getPosition: ((f: Feature<Point, WaterProps>) => f.geometry.coordinates) as unknown as [number, number],
    getRadius: 40,
    radiusMinPixels: 4,
    radiusMaxPixels: 10,
    getFillColor: ((f: Feature<Point, WaterProps>) =>
      f.properties.kind === "supply-point"
        ? ([56, 189, 248, 240] as [number, number, number, number])
        : ([147, 197, 253, 230] as [number, number, number, number])) as unknown as [number, number, number, number],
    stroked: true,
    getLineColor: [10, 14, 20, 255],
    lineWidthMinPixels: 1.5,
    pickable: true,
  });
}

interface DrainageProps {
  id: string;
  kind: "main" | "feeder" | "retention-basin" | "outfall" | "pump-station";
  diameter?: number;
  capacityM3?: number;
  flow?: string;
  status?: string;
  name?: string;
}

export function drainageLineLayer(collection: FeatureCollection) {
  const fc = {
    type: "FeatureCollection",
    features: collection.features.filter((f) => f.geometry.type === "LineString"),
  } as FeatureCollection;
  return new GeoJsonLayer({
    id: "cu-drainage-lines",
    data: fc,
    stroked: true,
    filled: false,
    pickable: true,
    getLineColor: ((f: Feature<LineString, DrainageProps>) =>
      f.properties.kind === "main"
        ? ([16, 185, 129, 230] as [number, number, number, number]) // emerald main
        : ([110, 231, 183, 200] as [number, number, number, number])) as unknown as [number, number, number, number],
    getLineWidth: ((f: Feature<LineString, DrainageProps>) =>
      f.properties.kind === "main" ? 5 : 2.5) as unknown as number,
    lineWidthMinPixels: 2,
    lineWidthMaxPixels: 6,
  });
}

export function drainageNodeLayer(collection: FeatureCollection) {
  const points = collection.features.filter((f) => f.geometry.type === "Point");
  return new ScatterplotLayer({
    id: "cu-drainage-nodes",
    data: points,
    getPosition: ((f: Feature<Point, DrainageProps>) => f.geometry.coordinates) as unknown as [number, number],
    getRadius: ((f: Feature<Point, DrainageProps>) =>
      f.properties.kind === "retention-basin" ? 110 : 50) as unknown as number,
    radiusMinPixels: 5,
    radiusMaxPixels: 16,
    getFillColor: ((f: Feature<Point, DrainageProps>) => {
      const k = f.properties.kind;
      if (k === "retention-basin") return [16, 185, 129, 220];
      if (k === "outfall") return [56, 189, 248, 230];
      if (k === "pump-station") return [110, 231, 183, 230];
      return [16, 185, 129, 220];
    }) as unknown as [number, number, number, number],
    stroked: true,
    getLineColor: [10, 14, 20, 255],
    lineWidthMinPixels: 1.5,
    pickable: true,
  });
}

// ─── WiFi survey heatmap + points ────────────────────────────────────────

interface WifiProps {
  id: string;
  name: string;
  mbps: number;
  rttMs?: number;
  ssid?: string;
  source?: string;
}

// WiFi heatmap, weighted by Mbps (faster = stronger contribution)
export function wifiHeatmapLayer(collection: FeatureCollection) {
  const features = collection.features.filter(
    (f): f is Feature<Point, WifiProps> => f.geometry.type === "Point",
  );
  return new HeatmapLayer<Feature<Point, WifiProps>>({
    id: "cu-wifi-heat",
    data: features,
    getPosition: (f) => f.geometry.coordinates as [number, number],
    getWeight: (f) => f.properties.mbps / 200,
    radiusPixels: 80,
    intensity: 1.2,
    threshold: 0.05,
    aggregation: "MEAN",
    colorRange: [
      [239, 68, 68, 0],
      [239, 68, 68, 120],
      [245, 158, 11, 180],
      [56, 189, 248, 220],
      [34, 197, 94, 240],
    ],
  });
}

/** Pulsing dot at the operator's GPS fix. Two concentric circles + an
 *  accuracy disk underneath. */
export function devicePresenceLayer(
  lng: number,
  lat: number,
  accuracyM: number | null,
) {
  const data = [{ lng, lat, accuracyM }];
  // Convert accuracy metres to a rough pixel radius at zoom 16 (campus zoom).
  // deck.gl Scatterplot uses `radius` in meters when `radiusUnits === "meters"`
  // (the default for this layer). We pass the actual metre value.
  return [
    new ScatterplotLayer({
      id: "device-accuracy",
      data,
      getPosition: (d) => [d.lng, d.lat] as [number, number],
      getRadius: () => accuracyM ?? 30,
      radiusUnits: "meters",
      radiusMinPixels: 8,
      radiusMaxPixels: 240,
      getFillColor: [56, 189, 248, 50],
      stroked: false,
      pickable: false,
    }),
    new ScatterplotLayer({
      id: "device-dot",
      data,
      getPosition: (d) => [d.lng, d.lat] as [number, number],
      getRadius: 16,
      radiusUnits: "pixels",
      getFillColor: [56, 189, 248, 240],
      stroked: true,
      getLineColor: [255, 255, 255, 240],
      lineWidthUnits: "pixels",
      getLineWidth: 2,
      pickable: false,
    }),
  ];
}

export function wifiPointsLayer(collection: FeatureCollection) {
  const features = collection.features.filter((f) => f.geometry.type === "Point");
  return new ScatterplotLayer({
    id: "cu-wifi-points",
    data: features,
    getPosition: ((f: Feature<Point, WifiProps>) =>
      f.geometry.coordinates) as unknown as [number, number],
    getRadius: 22,
    radiusMinPixels: 4,
    radiusMaxPixels: 8,
    getFillColor: ((f: Feature<Point, WifiProps>) => {
      const m = f.properties.mbps;
      if (m >= 120) return [34, 197, 94, 230];   // green — fast
      if (m >= 80)  return [56, 189, 248, 230];  // cyan — ok
      if (m >= 50)  return [245, 158, 11, 230];  // amber — meh
      return [239, 68, 68, 230];                  // red — slow
    }) as unknown as [number, number, number, number],
    stroked: true,
    getLineColor: [10, 14, 20, 255],
    lineWidthMinPixels: 1,
    pickable: true,
  });
}

/**
 * CU 2015 paper map as a georeferenced raster overlay.
 * Bounds tuned to the actual campus extent (Bunthadthong → Ratchadamri,
 * Rama 1 → Si Lom). Refine the corner coordinates if alignment drifts.
 */
export function cuMapOverlay(
  url = "/maps/cu-map-2015.png",
  bounds: [number, number, number, number] = [100.5176, 13.7270, 100.5455, 13.7475],
  opacity = 0.85,
) {
  return new BitmapLayer({
    id: "cu-map-2015",
    image: url,
    bounds,
    opacity,
    pickable: false,
    desaturate: 0,
    // depthTest off so the bitmap stays glued to the ground when buildings
    // are extruded — otherwise the building bottoms occlude it and the map
    // appears to vanish at pitch > 0.
    parameters: { depthTest: false },
  });
}

/** NASA GIBS WMTS tile layer — free, no API key. */
/**
 * NASA GIBS global tile layer (MODIS true-color, NDVI, LST, flood).
 * Always visible when called — the caller decides whether to add it to
 * the deck.gl layer list based on enabledLayers. The zoom restriction was
 * removed: if the user explicitly turns a satellite layer on, they should
 * see it. Layer descriptions in the palette already say "regional zoom".
 */
// GIBS product → (format, max-level) heuristic. RGB / true-color products
// ship as JPG at Level 9; thematic palettes (NDVI, LST, AOD, NO2, IMERG)
// ship as PNG at lower max levels.
function inferFormat(productId: string): "jpg" | "png" {
  if (productId.includes("CorrectedReflectance")) return "jpg";
  if (productId.includes("TrueColor")) return "jpg";
  if (productId.includes("DayNightBand")) return "png";
  return "png";
}
function inferLevel(productId: string): 6 | 7 | 8 | 9 {
  if (productId.includes("IMERG")) return 6;
  if (productId.includes("OMI_") || productId.includes("AOD")) return 6;
  if (productId.includes("Land_Surface_Temp")) return 7;
  if (productId.includes("DayNightBand")) return 8;
  return 9;
}

interface GibsOpts {
  /** "jpg" for true-color / RGB products, "png" for thematic / index products. */
  format?: "jpg" | "png";
  /** Tile matrix max level: 9 for high-res, 7-8 for thematic, 6 for IMERG / OMI. */
  level?: 6 | 7 | 8 | 9;
}
export function gibsLayer(
  productId: string,
  date?: string,
  opacity = 0.6,
  opts: GibsOpts = {},
) {
  const dateStr = date ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const format = opts.format ?? inferFormat(productId);
  const level = opts.level ?? inferLevel(productId);
  return new TileLayer({
    id: `gibs-${productId}`,
    data:
      `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${productId}/default/${dateStr}` +
      `/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.${format}`,
    minZoom: 0,
    maxZoom: level,
    tileSize: 256,
    opacity,
    renderSubLayers: (props) => {
      const { boundingBox } = props.tile as unknown as {
        boundingBox: [[number, number], [number, number]];
      };
      const [[w, s], [e, n]] = boundingBox;
      return new BitmapLayer({
        ...props,
        data: undefined,
        image: props.data as unknown as string,
        bounds: [w, s, e, n],
      });
    },
  });
}

/** Esri World Imagery — high-resolution satellite, publicly accessible. */
export function esriSatelliteLayer(opacity = 0.9) {
  return new TileLayer({
    id: "satellite-esri",
    data: "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    opacity,
    renderSubLayers: (props) => {
      const { boundingBox } = props.tile as unknown as {
        boundingBox: [[number, number], [number, number]];
      };
      const [[w, s], [e, n]] = boundingBox;
      return new BitmapLayer({
        ...props,
        data: undefined,
        image: props.data as unknown as string,
        bounds: [w, s, e, n],
      });
    },
  });
}

/** OpenTopoMap terrain — for elevation/contour context. Lower max zoom (17). */
export function openTopoTerrainLayer(opacity = 0.6) {
  return new TileLayer({
    id: "satellite-terrain",
    data: [
      "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
      "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
      "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
    ],
    minZoom: 0,
    maxZoom: 17,
    tileSize: 256,
    opacity,
    renderSubLayers: (props) => {
      const { boundingBox } = props.tile as unknown as {
        boundingBox: [[number, number], [number, number]];
      };
      const [[w, s], [e, n]] = boundingBox;
      return new BitmapLayer({
        ...props,
        data: undefined,
        image: props.data as unknown as string,
        bounds: [w, s, e, n],
      });
    },
  });
}

/**
 * Himawari-9 Band 13 (clean infrared) via NASA GIBS WMS. Geostationary cloud
 * loop, 10-min cadence — best for spotting incoming storms over Bangkok.
 * Uses WMS (not WMTS) because GIBS only exposes Himawari that way.
 */
export function himawariInfraredLayer(opacity = 0.55) {
  const today = new Date().toISOString().slice(0, 10);
  // GIBS WMS template — single tile per request, but TileLayer drives the bbox.
  const wmsBase =
    "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?" +
    "SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=TRUE&" +
    `LAYERS=Himawari_AHI_Band13_Clean_Infrared&TIME=${today}&CRS=EPSG:3857&WIDTH=256&HEIGHT=256`;
  return new TileLayer({
    id: "satellite-himawari",
    minZoom: 0,
    maxZoom: 9,
    tileSize: 256,
    opacity,
    getTileData: async ({ bbox }) => {
      // bbox in Web Mercator metres. GIBS expects BBOX=minx,miny,maxx,maxy.
      const { west, south, east, north } = bbox as { west: number; south: number; east: number; north: number };
      // Convert lat/lng to mercator metres (deck.gl gives lng/lat).
      const R = 6378137;
      const toMx = (lng: number) => (lng * Math.PI * R) / 180;
      const toMy = (lat: number) => Math.log(Math.tan((Math.PI * (90 + lat)) / 360)) * R;
      const url = `${wmsBase}&BBOX=${toMx(west)},${toMy(south)},${toMx(east)},${toMy(north)}`;
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        if (typeof createImageBitmap === "function") {
          return await createImageBitmap(blob);
        }
        // Old Safari without createImageBitmap — skip tile rather than leak blob URLs
        return null;
      } catch {
        return null;
      }
    },
    renderSubLayers: (props) => {
      const { boundingBox } = props.tile as unknown as {
        boundingBox: [[number, number], [number, number]];
      };
      const [[w, s], [e, n]] = boundingBox;
      return new BitmapLayer({
        ...props,
        data: undefined,
        image: props.data as unknown as ImageBitmap,
        bounds: [w, s, e, n],
      });
    },
  });
}

// ─── BTS / MRT line geometry ────────────────────────────────────────────
// Polyline tracks for the elevated/underground rail network around the
// campus. Coloured per system: BTS Sukhumvit/Silom (greens), MRT Blue
// (blue), Airport/Gold lines (warm). Lines render below station scatter.

export function transitLinesLayer(collection: FeatureCollection<LineString, TransitLineProps>) {
  return new GeoJsonLayer({
    id: "transit-lines",
    data: collection as unknown as FeatureCollection,
    stroked: true,
    filled: false,
    pickable: true,
    getLineColor: ((f: Feature<LineString, TransitLineProps>) => {
      const c = hexToRgb(f.properties.color);
      return [c[0], c[1], c[2], 230] as [number, number, number, number];
    }) as unknown as [number, number, number, number],
    getLineWidth: 5,
    lineWidthUnits: "pixels",
    lineWidthMinPixels: 2,
    lineWidthMaxPixels: 7,
  });
}

// ─── Campus gates / entrances ───────────────────────────────────────────
// Every barrier=gate / barrier=lift_gate / entrance=* node on or near the
// campus perimeter. Named gates (ประตูพญาไท 1/2/3, อังรีดูนังต์ 1/2, ประตูดำ)
// render larger and amber; unnamed minor gates stay small and grey.

export function campusGatesLayer(collection: FeatureCollection<Point, GateProps>) {
  return new ScatterplotLayer({
    id: "campus-gates",
    data: collection.features,
    getPosition: ((f: Feature<Point, GateProps>) => f.geometry.coordinates) as unknown as [number, number],
    getRadius: ((f: Feature<Point, GateProps>) => (f.properties.named ? 36 : 18)) as unknown as number,
    radiusMinPixels: 4,
    radiusMaxPixels: 12,
    getFillColor: ((f: Feature<Point, GateProps>) =>
      f.properties.named
        ? [251, 191, 36, 240]
        : [148, 163, 184, 220]) as unknown as [number, number, number, number],
    stroked: true,
    getLineColor: [10, 14, 20, 255],
    lineWidthMinPixels: 1.5,
    pickable: true,
  });
}

// ─── Road network — classified by priority ──────────────────────────────
// Renders the OSM road network as a visible map element. Width + colour
// scale by `priority`: motorway/primary = thick warm, secondary = medium
// cyan, tertiary = thin cyan, residential/lane = thinnest neutral.

const ROAD_STYLE: Record<number, { color: [number, number, number]; width: number }> = {
  6: { color: [251, 113, 133], width: 4.5 },  // motorway
  5: { color: [251, 146, 60],  width: 3.5 },  // primary / secondary
  4: { color: [125, 211, 252], width: 2.5 },  // tertiary
  3: { color: [148, 163, 184], width: 1.5 },  // residential / lane
  2: { color: [148, 163, 184], width: 1.0 },  // unclassified / minor
};

export function roadNetworkLayer(collection: FeatureCollection<LineString, ClassifiedRoadProps>) {
  return new GeoJsonLayer({
    id: "road-network",
    data: collection as unknown as FeatureCollection,
    stroked: true,
    filled: false,
    pickable: true,
    getLineColor: ((f: Feature<LineString, ClassifiedRoadProps>) => {
      const s = ROAD_STYLE[f.properties.priority] ?? ROAD_STYLE[3];
      return [s.color[0], s.color[1], s.color[2], 180] as [number, number, number, number];
    }) as unknown as [number, number, number, number],
    getLineWidth: ((f: Feature<LineString, ClassifiedRoadProps>) => {
      const s = ROAD_STYLE[f.properties.priority] ?? ROAD_STYLE[3];
      return s.width;
    }) as unknown as number,
    lineWidthUnits: "pixels",
    lineWidthMinPixels: 0.5,
    lineWidthMaxPixels: 6,
  });
}

// ─── Neighborhood tall buildings (≥30 m) ────────────────────────────────
// Skyline context — the towers around Pathumwan / Silom / Ratchaprasong.
// Cooler palette than the campus buildings so the campus visually pops.

export function neighborhoodBuildingsLayer(
  collection: FeatureCollection<Polygon | MultiPolygon, NeighborhoodBuildingProps>,
  options: { extruded?: boolean; ghosted?: boolean } = {},
) {
  const extruded = options.extruded ?? false;
  const ghosted = options.ghosted ?? false;

  const colorFor = (h: number): [number, number, number, number] => {
    const alpha = ghosted ? 32 : extruded ? 215 : 70;
    if (h >= 150) return [186, 230, 253, alpha]; // supertall — pale sky
    if (h >= 80)  return [125, 211, 252, alpha];
    if (h >= 50)  return [56, 189, 248,  alpha];
    return         [71, 85, 105,    alpha];
  };

  return new GeoJsonLayer({
    id: "neighborhood-buildings",
    data: collection as unknown as FeatureCollection,
    stroked: true,
    filled: true,
    pickable: true,
    extruded,
    material: extruded && !ghosted
      ? { ambient: 0.55, diffuse: 0.65, shininess: 8, specularColor: [200, 220, 255] }
      : false,
    getFillColor: ((f: Feature<Polygon | MultiPolygon, NeighborhoodBuildingProps>) =>
      colorFor(f.properties.height)) as unknown as [number, number, number, number],
    getLineColor: [125, 211, 252, ghosted ? 90 : 200],
    getLineWidth: 0.6,
    lineWidthMinPixels: 0.4,
    getElevation: ((f: Feature<Polygon | MultiPolygon, NeighborhoodBuildingProps>) =>
      f.properties.height) as unknown as number,
    opacity: ghosted ? 0.35 : 1,
    updateTriggers: {
      getFillColor: [extruded, ghosted],
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════
// MARITIME LAYERS
// ═══════════════════════════════════════════════════════════════════════

export interface AisVessel {
  mmsi: string;
  name: string | null;
  lat: number;
  lng: number;
  course?: number;
  speed?: number;
  type?: string;
  flag?: string;
  lastUpdate?: string;
}

export interface DatagoPoint {
  id: string;
  name: string;
  nameEn?: string;
  category: string;
  lat: number;
  lng: number;
  source: string;
  attribution?: string;
}

// OpenSeaMap raster tile overlay — shipping lanes, depth, anchorages
export function maritimeOverlayLayer() {
  return new TileLayer({
    id: "maritime-overlay",
    data: "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png",
    minZoom: 0,
    maxZoom: 18,
    tileSize: 256,
    pickable: false,
    opacity: 0.85,
    renderSubLayers: (props) => {
      const { boundingBox } = props.tile as unknown as {
        boundingBox: [[number, number], [number, number]];
      };
      const [[w, s], [e, n]] = boundingBox;
      return new BitmapLayer({
        ...props,
        data: undefined,
        image: props.data as unknown as string,
        bounds: [w, s, e, n],
      });
    },
  });
}

// Port infrastructure — polygons (harbour landuse, piers, breakwaters)
export function portInfrastructureLayer(collection: FeatureCollection<Polygon | MultiPolygon | LineString, Record<string, unknown>>) {
  return new GeoJsonLayer({
    id: "port-infrastructure",
    data: collection,
    pickable: true,
    stroked: true,
    filled: true,
    getFillColor: [245, 158, 11, 70],
    getLineColor: [245, 158, 11, 220],
    getLineWidth: 2,
    lineWidthMinPixels: 1,
  });
}

// Ferry terminals — point markers
export function ferryTerminalsLayer(collection: FeatureCollection<Point, Record<string, unknown>>) {
  const features = collection.features.filter((f) => f.geometry.type === "Point");
  return new ScatterplotLayer<Feature<Point, Record<string, unknown>>>({
    id: "ferry-terminals",
    data: features,
    pickable: true,
    radiusUnits: "pixels",
    getPosition: (f) => f.geometry.coordinates as [number, number],
    getRadius: 7,
    getFillColor: [251, 191, 36, 230],
    getLineColor: [255, 255, 255, 180],
    stroked: true,
    lineWidthMinPixels: 1.5,
  });
}

// Navigation aids — lighthouses, beacons, buoys
export function navigationAidsLayer(collection: FeatureCollection<Point, Record<string, unknown>>) {
  const features = collection.features.filter((f) => f.geometry.type === "Point");
  return new ScatterplotLayer<Feature<Point, Record<string, unknown>>>({
    id: "navigation-aids",
    data: features,
    pickable: true,
    radiusUnits: "pixels",
    getPosition: (f) => f.geometry.coordinates as [number, number],
    getRadius: 6,
    getFillColor: (f) => {
      const t = String(f.properties?.["man_made"] ?? f.properties?.["seamark:type"] ?? "");
      if (t === "lighthouse") return [250, 204, 21, 240];
      if (t.includes("buoy")) return [56, 189, 248, 220];
      return [250, 204, 21, 200];
    },
    getLineColor: [255, 255, 255, 200],
    stroked: true,
    lineWidthMinPixels: 1.5,
  });
}

// AIS vessels — live ship positions
const VESSEL_COLOR: Record<string, [number, number, number]> = {
  cargo:     [16, 185, 129],   // green
  tanker:    [239, 68, 68],    // red
  passenger: [56, 189, 248],   // blue
  fishing:   [251, 191, 36],   // amber
  pleasure:  [167, 139, 250],  // purple
  tug:       [122, 132, 151],  // grey
  unknown:   [156, 163, 175],  // neutral
};

export function aisVesselsLayer(vessels: AisVessel[]) {
  return new ScatterplotLayer<AisVessel>({
    id: "ais-vessels",
    data: vessels,
    pickable: true,
    radiusUnits: "pixels",
    getPosition: (v) => [v.lng, v.lat],
    getRadius: 5,
    getFillColor: (v) => {
      const t = (v.type ?? "unknown").toLowerCase();
      for (const k of Object.keys(VESSEL_COLOR)) if (t.includes(k)) return [...VESSEL_COLOR[k], 230] as [number, number, number, number];
      return [...VESSEL_COLOR.unknown, 200] as [number, number, number, number];
    },
    getLineColor: [255, 255, 255, 180],
    stroked: true,
    lineWidthMinPixels: 1,
  });
}

// data.go.th points — government POI markers
const DATAGO_COLOR: Record<string, [number, number, number]> = {
  school:    [167, 139, 250],
  hospital:  [239, 68, 68],
  health:    [251, 113, 133],
  temple:    [251, 191, 36],
  market:    [16, 185, 129],
  office:    [56, 189, 248],
  default:   [192, 132, 252],
};

export function datagoPointsLayer(points: DatagoPoint[]) {
  return new ScatterplotLayer<DatagoPoint>({
    id: "datago-points",
    data: points,
    pickable: true,
    radiusUnits: "pixels",
    getPosition: (p) => [p.lng, p.lat],
    getRadius: 5,
    getFillColor: (p) => {
      const cat = p.category.toLowerCase();
      for (const k of Object.keys(DATAGO_COLOR)) if (cat.includes(k)) return [...DATAGO_COLOR[k], 220] as [number, number, number, number];
      return [...DATAGO_COLOR.default, 200] as [number, number, number, number];
    },
    getLineColor: [255, 255, 255, 180],
    stroked: true,
    lineWidthMinPixels: 1,
  });
}

// ═══════════════════════════════════════════════════════════════════════
// DISTANCE GRID (1 / 5 / 10 km rings from municipality centroid)
// Useful for: response-time radii, evacuation planning, ferry reach, AIS
// proximity, mayor's "I can be there in X minutes" framing.
// ═══════════════════════════════════════════════════════════════════════

import { PolygonLayer } from "@deck.gl/layers";

const KM_RING_COLORS: Record<number, [number, number, number, number]> = {
  1:  [14, 165, 233, 220],  // cerulean
  5:  [56, 189, 248, 180],  // sky-400
  10: [125, 211, 252, 140], // sky-300
};

/** Build a ring polygon at `radiusKm` from [lng, lat]. 64-segment circle. */
function ringAt(lng: number, lat: number, radiusKm: number): [number, number][] {
  const segs = 96;
  const earthR = 6371;
  const out: [number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const brg = (i * 2 * Math.PI) / segs;
    const dr = radiusKm / earthR;
    const lat1 = (lat * Math.PI) / 180;
    const lng1 = (lng * Math.PI) / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) * Math.sin(dr) * Math.cos(brg));
    const lng2 = lng1 + Math.atan2(
      Math.sin(brg) * Math.sin(dr) * Math.cos(lat1),
      Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2),
    );
    out.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return out;
}

export function distanceGridLayer(
  center: [number, number],
  radiiKm: number[] = [1, 5, 10],
) {
  const rings = radiiKm.map((km) => ({
    km,
    contour: ringAt(center[0], center[1], km),
  }));
  return new PolygonLayer<{ km: number; contour: [number, number][] }>({
    id: "distance-grid",
    data: rings,
    pickable: false,
    filled: false,
    stroked: true,
    getPolygon: (d) => d.contour,
    getLineColor: (d) => KM_RING_COLORS[d.km] ?? [148, 163, 184, 160],
    getLineWidth: (d) => (d.km === 10 ? 2.5 : d.km === 5 ? 2 : 1.5),
    lineWidthUnits: "pixels",
    lineWidthMinPixels: 1,
  });
}

// Text labels for each ring
export function distanceGridLabelsLayer(
  center: [number, number],
  radiiKm: number[] = [1, 5, 10],
) {
  // Place each label slightly north-east of the centroid at radius
  const labels = radiiKm.map((km) => {
    const earthR = 6371;
    const dr = km / earthR;
    const brg = Math.PI / 4; // 45° NE
    const lat1 = (center[1] * Math.PI) / 180;
    const lng1 = (center[0] * Math.PI) / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) * Math.sin(dr) * Math.cos(brg));
    const lng2 = lng1 + Math.atan2(
      Math.sin(brg) * Math.sin(dr) * Math.cos(lat1),
      Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2),
    );
    return { km, position: [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI] as [number, number] };
  });
  return new TextLayer<{ km: number; position: [number, number] }>({
    id: "distance-grid-labels",
    data: labels,
    pickable: false,
    getPosition: (d) => d.position,
    getText: (d) => `${d.km} km`,
    getSize: 11,
    sizeUnits: "pixels",
    getColor: (d) => KM_RING_COLORS[d.km] ?? [200, 220, 240, 220],
    fontFamily: "IBM Plex Mono, monospace",
    fontWeight: 600,
    getTextAnchor: "start",
    getAlignmentBaseline: "bottom",
    background: true,
    backgroundPadding: [4, 2],
    getBackgroundColor: [3, 16, 31, 220],
  });
}

// ═══════════════════════════════════════════════════════════════════════
// CIVIC + WATERWAYS — consistent category palette + hover tooltips
// ═══════════════════════════════════════════════════════════════════════

export interface CivicPoint {
  kind: CivicKind;
  name?: string;
  nameTh?: string;
  nameEn?: string;
}
export type CivicKind =
  | "hospital" | "clinic" | "pharmacy"
  | "school" | "university" | "kindergarten"
  | "police" | "fire"
  | "government" | "courthouse" | "post"
  | "temple-buddhist" | "church" | "mosque"
  | "market" | "bus-station" | "ferry"
  | "power-substation" | "water-works" | "wastewater"
  | "other";

// Shared category palette — coded by colour family so the legend is
// learnable across the whole dashboard. Health = red family; Education
// = violet; Safety = amber/orange; Government = cerulean; Religion =
// gold; Utility = teal; Transport = sky.
export const CIVIC_PALETTE: Record<CivicKind, { color: [number, number, number]; glyph: string; label: string }> = {
  hospital:         { color: [239, 68, 68],  glyph: "✚", label: "Hospital" },
  clinic:           { color: [251, 113, 133], glyph: "✚", label: "Clinic" },
  pharmacy:         { color: [253, 164, 175], glyph: "Rx", label: "Pharmacy" },
  school:           { color: [167, 139, 250], glyph: "🅢", label: "School" },
  university:       { color: [196, 181, 253], glyph: "Ⓤ", label: "University" },
  kindergarten:     { color: [221, 214, 254], glyph: "Ⓚ", label: "Kindergarten" },
  police:           { color: [56, 189, 248],  glyph: "P",  label: "Police" },
  fire:             { color: [251, 146, 60],  glyph: "🜂", label: "Fire station" },
  government:       { color: [14, 165, 233],  glyph: "⌬", label: "Government" },
  courthouse:       { color: [3, 105, 161],   glyph: "⚖", label: "Courthouse" },
  post:             { color: [125, 211, 252], glyph: "✉", label: "Post office" },
  "temple-buddhist":{ color: [251, 191, 36],  glyph: "卐", label: "Temple" },
  church:           { color: [253, 224, 71],  glyph: "✟", label: "Church" },
  mosque:           { color: [250, 204, 21],  glyph: "☪", label: "Mosque" },
  market:           { color: [16, 185, 129],  glyph: "▦", label: "Market" },
  "bus-station":    { color: [125, 211, 252], glyph: "🚌", label: "Bus station" },
  ferry:            { color: [251, 191, 36],  glyph: "⛴", label: "Ferry pier" },
  "power-substation": { color: [245, 158, 11], glyph: "⚡", label: "Substation" },
  "water-works":    { color: [34, 211, 238],  glyph: "💧", label: "Water works" },
  wastewater:       { color: [13, 148, 136],  glyph: "♻", label: "Wastewater" },
  other:            { color: [148, 163, 184], glyph: "○",  label: "Other" },
};

function readKind(props: Record<string, unknown> | null | undefined): CivicKind {
  const k = (props?.kind as string) ?? "other";
  return (k in CIVIC_PALETTE ? (k as CivicKind) : "other");
}

export function civicPointsLayer(collection: FeatureCollection<Point, Record<string, unknown>>) {
  return new ScatterplotLayer<Feature<Point, Record<string, unknown>>>({
    id: "civic-points",
    data: collection.features,
    pickable: true,
    radiusUnits: "pixels",
    getPosition: (f) => f.geometry.coordinates as [number, number],
    getRadius: (f) => {
      const k = readKind(f.properties);
      // High-importance kinds get bigger dots so the mayor sees them first
      if (k === "hospital" || k === "fire" || k === "police" || k === "government") return 6;
      if (k === "university" || k === "courthouse") return 5;
      return 4;
    },
    getFillColor: (f) => {
      const c = CIVIC_PALETTE[readKind(f.properties)].color;
      return [...c, 220] as [number, number, number, number];
    },
    getLineColor: [255, 255, 255, 220],
    stroked: true,
    lineWidthMinPixels: 1,
  });
}

// Waterways — colour by type (rivers blue, canals brand-cyan, drains green)
const WATERWAY_COLOR: Record<string, [number, number, number, number]> = {
  river:  [56, 189, 248, 200],
  canal:  [14, 165, 233, 220],
  stream: [125, 211, 252, 170],
  drain:  [13, 148, 136, 170],
  ditch:  [13, 148, 136, 140],
};

export function waterwaysLayer(collection: FeatureCollection<LineString, Record<string, unknown>>) {
  return new GeoJsonLayer({
    id: "waterways",
    data: collection,
    pickable: true,
    stroked: true,
    filled: false,
    getLineColor: (f) => {
      const t = String(f.properties?.waterway ?? "stream").toLowerCase();
      return (WATERWAY_COLOR[t] ?? WATERWAY_COLOR.stream);
    },
    getLineWidth: (f) => {
      const t = String(f.properties?.waterway ?? "stream").toLowerCase();
      return t === "river" ? 4 : t === "canal" ? 2.5 : 1;
    },
    lineWidthUnits: "pixels",
    lineWidthMinPixels: 1,
  });
}

// ═══════════════════════════════════════════════════════════════════════
// FISHERIES + COASTAL FLOOD RISK
// Hand-authored polygons. Update as municipal GIS supplies real shapes.
// ═══════════════════════════════════════════════════════════════════════

const FISHERY_COLOR: Record<string, [number, number, number, number]> = {
  oyster:    [251, 191, 36, 110],
  shrimp:    [251, 146, 60, 110],
  mussel:    [167, 139, 250, 110],
  artisanal: [56, 189, 248, 110],
  offshore:  [14, 165, 233, 110],
};

export function fisheriesLayer(collection: FeatureCollection<Polygon | MultiPolygon, Record<string, unknown>>) {
  return new GeoJsonLayer({
    id: "fisheries",
    data: collection,
    pickable: true,
    stroked: true,
    filled: true,
    getFillColor: (f) => {
      const k = String(f.properties?.kind ?? "artisanal");
      return (FISHERY_COLOR[k] ?? FISHERY_COLOR.artisanal);
    },
    getLineColor: (f) => {
      const k = String(f.properties?.kind ?? "artisanal");
      const c = FISHERY_COLOR[k] ?? FISHERY_COLOR.artisanal;
      return [c[0], c[1], c[2], 230];
    },
    getLineWidth: 2,
    lineWidthUnits: "pixels",
    lineWidthMinPixels: 1,
  });
}

const FLOOD_COLOR: Record<string, [number, number, number, number]> = {
  high:   [239, 68, 68, 130],
  medium: [251, 146, 60, 110],
  low:    [251, 191, 36, 90],
};

export function floodRiskLayer(collection: FeatureCollection<Polygon | MultiPolygon, Record<string, unknown>>) {
  return new GeoJsonLayer({
    id: "flood-risk",
    data: collection,
    pickable: true,
    stroked: true,
    filled: true,
    getFillColor: (f) => {
      const sev = String(f.properties?.severity ?? "medium");
      return (FLOOD_COLOR[sev] ?? FLOOD_COLOR.medium);
    },
    getLineColor: (f) => {
      const sev = String(f.properties?.severity ?? "medium");
      const c = FLOOD_COLOR[sev] ?? FLOOD_COLOR.medium;
      return [c[0], c[1], c[2], 230];
    },
    getLineWidth: 1.5,
    lineWidthUnits: "pixels",
    lineWidthMinPixels: 1,
  });
}

// ═══════════════════════════════════════════════════════════════════════
// HERITAGE LAYERS — temples, old town, Chinese shrines
// ═══════════════════════════════════════════════════════════════════════

export interface HeritageFeatureProps {
  kind: "temple-spire" | "chinese-shrine" | "old-town-district";
  name: string;
  nameTh?: string;
  height?: number;
  era?: string;
  describe?: string;
}

/**
 * Temple spires — tall bright gold columns at known temple locations.
 * A real Thai temple's prang/chedi towers 15-50 m; this layer renders
 * it as a glowing gold column so it reads in the skyline from afar.
 * Deck.gl ScatterplotLayer with 3D emulation via thick radius + color.
 */
export function templeSpiresLayer(
  collection: FeatureCollection<Point, HeritageFeatureProps>,
) {
  const spires = collection.features.filter(
    (f) => f.properties.kind === "temple-spire" || f.properties.kind === "chinese-shrine",
  );

  // Base disk — wide amber foundation
  const base = new ScatterplotLayer<Feature<Point, HeritageFeatureProps>>({
    id: "temple-spires-base",
    data: spires,
    pickable: true,
    radiusUnits: "meters",
    getPosition: (f) => f.geometry.coordinates as [number, number],
    getRadius: (f) => f.properties.kind === "temple-spire" ? 14 : 8,
    getFillColor: [251, 191, 36, 200],
    getLineColor: [245, 158, 11, 255],
    stroked: true,
    lineWidthMinPixels: 1.5,
  });

  // Inner spire dot — bright, small, glowing
  const spire = new ScatterplotLayer<Feature<Point, HeritageFeatureProps>>({
    id: "temple-spires-tip",
    data: spires,
    pickable: false,
    radiusUnits: "pixels",
    getPosition: (f) => f.geometry.coordinates as [number, number],
    getRadius: (f) => f.properties.kind === "temple-spire" ? 5 : 3,
    getFillColor: [255, 255, 255, 240],
    getLineColor: [251, 191, 36, 255],
    stroked: true,
    lineWidthMinPixels: 1.5,
  });

  return [base, spire];
}

/**
 * Old town district boundary — hairline outline, warm amber fill at low
 * opacity so buildings inside remain visible but the district reads as
 * a distinct zone at all zoom levels.
 */
export function oldTownDistrictLayer(
  collection: FeatureCollection<Polygon | MultiPolygon, HeritageFeatureProps>,
) {
  const districts = collection.features.filter(
    (f) => f.properties.kind === "old-town-district",
  );
  if (!districts.length) return null;
  return new GeoJsonLayer({
    id: "old-town-district",
    data: { type: "FeatureCollection", features: districts } as FeatureCollection,
    pickable: true,
    stroked: true,
    filled: true,
    getFillColor: [245, 158, 11, 18],   // very low opacity — just a haze
    getLineColor: [245, 158, 11, 200],
    getLineWidth: 2,
    lineWidthUnits: "pixels",
    lineWidthMinPixels: 1.5,
  });
}

// ── GISTDA (Thailand Geo-Informatics & Space Technology) layers ─────────

import type { GistdaPoi, GistdaSolarBuilding } from "@chonburi/shared";

const GISTDA_POI_COLOR: Record<GistdaPoi["category"], [number, number, number]> = {
  government: [56, 189, 248],   // sky-400
  school: [167, 139, 250],      // violet
  temple: [251, 191, 36],       // gold
  hospital: [239, 68, 68],      // red
  hotel: [245, 158, 11],        // amber
  bank: [16, 185, 129],         // emerald
  restaurant: [248, 113, 113],  // pink
  shopping: [236, 72, 153],     // fuchsia
  transport: [34, 211, 238],    // cyan
  sport: [52, 211, 153],        // green
  agency: [148, 163, 184],      // slate
  other: [200, 200, 200],       // grey
};

export function gistdaPoiLayer(pois: GistdaPoi[]) {
  return new ScatterplotLayer<GistdaPoi>({
    id: "gistda-pois",
    data: pois,
    getPosition: (p) => [p.lng, p.lat],
    getRadius: (p) => {
      if (p.category === "hospital") return 28;
      if (p.category === "temple" || p.category === "hotel") return 24;
      if (p.category === "school" || p.category === "government") return 20;
      return 14;
    },
    radiusMinPixels: 4,
    radiusMaxPixels: 12,
    getFillColor: (p) => {
      const c = GISTDA_POI_COLOR[p.category] ?? [200, 200, 200];
      return [c[0], c[1], c[2], 220] as [number, number, number, number];
    },
    stroked: true,
    getLineColor: [10, 14, 20, 240],
    lineWidthMinPixels: 1.5,
    pickable: true,
  });
}

/**
 * Solar irradiance overlay from GISTDA LOD2 buildings.
 * Each building is rendered as a vertical column whose height is proportional
 * to solar potential (kWh/m²). Colour: blue → green → yellow → red.
 */
export function gistdaSolarLayer(buildings: GistdaSolarBuilding[]) {
  return new ScatterplotLayer<GistdaSolarBuilding>({
    id: "gistda-solar",
    data: buildings,
    getPosition: (b) => [b.lng, b.lat],
    getRadius: (b) => Math.max(10, Math.min(b.area / 80, 60)),
    radiusMinPixels: 3,
    radiusMaxPixels: 20,
    getFillColor: (b) => {
      const irr = b.solarIrr;
      // Blue (low) → green → yellow → red (high)
      if (irr < 80) return [56, 189, 248, 200] as [number, number, number, number];
      if (irr < 120) return [52, 211, 153, 210] as [number, number, number, number];
      if (irr < 160) return [250, 204, 21, 220] as [number, number, number, number];
      return [239, 68, 68, 230] as [number, number, number, number];
    },
    stroked: true,
    getLineColor: [10, 14, 20, 200],
    lineWidthMinPixels: 1,
    pickable: true,
  });
}
