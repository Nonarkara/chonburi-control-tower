#!/usr/bin/env node
// Fetch real Chulalongkorn campus + neighborhood data from OSM Overpass,
// convert to GeoJSON, and write into public/geo/ replacing the hand-traced
// approximations. Run from apps/web/: `node scripts/fetch-osm-chula.mjs`

import fs from "node:fs/promises";
import path from "node:path";
import osmtogeojson from "osmtogeojson";

// CU outer bounding box: campus + Siam + Samyan + Suan Luang.
// Order: south,west,north,east (OSM convention).
const BBOX = [13.728, 100.515, 13.756, 100.548];

// Wider bbox for transit lines + tall building context — Pathumwan + Sathorn /
// Silom / Ratchaprasong / Chitlom belt, so the campus's place in the BTS+MRT
// network and the Asok / Silom skyline is visible.
const WIDE_BBOX = [13.715, 100.500, 13.770, 100.560];

const OVERPASS = "https://overpass-api.de/api/interpreter";
const OUT = path.resolve("public/geo/osm");

async function overpass(query) {
  console.log(`[overpass] querying… (${query.length} chars)`);
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      "user-agent": "chula-control-tower/0.1 (https://github.com/Nonarkara/chula-control-tower)",
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`overpass ${res.status} ${res.statusText} :: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

async function writeGeoJson(name, fc) {
  await fs.mkdir(OUT, { recursive: true });
  const file = path.join(OUT, name);
  await fs.writeFile(file, JSON.stringify(fc));
  console.log(`  → ${file} · ${fc.features.length} features`);
}

const bbox = BBOX.join(",");
const wideBbox = WIDE_BBOX.join(",");

// 1. Chulalongkorn campus + named CU features (relations and ways).
const campusQuery = `
[out:json][timeout:60];
(
  relation["name"~"จุฬาลงกรณ์|Chulalongkorn",i](${bbox});
  way["name"~"จุฬาลงกรณ์|Chulalongkorn",i](${bbox});
  way["amenity"="university"](${bbox});
  relation["amenity"="university"](${bbox});
);
(._;>;);
out geom;
`;

// 2. All building footprints in the bbox.
const buildingsQuery = `
[out:json][timeout:60];
way["building"](${bbox});
(._;>;);
out geom;
`;

// 3. Roads (motorway → residential), with name + highway tags.
const roadsQuery = `
[out:json][timeout:60];
way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|service|unclassified|living_street)$"](${bbox});
(._;>;);
out geom;
`;

// 4. CU Shuttle Bus routes — OSM relations tagged operator=Chulalongkorn.
const shuttleQuery = `
[out:json][timeout:60];
(
  relation["route"="bus"]["operator"~"Chulalongkorn|จุฬาลงกรณ์",i];
  relation["route"="bus"]["network"~"CU Shuttle|จุฬาฯ ป็อปบัส|CU POP",i];
);
(._;>;);
out geom;
`;

// 5. BTS / MRT stations (named) within bbox.
const transitQuery = `
[out:json][timeout:60];
(
  node["railway"="station"](${bbox});
  node["public_transport"="station"](${bbox});
);
out;
`;

// 6. Parks / leisure inside campus area.
const parksQuery = `
[out:json][timeout:60];
(
  way["leisure"="park"](${bbox});
  relation["leisure"="park"](${bbox});
  way["landuse"="grass"](${bbox});
);
(._;>;);
out geom;
`;

// 7. BTS / MRT line geometry — subway + light_rail + monorail polylines.
// Wider bbox so the Sukhumvit + Silom + Chao Phraya line sections are visible,
// not cut off at the campus edge. Also include rail-route relations so we can
// label segments by line (Sukhumvit, Silom, Blue, Gold, Yellow, Pink).
const transitLinesQuery = `
[out:json][timeout:60];
(
  way["railway"~"^(subway|light_rail|monorail)$"](${wideBbox});
  relation["route"~"^(subway|light_rail|monorail)$"](${wideBbox});
);
(._;>;);
out geom;
`;

// 8. Tall buildings around the campus — every building footprint with a
// known height ≥ 15 m (≈ 5 storeys) inside the wider bbox. Used as a
// "skyline context" layer separate from the CU-lands buildings.
const tallBuildingsQuery = `
[out:json][timeout:90];
(
  way["building"]["height"](${wideBbox});
  way["building"]["building:levels"](${wideBbox});
);
(._;>;);
out geom;
`;

const tasks = [
  ["chula-campus.geojson",   campusQuery],
  ["chula-buildings.geojson",buildingsQuery],
  ["chula-roads.geojson",    roadsQuery],
  ["cu-shuttle-osm.geojson", shuttleQuery],
  ["transit-stations.geojson", transitQuery],
  ["chula-parks.geojson",    parksQuery],
  ["transit-lines.geojson",  transitLinesQuery],
  ["tall-buildings.geojson", tallBuildingsQuery],
];

console.log(`[fetch-osm] bbox=${bbox} → writing to ${OUT}`);
for (const [outFile, q] of tasks) {
  try {
    const osm = await overpass(q);
    const fc = osmtogeojson(osm);
    await writeGeoJson(outFile, fc);
  } catch (err) {
    console.error(`  ✕ ${outFile}: ${err.message}`);
  }
}

console.log("[fetch-osm] done");
