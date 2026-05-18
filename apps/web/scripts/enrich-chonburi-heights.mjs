#!/usr/bin/env node
// Enrich missing height/levels on chonburi-buildings.geojson.
// Run from apps/web/: node scripts/enrich-chonburi-heights.mjs

import fs from "node:fs/promises";
import path from "node:path";

const FILE = path.resolve("public/geo/chonburi-buildings.geojson");
const txt = await fs.readFile(FILE, "utf8");
const fc = JSON.parse(txt);

function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += (x2 - x1) * (y1 + y2);
  }
  return Math.abs(sum / 2) * 110_540 * 107_500;
}

function featureArea(f) {
  const g = f.geometry;
  if (g.type === "Polygon") return ringArea(g.coordinates[0]);
  if (g.type === "MultiPolygon") return ringArea(g.coordinates[0][0]);
  return 0;
}

function inferLevels(f) {
  const p = f.properties;
  const name = (p.name ?? p["name:en"] ?? p["name:th"] ?? "").toLowerCase();
  const type = (p.building ?? "").toLowerCase();
  const area = featureArea(f);

  // Building type tags (OSM building= values)
  if (type === "apartments" || type === "residential") return 6;
  if (type === "hotel")                                 return 8;
  if (type === "hospital")                              return 5;
  if (type === "school" || type === "university")       return 4;
  if (type === "retail" || type === "commercial")       return 3;
  if (type === "industrial" || type === "warehouse")    return 2;
  if (type === "garage" || type === "parking")          return 4;
  if (type === "temple" || type === "church")           return 2;
  if (type === "shed" || type === "roof")               return 1;
  if (type === "kiosk")                                 return 1;

  // Thai name heuristics
  if (/โรงแรม|hotel/i.test(name))                   return 8;
  if (/อาคาร|tower|building/i.test(name))            return 6;
  if (/โรงพยาบาล|hospital/i.test(name))              return 5;
  if (/ตึก|wing/i.test(name))                        return 5;
  if (/คอนโด|condominium/i.test(name))               return 8;
  if (/วัด|temple|wat\b/i.test(name))                return 2;
  if (/โรงเรียน|school/i.test(name))                 return 3;
  if (/ตลาด|market/i.test(name))                     return 2;
  if (/สนาม|stadium|gym/i.test(name))                return 2;
  if (/ศาลา|sala|pavilion/i.test(name))              return 1;

  // Area-based fallback (Chonburi is mostly 1–4 storey urban fabric)
  if (area > 5000) return 6;
  if (area > 2000) return 4;
  if (area > 800)  return 3;
  if (area > 300)  return 2;
  return 1;
}

// Only process polygon/multipolygon features (buildings are ways → polygons)
let filled = 0, already = 0, skipped = 0;
for (const f of fc.features) {
  if (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon") {
    skipped++;
    continue;
  }
  const p = f.properties;
  if (p.height != null || p.levels != null) { already++; continue; }
  p.levels = inferLevels(f);
  filled++;
}

await fs.writeFile(FILE, JSON.stringify(fc));
console.log(`enriched ${filled} buildings, ${already} already had data, ${skipped} non-polygon skipped`);
console.log(`total features: ${fc.features.length}`);

const hist = new Map();
for (const f of fc.features) {
  const v = f.properties.levels ?? (f.properties.height ? `${f.properties.height}m` : null);
  hist.set(v, (hist.get(v) ?? 0) + 1);
}
const sorted = [...hist.entries()].sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
console.log("levels:", sorted.map(([k, v]) => `${k ?? "—"}→${v}`).join("  "));
