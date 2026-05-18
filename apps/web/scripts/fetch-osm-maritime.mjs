#!/usr/bin/env node
// Fetch maritime infrastructure around Chonburi / Eastern Seaboard from OSM.
// Wider bbox than the municipality to include Laem Chabang port + Si Racha
// anchorage + Koh Si Chang.

import fs from "node:fs/promises";
import path from "node:path";
import osmtogeojson from "osmtogeojson";

// Eastern Seaboard wide bbox: south, west, north, east
// Covers: Chonburi city, Bang Saen, Si Racha, Laem Chabang, Koh Si Chang, Pattaya north shore.
const BBOX = [13.05, 100.80, 13.50, 101.10];

const OVERPASS = "https://overpass.kumi.systems/api/interpreter";
const OUT = path.resolve("public/geo");

async function overpass(query) {
  console.log(`  [overpass] querying…`);
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const bbox = BBOX.join(",");

// Ports + harbour landuse
const portsQuery = `
[out:json][timeout:90];
(
  way["landuse"="harbour"](${bbox});
  way["landuse"="port"](${bbox});
  way["harbour"="yes"](${bbox});
  way["man_made"="pier"](${bbox});
  way["man_made"="breakwater"](${bbox});
  relation["landuse"="harbour"](${bbox});
  relation["harbour"="yes"](${bbox});
);
(._;>;);
out geom;
`;

// Ferry terminals + piers (points)
const ferriesQuery = `
[out:json][timeout:60];
(
  node["amenity"="ferry_terminal"](${bbox});
  node["harbour"="ferry"](${bbox});
  way["amenity"="ferry_terminal"](${bbox});
);
out center;
`;

// Lighthouses, beacons, navigation buoys
const navAidsQuery = `
[out:json][timeout:60];
(
  node["man_made"="lighthouse"](${bbox});
  node["seamark:type"="light_major"](${bbox});
  node["seamark:type"="light_minor"](${bbox});
  node["seamark:type"="beacon_lateral"](${bbox});
  node["seamark:type"="beacon_cardinal"](${bbox});
  node["seamark:type"="buoy_lateral"](${bbox});
  node["seamark:type"="buoy_cardinal"](${bbox});
);
out;
`;

const tasks = [
  ["chonburi-ports.geojson",      portsQuery],
  ["chonburi-ferries.geojson",    ferriesQuery],
  ["chonburi-nav-aids.geojson",   navAidsQuery],
];

console.log(`[fetch-osm-maritime] bbox=${bbox}`);
for (const [outFile, q] of tasks) {
  console.log(`\nfetching ${outFile}…`);
  try {
    const osm = await overpass(q);
    const fc = osmtogeojson(osm);
    const file = path.join(OUT, outFile);
    await fs.writeFile(file, JSON.stringify(fc));
    console.log(`  → ${file} · ${fc.features.length} features`);
  } catch (err) {
    console.error(`  ✕ ${outFile}: ${err.message}`);
  }
}
console.log("\n[fetch-osm-maritime] done");
