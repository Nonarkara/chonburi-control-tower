/**
 * Pure building classification helpers — extracted from layers.ts for unit testing.
 *
 * classifyBuilding() drives the color of every building in the 3D cityscape.
 * Getting it wrong silently shows the wrong color for hospitals, temples, etc.
 * and misleads operators who use the building colors for spatial awareness.
 *
 * hexToRgb() converts CSS hex colors to RGB tuples for deck.gl layers.
 * heightColor() maps building height to a height-ramp color for unlabeled buildings.
 */

/**
 * Convert a CSS hex color string (with or without `#`) to an RGB tuple.
 * Returns [200, 200, 200] (neutral grey) for invalid inputs.
 */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [200, 200, 200];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Map a building height (metres) to a deck.gl RGB fill color.
 *
 * The height ramp communicates urban density at a glance in 3D view:
 *   ≥50 m  → sky-300   (high-rise, light blue)
 *   ≥30 m  → sky-400   (mid-high)
 *   ≥20 m  → sky-500   (mid-rise)
 *   ≥12 m  → blue-500  (3–4 floors)
 *   ≥7  m  → indigo    (2 floors)
 *   <7  m  → warm clay (1 floor / unknown)
 */
export function heightColor(h: number): [number, number, number] {
  if (h >= 50) return [125, 211, 252]; // sky-300  — high-rise
  if (h >= 30) return [ 56, 189, 248]; // sky-400  — mid-high
  if (h >= 20) return [ 14, 165, 233]; // sky-500  — mid-rise
  if (h >= 12) return [ 59, 130, 246]; // blue-500 — 3–4 floors
  if (h >=  7) return [ 99, 102, 241]; // indigo   — 2 floors
  return             [148,  103,  89]; // warm clay — 1 floor / unknown
}

export interface BuildingProperties {
  id: string;
  name: string | null;
  nameEn: string | null;
  nameTh: string | null;
  building: string;
  levels: number | null;
  height: number | null;
  operator: string | null;
  amenity?: string | null;
  tourism?: string | null;
  religion?: string | null;
  "building:use"?: string | null;
  office?: string | null;
  healthcare?: string | null;
  shop?: string | null;
  source?: string | null;
}

export type LandmarkKind =
  | "residential"
  | "commercial" | "industrial"
  | "office"
  | "hotel" | "temple" | "church" | "mosque"
  | "government" | "police" | "fire" | "hospital" | "clinic"
  | "school" | "university" | "power" | "tall"
  | "ms-generic"
  | null;

/**
 * Parse a finite positive number from a value that may be a number, numeric
 * string (possibly with unit suffixes like "3m"), or anything else.
 * Returns null for zero, negative, Infinity, NaN, and non-parseable values.
 */
export function finitePositive(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^\d.]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

/**
 * Estimate building height in metres from OSM properties.
 *
 * Priority: explicit `height` → `levels` × 4.2m/floor → landmark minimums.
 */
export function buildingHeightMeters(props: BuildingProperties): number {
  const raw = props as BuildingProperties & {
    "building:levels"?: number | string | null;
    height?: number | string | null;
  };
  const height = finitePositive(raw.height);
  if (height) return Math.max(height, 8);

  const levels = finitePositive(props.levels) ?? finitePositive(raw["building:levels"]);
  if (levels) return Math.max(levels * 4.2, 10);

  const kind = classifyBuilding(props);
  if (kind === "temple")     return 28;
  if (kind === "church")     return 20;
  if (kind === "mosque")     return 22;
  if (kind === "hospital")   return 18;
  if (kind === "government") return 15;
  if (kind === "university") return 15;
  if (kind === "hotel")      return 20;
  return 10;
}

/**
 * Classify a building into a landmark category from its OSM tags.
 *
 * Priority order (highest specificity first):
 *   amenity / healthcare / tourism tags → building tag → name keywords → height.
 * Returns null for unclassified ordinary buildings.
 */
export function classifyBuilding(props: BuildingProperties): LandmarkKind {
  const a  = (props.amenity    ?? "").toLowerCase();
  const t  = (props.tourism    ?? "").toLowerCase();
  const b  = (props.building   ?? "").toLowerCase();
  const r  = (props.religion   ?? "").toLowerCase();
  const op = (props.operator   ?? "").toLowerCase();
  const hc = (props.healthcare ?? "").toLowerCase();
  const of = (props.office     ?? "").toLowerCase();
  const nm = ((props.name ?? "") + " " + (props.nameEn ?? "") + " " + (props.nameTh ?? "")).toLowerCase();
  const src = (props.source ?? "").toLowerCase();

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

  const directHeight = finitePositive(props.height) ?? (finitePositive(props.levels) ? finitePositive(props.levels)! * 4.2 : 0);
  if (directHeight >= 50) return "tall";

  if (
    b === "commercial" || b === "retail" || b === "shop" || b === "supermarket" ||
    b === "mall" || b === "kiosk" ||
    a === "marketplace" || a === "supermarket" || a === "fuel" ||
    a === "restaurant" || a === "cafe" || a === "fast_food" || a === "bar" || a === "food_court" ||
    (props.shop as string | undefined)
  ) return "commercial";

  if (
    b === "industrial" || b === "warehouse" || b === "factory" ||
    b === "storage_tank" || b === "storage"
  ) return "industrial";

  if (b === "office" || of === "company" || of === "ngo" || a === "bank" || a === "post_office")
    return "office";

  if (
    b === "house" || b === "detached" || b === "semidetached_house" ||
    b === "terrace" || b === "row_house" || b === "bungalow" ||
    b === "apartments" || b === "residential" || b === "dormitory" ||
    b === "hut" || b === "cabin"
  ) return "residential";

  if (src === "ms-footprints") return "ms-generic";

  return null;
}
