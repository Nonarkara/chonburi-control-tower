#!/usr/bin/env node
// Fill missing `levels` / `height` on chula-buildings.geojson using simple
// heuristics so 3D extrusion paints every building. OSM has good coverage
// (~60%) — this only touches buildings where both fields are null.
//
// Heuristics, applied first match wins:
//   1. Footprint area in m² gives a coarse upper bound (huge → tall)
//   2. Thai name prefixes:
//        หอพัก   = dormitory          → 8 floors
//        อาคาร   = building / tower   → 6 floors
//        ตึก     = building / wing    → 5 floors
//        คณะ     = faculty            → 5 floors
//        สนามกีฬา = stadium            → 2 floors (low pitched roof)
//        ศาลา / ศาล = pavilion / shrine → 1 floor
//   3. EN name keywords for the same buckets
//   4. Else: 3 floors
// Each floor ≈ 3.5 m. We populate `levels` only; the renderer derives
// height via levels * 3 m (existing buildingsLayer fallback).

import fs from "node:fs/promises";
import path from "node:path";

const FILE = path.resolve("public/geo/chula-buildings.geojson");
const txt = await fs.readFile(FILE, "utf8");
const fc = JSON.parse(txt);

// Equirectangular area in m² for a ring near Bangkok (good enough for ranking).
function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += (x2 - x1) * (y1 + y2);
  }
  return Math.abs(sum / 2) * 110_540 * 107_500; // approx deg² → m²
}

function featureArea(f) {
  const g = f.geometry;
  if (g.type === "Polygon") return ringArea(g.coordinates[0]);
  if (g.type === "MultiPolygon") return ringArea(g.coordinates[0][0]);
  return 0;
}

function inferLevels(f) {
  const name = (f.properties.name ?? f.properties.nameEn ?? f.properties.nameTh ?? "").toLowerCase();
  const area = featureArea(f);

  if (/หอพัก|dormitory|residence hall/i.test(name)) return 8;
  if (/อาคาร|tower|building/i.test(name)) return 6;
  if (/^ตึก|wing/i.test(name)) return 5;
  if (/คณะ|faculty of/i.test(name)) return 5;
  if (/สนาม|stadium|gym/i.test(name)) return 2;
  if (/ศาลา|ศาล|sala|shrine|pavilion/i.test(name)) return 1;
  if (/parking|จอดรถ/i.test(name)) return 5;

  // Area-based fallback
  if (area > 3000) return 7;
  if (area > 1500) return 5;
  if (area > 600)  return 3;
  if (area > 200)  return 2;
  return 1;
}

let filled = 0;
let already = 0;
for (const f of fc.features) {
  const p = f.properties;
  if (p.levels != null || p.height != null) { already++; continue; }
  p.levels = inferLevels(f);
  filled++;
}

await fs.writeFile(FILE, JSON.stringify(fc));
console.log(`enriched ${filled} buildings, ${already} already had height/levels, total ${fc.features.length}`);

// Histogram of inferred levels
const hist = new Map();
for (const f of fc.features) {
  const v = f.properties.levels ?? null;
  hist.set(v, (hist.get(v) ?? 0) + 1);
}
const sorted = [...hist.entries()].sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
console.log("levels histogram:", sorted.map(([k, v]) => `${k ?? "null"}f=${v}`).join(" "));
