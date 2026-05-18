#!/usr/bin/env node
/**
 * Fetch civic + hydrology data for Chonburi province from OSM Overpass.
 * Run from apps/web/: node scripts/fetch-osm-civic.mjs
 *
 * Output files in public/geo/:
 *   chonburi-waterways.geojson  — canals, rivers, drainage
 *   chonburi-civic.geojson      — single FC with all civic POIs tagged
 */

import fs from "node:fs/promises";
import path from "node:path";
import osmtogeojson from "osmtogeojson";

// Whole-province bbox: Chonburi province extends from Bangsaen north
// down to the Cambodia border south. We use the operational Eastern
// Seaboard envelope (matches FEED_BBOX).
const BBOX = [12.50, 100.70, 13.55, 101.50];

const OVERPASS = "https://overpass.kumi.systems/api/interpreter";
const OUT = path.resolve("public/geo");

async function overpass(query) {
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function writeGeoJson(name, fc) {
  const file = path.join(OUT, name);
  await fs.writeFile(file, JSON.stringify(fc));
  console.log(`  → ${file} · ${fc.features.length} features`);
  return fc;
}

const bbox = BBOX.join(",");

// 1. Waterways — canals, rivers, drains
const waterwaysQuery = `
[out:json][timeout:90];
(
  way["waterway"~"^(river|canal|stream|drain|ditch)$"](${bbox});
  relation["waterway"](${bbox});
);
(._;>;);
out geom;
`;

// 2. Civic POIs — all categories in one query, tagged with their kind.
//    We rely on amenity / healthcare / emergency / man_made tags.
const civicQuery = `
[out:json][timeout:120];
(
  // Health
  node["amenity"~"^(hospital|clinic|doctors|pharmacy)$"](${bbox});
  way["amenity"~"^(hospital|clinic)$"](${bbox});
  node["healthcare"~"^(hospital|clinic|doctor|pharmacy|centre)$"](${bbox});
  way["healthcare"~"^(hospital|clinic|centre)$"](${bbox});
  // Education
  node["amenity"~"^(school|university|college|kindergarten)$"](${bbox});
  way["amenity"~"^(school|university|college|kindergarten)$"](${bbox});
  // Safety
  node["amenity"="police"](${bbox});
  way["amenity"="police"](${bbox});
  node["amenity"="fire_station"](${bbox});
  way["amenity"="fire_station"](${bbox});
  // Government
  node["amenity"~"^(townhall|courthouse|post_office)$"](${bbox});
  way["amenity"~"^(townhall|courthouse|post_office)$"](${bbox});
  node["office"="government"](${bbox});
  way["office"="government"](${bbox});
  // Religion
  node["amenity"="place_of_worship"](${bbox});
  way["amenity"="place_of_worship"](${bbox});
  // Markets + commerce hubs
  node["amenity"="marketplace"](${bbox});
  way["amenity"="marketplace"](${bbox});
  // Transport hubs
  node["amenity"~"^(bus_station|ferry_terminal)$"](${bbox});
  node["public_transport"="station"](${bbox});
  way["amenity"="bus_station"](${bbox});
  // Utilities / infra
  node["power"="substation"](${bbox});
  way["power"="substation"](${bbox});
  way["man_made"~"^(water_works|reservoir_covered|wastewater_plant)$"](${bbox});
);
out center;
`;

console.log("[fetch-osm-civic] bbox =", bbox);

console.log("\nfetching waterways…");
try {
  const osm = await overpass(waterwaysQuery);
  const fc = osmtogeojson(osm);
  fc.features = fc.features.filter(f =>
    f.geometry?.type === "LineString" ||
    f.geometry?.type === "MultiLineString" ||
    f.geometry?.type === "Polygon" ||
    f.geometry?.type === "MultiPolygon"
  );
  await writeGeoJson("chonburi-waterways.geojson", fc);
} catch (err) { console.error("  ✕", err.message); }

console.log("\nfetching civic POIs…");
try {
  const osm = await overpass(civicQuery);
  const fc = osmtogeojson(osm);
  // Normalise to Point only — use 'center' lat/lng for ways
  fc.features = fc.features.map(f => {
    if (f.geometry?.type === "Point") return f;
    // ways with center extension produce { center: { lat, lon } } in raw OSM
    const raw = osm.elements?.find(e => e.id === Number(f.id?.split("/")[1]) || String(e.id) === String(f.id));
    if (raw?.center) {
      return {
        ...f,
        geometry: { type: "Point", coordinates: [raw.center.lon, raw.center.lat] },
      };
    }
    // For polygon ways without center, use first coord as fallback
    if (f.geometry?.type === "Polygon" && f.geometry.coordinates[0]?.[0]) {
      return {
        ...f,
        geometry: { type: "Point", coordinates: f.geometry.coordinates[0][0] },
      };
    }
    return null;
  }).filter(Boolean);

  // Tag each feature with a normalized 'kind' for our palette
  for (const f of fc.features) {
    const p = f.properties || {};
    const a = p.amenity || "";
    const h = p.healthcare || "";
    const e = p.emergency || "";
    const m = p["man_made"] || "";
    let kind = "other";
    if (a === "hospital" || h === "hospital") kind = "hospital";
    else if (a === "clinic" || h === "clinic" || h === "doctor" || h === "centre" || a === "doctors") kind = "clinic";
    else if (a === "pharmacy" || h === "pharmacy") kind = "pharmacy";
    else if (a === "school") kind = "school";
    else if (a === "university" || a === "college") kind = "university";
    else if (a === "kindergarten") kind = "kindergarten";
    else if (a === "police") kind = "police";
    else if (a === "fire_station" || e === "fire_station") kind = "fire";
    else if (a === "townhall" || p.office === "government") kind = "government";
    else if (a === "courthouse") kind = "courthouse";
    else if (a === "post_office") kind = "post";
    else if (a === "place_of_worship") {
      const r = p.religion || "";
      if (r === "buddhist") kind = "temple-buddhist";
      else if (r === "christian") kind = "church";
      else if (r === "muslim") kind = "mosque";
      else kind = "temple-buddhist";
    }
    else if (a === "marketplace") kind = "market";
    else if (a === "bus_station") kind = "bus-station";
    else if (a === "ferry_terminal") kind = "ferry";
    else if (p.power === "substation") kind = "power-substation";
    else if (m === "water_works" || m === "reservoir_covered") kind = "water-works";
    else if (m === "wastewater_plant") kind = "wastewater";
    f.properties = { ...p, kind };
  }

  await writeGeoJson("chonburi-civic.geojson", fc);

  const counts = {};
  for (const f of fc.features) counts[f.properties.kind] = (counts[f.properties.kind] || 0) + 1;
  console.log("  by kind:", JSON.stringify(counts));
} catch (err) { console.error("  ✕", err.message); }

console.log("\n[fetch-osm-civic] done");
