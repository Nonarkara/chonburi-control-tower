#!/usr/bin/env node
// Fetch Chonburi Town Municipality building footprints + roads from OSM Overpass.
// Run from apps/web/: node scripts/fetch-osm-chonburi.mjs

import fs from "node:fs/promises";
import path from "node:path";
import osmtogeojson from "osmtogeojson";

// Chonburi outer municipal bounds (south, west, north, east — OSM convention)
const BBOX = [13.320, 100.940, 13.410, 101.030];

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const OUT = path.resolve("public/geo");

async function overpass(query) {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`  [overpass] → ${endpoint.split("/")[2]}`);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
          "user-agent": "chonburi-control-tower/0.1",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`  ✕ ${endpoint.split("/")[2]}: ${err.message} — trying next`);
    }
  }
  throw new Error("all Overpass endpoints failed");
}

async function writeGeoJson(name, fc) {
  const file = path.join(OUT, name);
  await fs.writeFile(file, JSON.stringify(fc));
  const polys = fc.features.filter(f => f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon").length;
  console.log(`  → ${file} · ${fc.features.length} features (${polys} polygons)`);
  return fc;
}

const bbox = BBOX.join(",");

// All building footprints in the municipality
const buildingsQuery = `
[out:json][timeout:90];
way["building"](${bbox});
(._;>;);
out geom;
`;

// Road network (motorway → residential + service)
const roadsQuery = `
[out:json][timeout:60];
way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|service|unclassified|living_street)$"](${bbox});
(._;>;);
out geom;
`;

// Transit stations (bus + train)
const transitQuery = `
[out:json][timeout:30];
(
  node["public_transport"="station"](${bbox});
  node["public_transport"="stop_position"](${bbox});
  node["highway"="bus_stop"](${bbox});
);
out;
`;

const tasks = [
  ["chonburi-buildings.geojson", buildingsQuery],
  ["chonburi-roads.geojson",     roadsQuery],
  ["chonburi-transit.geojson",   transitQuery],
];

console.log(`[fetch-osm-chonburi] bbox=${bbox}`);
for (const [outFile, q] of tasks) {
  console.log(`\nfetching ${outFile}…`);
  try {
    const osm = await overpass(q);
    const fc = osmtogeojson(osm);
    // Filter to polygon/line features only (strip bare OSM nodes)
    if (outFile.includes("roads") || outFile.includes("transit")) fc.features = fc.features.filter(f => f.geometry?.type !== "Point" || outFile.includes("transit"));
    if (outFile.includes("buildings")) fc.features = fc.features.filter(f => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon");
    await writeGeoJson(outFile, fc);
  } catch (err) {
    console.error(`  ✕ ${outFile}: ${err.message}`);
  }
}
console.log("\n[fetch-osm-chonburi] done");
