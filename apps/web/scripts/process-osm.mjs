#!/usr/bin/env node
// Process raw Overpass data into clean, purpose-built GeoJSON layers
// for the dashboard. Reads from public/geo/osm/, writes to public/geo/.

import fs from "node:fs/promises";
import path from "node:path";

const OSM_DIR = path.resolve("public/geo/osm");
const OUT_DIR = path.resolve("public/geo");

async function read(name) {
  const txt = await fs.readFile(path.join(OSM_DIR, name), "utf8");
  return JSON.parse(txt);
}
async function write(name, fc) {
  const file = path.join(OUT_DIR, name);
  await fs.writeFile(file, JSON.stringify(fc));
  const size = (await fs.stat(file)).size;
  console.log(`  → ${name} · ${fc.features.length} features · ${(size / 1024).toFixed(1)} KB`);
}

const matchName = (re) => (f) => {
  const n = f.properties?.name;
  return typeof n === "string" && re.test(n);
};

const isInside = (point, polygon) => {
  // Simple ray-cast; works for plain Polygon, not MultiPolygon.
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const featureCentroid = (f) => {
  const g = f.geometry;
  if (g.type === "Point") return g.coordinates;
  if (g.type === "Polygon") {
    const ring = g.coordinates[0];
    let sx = 0, sy = 0;
    for (const [x, y] of ring) { sx += x; sy += y }
    return [sx / ring.length, sy / ring.length];
  }
  if (g.type === "MultiPolygon") return featureCentroid({ ...f, geometry: { type: "Polygon", coordinates: g.coordinates[0] } });
  if (g.type === "LineString") {
    const c = g.coordinates;
    return c[Math.floor(c.length / 2)];
  }
  return [0, 0];
};

const fc = (features) => ({ type: "FeatureCollection", features });

// ─────────────────────────────────────────────────────────────────────────
// 1. CAMPUS BOUNDARY
// Extract the single MultiPolygon for Chulalongkorn University.
// ─────────────────────────────────────────────────────────────────────────

console.log("[campus]");
const campusSrc = await read("chula-campus.geojson");
const cuFeature = campusSrc.features.find(
  (f) =>
    f.properties?.amenity === "university" &&
    matchName(/^จุฬาลงกรณ์มหาวิทยาลัย$|^Chulalongkorn University$/i)(f) &&
    (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"),
);
if (!cuFeature) throw new Error("Campus polygon not found in OSM data.");
console.log(`  campus geometry: ${cuFeature.geometry.type}`);

// Get all the boundary rings as a single polygon list for inside-tests.
const campusRings = cuFeature.geometry.type === "Polygon"
  ? [cuFeature.geometry.coordinates[0]]
  : cuFeature.geometry.coordinates.map((p) => p[0]);

const insideCampus = (pt) => campusRings.some((ring) => isInside(pt, ring));

const campusGeoJson = fc([
  {
    type: "Feature",
    properties: {
      zoneId: "campus",
      name: { en: "Chulalongkorn University", th: "จุฬาลงกรณ์มหาวิทยาลัย", zh: "朱拉隆功大学" },
      zoneType: "perimeter",
      color: "#B7307A",
      height: null,
    },
    geometry: cuFeature.geometry,
  },
]);
await write("chula-campus.geojson", campusGeoJson);

// We need CU-lands polygons to expand the building filter (so we pick up MBK,
// Samyan Mitrtown, Siam Square towers, etc.), so the raw buildings source has
// to load before we run the CU-lands match.

console.log("[buildings:load]");
const buildingsSrc = await read("chula-buildings.geojson");

// ─────────────────────────────────────────────────────────────────────────
// 3. ROAD NETWORK (only useful classes — drop tiny service alleys)
// ─────────────────────────────────────────────────────────────────────────

console.log("[roads]");
const ROAD_PRIORITY = {
  motorway: 6, trunk: 6,
  primary: 5, secondary: 5,
  tertiary: 4,
  residential: 3, unclassified: 3, living_street: 3,
  service: 1,
};
const roadsSrc = await read("chula-roads.geojson");
const roads = roadsSrc.features
  .filter((f) => f.geometry.type === "LineString")
  .map((f) => {
    const cls = f.properties.highway ?? "unclassified";
    return {
      type: "Feature",
      properties: {
        name: f.properties.name ?? f.properties["name:en"] ?? null,
        nameEn: f.properties["name:en"] ?? null,
        nameTh: f.properties["name:th"] ?? null,
        highway: cls,
        oneway: f.properties.oneway === "yes",
        priority: ROAD_PRIORITY[cls] ?? 2,
      },
      geometry: f.geometry,
    };
  })
  .filter((f) => f.properties.priority >= 2); // drop pure service ways
console.log(`  kept ${roads.length}/${roadsSrc.features.length} roads (priority ≥ 2)`);
await write("chula-roads.geojson", fc(roads));

// ─────────────────────────────────────────────────────────────────────────
// 4. CU SHUTTLE (POP BUS) ROUTES
// Each Overpass relation has member ways with role=""; osmtogeojson splits
// them into the relation feature + their constituent LineStrings. We keep
// the LineString members and tag them with the parent relation's ref/colour.
// ─────────────────────────────────────────────────────────────────────────

console.log("[cu-shuttle]");
const shuttleSrc = await read("cu-shuttle-osm.geojson");
// Pick the route relations (one feature per route, geometry = LineString or MultiLineString)
const ROUTE_COLORS = {
  "CUPOP 1": "#ef4444",
  "CUPOP 2": "#38bdf8",
  "CUPOP 3": "#34d399",
  "CUPOP 4": "#a78bfa",
  "CUPOP 5": "#f59e0b",
};
const shuttleRoutes = shuttleSrc.features
  .filter((f) => f.properties?.type === "route" && f.properties?.route === "bus")
  .map((f) => {
    const ref = f.properties.ref ?? "?";
    return {
      type: "Feature",
      properties: {
        route: ref.replace(/^CUPOP\s*/, "") || "?",
        ref,
        label: f.properties.name ?? ref,
        color: ROUTE_COLORS[ref] ?? "#B7307A",
      },
      geometry: f.geometry,
    };
  });
console.log(`  ${shuttleRoutes.length} CU shuttle routes`);
await write("cu-shuttle-routes.geojson", fc(shuttleRoutes));

// Shuttle stops — node members named or tagged highway=bus_stop inside campus.
const shuttleStops = shuttleSrc.features
  .filter((f) => f.geometry.type === "Point")
  .filter((f) => f.properties.highway === "bus_stop" || matchName(/Chulalongkorn|จุฬา|CU/i)(f))
  .map((f) => ({
    type: "Feature",
    properties: {
      id: String(f.id ?? `stop-${featureCentroid(f).join(",")}`),
      name: f.properties.name ?? "Stop",
      lines: [],
    },
    geometry: f.geometry,
  }));
console.log(`  ${shuttleStops.length} shuttle stops`);
await write("cu-shuttle-stops.geojson", fc(shuttleStops));

// ─────────────────────────────────────────────────────────────────────────
// 5. TRANSIT STATIONS (BTS/MRT)
// ─────────────────────────────────────────────────────────────────────────

console.log("[transit]");
const transitSrc = await read("transit-stations.geojson");
const transit = transitSrc.features
  .filter((f) => f.geometry.type === "Point")
  .map((f) => {
    const network = f.properties.network ?? "";
    const operator = f.properties.operator ?? "";
    const ref = f.properties.ref ?? "";
    const isBts = /BTS/i.test(network) || /BTS/i.test(operator) || /^[ENWS]\d+$/i.test(ref);
    const isMrt = /MRT/i.test(network) || /MRT/i.test(operator) || /^(BL|YL|MRT)/i.test(ref);
    return {
      type: "Feature",
      properties: {
        id: String(f.id ?? `${f.properties.name}-${featureCentroid(f).join(",")}`),
        name: f.properties.name ?? "Station",
        nameEn: f.properties["name:en"] ?? null,
        system: isBts ? "BTS" : isMrt ? "MRT" : "Rail",
        line: network || operator || "",
        code: ref || "",
      },
      geometry: f.geometry,
    };
  });
console.log(`  ${transit.length} transit stations`);
await write("transit-stations.geojson", fc(transit));

// ─────────────────────────────────────────────────────────────────────────
// 6. CU LANDS (named CU PMO holdings — best-effort match from OSM)
// Look for named features matching known CU properties.
// ─────────────────────────────────────────────────────────────────────────

console.log("[cu-lands]");
// PMCU portfolio (https://pmcu.co.th/) — the full list of CU-managed property,
// matched against OSM by name. Each entry resolves to the first polygon found
// whose OSM `name` matches. Missing IDs fall through to a manual file below.
const CU_LAND_NAMES = [
  // Siam Square cluster
  { match: /\bSIAMSCAPE\b|สยามสเคป/i,           id: "siamscape",          color: "#B7307A", kind: "commercial" },
  { match: /Siam Square One|สยามสแควร์วัน/i,   id: "siam-square-one",    color: "#B7307A", kind: "commercial" },
  { match: /Siam Square|สยามสแควร์/i,          id: "siam-square",        color: "#B7307A", kind: "commercial" },
  { match: /Siamkit|สยามกิจ/i,                 id: "siamkit",            color: "#B7307A", kind: "commercial" },
  { match: /Block 28X|บล็อก ?28X/i,            id: "block-28x",          color: "#facc15", kind: "mixed-use" },
  { match: /\bBlock 28\b|บล็อก ?28\b/i,        id: "block-28",           color: "#facc15", kind: "commercial" },
  { match: /\bBlock 33\b|บล็อก ?33\b/i,        id: "block-33",           color: "#c084fc", kind: "residential" },
  { match: /\bBlock 34\b|บล็อก ?34\b/i,        id: "block-34",           color: "#c084fc", kind: "mixed-use" },

  // Samyan + Suan Luang
  { match: /Samyan Mitr ?town|สามย่านมิตรทาวน์/i, id: "samyan-mitrtown",  color: "#38bdf8", kind: "mixed-use" },
  { match: /(ตลาด)?สามย่าน(ใหม่)?$|Samyan Market/i, id: "samyan-market",  color: "#fbbf24", kind: "commercial" },
  { match: /Chamchuri Square|จัตุรัสจามจุรี|จามจุรีสแควร์/i,  id: "chamchuri-square",   color: "#38bdf8", kind: "mixed-use" },
  { match: /Suan ?Luang Square|สวนหลวงสแควร์/i,id: "suan-luang-square",  color: "#fbbf24", kind: "commercial" },
  // Banthat Thong food strip is a road, not a polygon — handled separately if needed.

  // CU-leased commercial (MBK / Stadium One)
  { match: /MBK( Center)?|เอ็มบีเค/i,           id: "mbk-center",         color: "#a78bfa", kind: "commercial" },
  { match: /Stadium One|สเตเดียมวัน/i,         id: "stadium-one",        color: "#f59e0b", kind: "commercial" },

  // Sport + park + cultural
  // Suphachalasai = the main CU stadium complex at National Stadium BTS; OSM tags it as "สนามกีฬาแห่งจุฬาลงกรณ์มหาวิทยาลัย" with leisure=stadium.
  { match: /Suphachalasai|ศุภชลาศัย|สนามกีฬาแห่งจุฬาลงกรณ์/i, id: "suphachalasai-stadium", color: "#34d399", kind: "athletic" },
  // Nimibutr — indoor arena adjacent to Suphachalasai (also CU land).
  { match: /Nimibutr|นิมิบุตร/i,               id: "nimibutr-arena",        color: "#34d399", kind: "athletic" },
  { match: /Thephasadin|เทพหัสดิน/i,           id: "thephasadin-stadium",   color: "#34d399", kind: "athletic" },
  { match: /Centenary Park|อุทยาน ?100/i,      id: "centenary-park",     color: "#34d399", kind: "park" },
  { match: /สวนสาธารณะร้อยปี|อุทยาน 100 ปี/i, id: "centenary-park",     color: "#34d399", kind: "park" },
  { match: /Chao Mae Thapthim|ศาลเจ้าแม่ทับทิม/i, id: "thapthim-shrine", color: "#fb7185", kind: "cultural" },

  // Healthcare + residential
  { match: /CU iHOUSE|ซีอียู ?ไอ.?เฮาส์|U[ -]?Center/i, id: "cu-ihouse",  color: "#c084fc", kind: "residential" },
  { match: /Chulalongkorn (Memorial )?Hospital|โรงพยาบาลจุฬาลงกรณ์|รพ\.จุฬา/i, id: "chula-hospital", color: "#ef4444", kind: "healthcare" },
];
// Search both campus + buildings for these named features.
// For each PMCU entry, collect every matching polygon, then keep the LARGEST —
// this avoids matching a sales office / shrine / flat instead of the full block.
const namedPool = [
  ...campusSrc.features,
  ...buildingsSrc.features,
].filter((f) => f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon");

const polygonArea = (rings) => {
  // Spherical-trapezoidal approximation good enough for ranking within Bangkok.
  let sum = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      sum += (x2 - x1) * (y1 + y2);
    }
  }
  return Math.abs(sum / 2);
};
const featureArea = (f) => {
  const g = f.geometry;
  if (g.type === "Polygon") return polygonArea([g.coordinates[0]]);
  if (g.type === "MultiPolygon") return polygonArea(g.coordinates.map((p) => p[0]));
  return 0;
};

// Skip patterns: features that *contain* the keyword but obviously aren't the
// CU land we want (sub-buildings, sales offices, shrines, fire-station flats).
const SKIP_PATTERNS = [
  /สำนักงานขาย/i,         // sales office
  /แฟลต/i,                // residential flat
  /ศาลเจ้า|ศาลหลวง/i,    // shrines (unless this IS the shrine target)
  /Center Point|เซ็นเตอร์พอยน์/i, // food court inside Siam Square
  /สถานีดับเพลิง/i,       // fire station (sub-building)
];

// Match features to IDs in CU_LAND_NAMES order (most specific first), so e.g.
// "Siam Square One" claims its building before the broader "Siam Square" regex
// is allowed to grab it.
const seen = new Map();
const claimedFeatures = new Set();

for (const def of CU_LAND_NAMES) {
  let best = null;
  let bestArea = 0;
  for (const f of namedPool) {
    if (claimedFeatures.has(f)) continue;
    const n = f.properties?.name;
    if (typeof n !== "string") continue;
    if (!def.match.test(n)) continue;
    const isShrineDef = def.id === "thapthim-shrine";
    if (!isShrineDef && SKIP_PATTERNS.some((p) => p.test(n))) continue;
    const area = featureArea(f);
    if (area <= bestArea) continue;
    bestArea = area;
    best = f;
  }
  if (!best) continue;
  claimedFeatures.add(best);
  const n = best.properties.name;
  seen.set(def.id, {
    type: "Feature",
    properties: {
      id: def.id,
      name: { en: n, th: n, zh: n },
      kind: def.kind,
      operator: "Chulalongkorn University Property Management Office (PMCU)",
      color: def.color,
      describe: n,
    },
    geometry: best.geometry,
  });
}
const cuLands = [...seen.values()];
const unresolved = CU_LAND_NAMES
  .filter((d) => !seen.has(d.id))
  .map((d) => d.id);
console.log(`  ${cuLands.length}/${CU_LAND_NAMES.length} CU lands resolved from OSM`);
if (unresolved.length) console.log(`  unresolved: ${unresolved.join(", ")}`);
await write("cu-lands.geojson", fc(cuLands));

// ─────────────────────────────────────────────────────────────────────────
// 7. BUILDINGS (now with extended footprint coverage)
// We include any building whose centroid sits inside the campus polygon OR
// any of the resolved CU-lands polygons (Siam Square, MBK, Samyan Mitrtown,
// Chamchuri Square, Stadium One, Suphachalasai, etc.), PLUS any building
// whose name matches Chulalongkorn / จุฬา anywhere in the bbox.
// ─────────────────────────────────────────────────────────────────────────

console.log("[buildings:filter]");

// Build inside-tests for every CU-lands polygon
const cuLandRings = [];
for (const f of cuLands) {
  const g = f.geometry;
  if (g.type === "Polygon") cuLandRings.push(g.coordinates[0]);
  else if (g.type === "MultiPolygon") for (const p of g.coordinates) cuLandRings.push(p[0]);
}
const insideAnyCuLand = (pt) => cuLandRings.some((ring) => isInside(pt, ring));

const buildings = buildingsSrc.features
  .filter((f) => f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")
  .filter((f) => {
    const c = featureCentroid(f);
    return (
      insideCampus(c) ||
      insideAnyCuLand(c) ||
      matchName(/Chulalongkorn|จุฬา|Siam Square|MBK|Samyan|Chamchuri|Centenary/i)(f)
    );
  })
  .map((f) => ({
    type: "Feature",
    properties: {
      id: String(f.id ?? f.properties.id ?? Math.random()),
      name: f.properties.name ?? null,
      nameEn: f.properties["name:en"] ?? null,
      nameTh: f.properties["name:th"] ?? null,
      building: f.properties.building ?? "yes",
      levels: f.properties["building:levels"] ? Number(f.properties["building:levels"]) : null,
      height: f.properties.height ? Number(f.properties.height) : null,
      operator: f.properties.operator ?? null,
    },
    geometry: f.geometry,
  }));
console.log(`  ${buildings.length} buildings kept (campus + ${cuLandRings.length} CU-lands rings + name match)`);
await write("chula-buildings.geojson", fc(buildings));

// ─────────────────────────────────────────────────────────────────────────
// 8. CAMPUS GATES / ENTRANCES
// Every node tagged barrier=gate / barrier=lift_gate / entrance=* inside or
// touching the campus polygon. Keep the name if any; the famous ones —
// Phaya Thai 1/2/3, Henri Dunant 1/2, Black Gate (ประตูดำ) — light up by
// rendering named gates larger.
// ─────────────────────────────────────────────────────────────────────────

console.log("[gates]");
const gateFeatures = campusSrc.features.filter((f) => {
  if (f.geometry.type !== "Point") return false;
  const p = f.properties ?? {};
  const isGate = p.barrier === "gate" || p.barrier === "lift_gate" || !!p.entrance;
  if (!isGate) return false;
  return insideCampus(f.geometry.coordinates) || campusRings.some((ring) => {
    // also keep gates within ~50 m of the boundary (some lie just outside)
    const [x, y] = f.geometry.coordinates;
    return ring.some(([rx, ry]) => Math.hypot(rx - x, ry - y) < 0.0005);
  });
});

const gates = gateFeatures.map((f) => {
  const p = f.properties ?? {};
  const name = p["name:en"] || p.name || null;
  const nameTh = p["name:th"] || (typeof p.name === "string" ? p.name : null);
  return {
    type: "Feature",
    properties: {
      id: String(f.id ?? `gate-${f.geometry.coordinates.join(",")}`),
      kind: p.barrier === "lift_gate" ? "lift-gate" : p.entrance ? "entrance" : "gate",
      name,
      nameTh,
      named: !!name || !!nameTh,
    },
    geometry: f.geometry,
  };
});
console.log(`  ${gates.length} gates / entrances (${gates.filter((g) => g.properties.named).length} named)`);
await write("chula-gates.geojson", fc(gates));

// ─────────────────────────────────────────────────────────────────────────
// 9. BTS / MRT LINE GEOMETRY
// Use the route relations as the source of truth — each relation has the
// ordered way members + a ref/name we can colour by line.
// ─────────────────────────────────────────────────────────────────────────

console.log("[transit-lines]");
let transitLines = [];
try {
  const transitLinesSrc = await read("transit-lines.geojson");
  const SYSTEM_FOR_REF = (ref) => {
    if (!ref) return { system: "BTS", line: "Unknown", color: "#888888" };
    const r = ref.toLowerCase();
    if (r.includes("สุขุมวิท") || r.includes("sukhumvit") || r.includes("bts-light_green")) return { system: "BTS", line: "Sukhumvit", color: "#4CAF50" };
    if (r.includes("สีลม") || r.includes("silom") || r.includes("bts-dark_green")) return { system: "BTS", line: "Silom", color: "#057B43" };
    if (r.includes("mrt-bl") || r.includes("blue")) return { system: "MRT", line: "Blue", color: "#005AAA" };
    if (r.includes("mrt-pp") || r.includes("purple")) return { system: "MRT", line: "Purple", color: "#7B59B9" };
    if (r.includes("mrt-yl") || r.includes("yellow")) return { system: "MRT", line: "Yellow", color: "#F4C430" };
    if (r.includes("mrt-pk") || r.includes("pink")) return { system: "MRT", line: "Pink", color: "#E91E63" };
    if (r.includes("apm gold") || r.includes("gold")) return { system: "ART", line: "Gold", color: "#C9A227" };
    if (r.includes("arl") || r.includes("airport")) return { system: "ART", line: "Airport Rail Link", color: "#E91E63" };
    return { system: "BTS", line: r, color: "#888888" };
  };
  const routeRelations = transitLinesSrc.features.filter(
    (f) => f.properties?.type === "route" && ["subway", "light_rail", "monorail"].includes(f.properties?.route),
  );
  // Deduplicate by ref+name so the inbound and outbound directions collapse to one line.
  const seenRoutes = new Set();
  for (const r of routeRelations) {
    const ref = r.properties.ref ?? r.properties.name ?? "";
    const lineKey = ref.replace(/\(.*\)|→.*/, "").trim();
    if (seenRoutes.has(lineKey)) continue;
    seenRoutes.add(lineKey);
    const meta = SYSTEM_FOR_REF(ref);
    const geom = r.geometry;
    if (!geom) continue;
    transitLines.push({
      type: "Feature",
      properties: {
        id: `${meta.system}-${meta.line}`,
        ref: ref,
        ...meta,
      },
      geometry: geom,
    });
  }
  console.log(`  ${transitLines.length} unique BTS/MRT lines`);
} catch (err) {
  console.log(`  skipped: ${err.message}`);
}
await write("transit-lines.geojson", fc(transitLines));

// ─────────────────────────────────────────────────────────────────────────
// 10. TALL BUILDINGS AROUND THE CAMPUS
// Every building ≥ 30 m (≈ 10 storeys) inside the wider bbox, MINUS those
// already kept as campus buildings (so we don't render duplicates). Used as
// "skyline context" — the Pathumwan / Silom / Ratchaprasong towers.
// ─────────────────────────────────────────────────────────────────────────

console.log("[tall-buildings]");
let neighborhoodTallBuildings = [];
try {
  const tallSrc = await read("tall-buildings.geojson");
  const parseHeight = (p) => {
    if (p.height) {
      const m = String(p.height).trim().match(/([0-9.]+)/);
      if (m) return Number(m[1]);
    }
    if (p["building:levels"]) {
      const n = Number(p["building:levels"]);
      if (Number.isFinite(n)) return n * 3;
    }
    return null;
  };
  // Use the kept campus buildings' IDs to dedupe — already enriched + rendered.
  const campusBuildingIds = new Set(buildings.map((b) => b.properties.id));
  neighborhoodTallBuildings = tallSrc.features
    .filter((f) => f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")
    .map((f) => ({ feature: f, height: parseHeight(f.properties ?? {}) }))
    .filter(({ feature, height }) => {
      if (!height || height < 30) return false;
      const id = String(feature.id ?? "");
      if (campusBuildingIds.has(id)) return false;
      const c = featureCentroid(feature);
      if (insideCampus(c)) return false; // already covered by chula-buildings
      return true;
    })
    .map(({ feature, height }) => ({
      type: "Feature",
      properties: {
        id: String(feature.id),
        name: feature.properties.name ?? null,
        nameEn: feature.properties["name:en"] ?? null,
        height,
        levels: feature.properties["building:levels"] ? Number(feature.properties["building:levels"]) : null,
        building: feature.properties.building ?? "yes",
      },
      geometry: feature.geometry,
    }));
  console.log(`  ${neighborhoodTallBuildings.length} tall (≥30 m) neighborhood buildings`);
} catch (err) {
  console.log(`  skipped: ${err.message}`);
}
await write("neighborhood-tall-buildings.geojson", fc(neighborhoodTallBuildings));

console.log("[process-osm] done");
