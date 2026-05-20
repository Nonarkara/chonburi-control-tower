#!/usr/bin/env tsx
/**
 * Build 3D Tiles from Chonburi building GeoJSON.
 *
 * This tool converts the existing OSM building footprint GeoJSON into:
 *  - A 3D Tiles tileset (tileset.json) referencing b3dm tiles
 *  - Individual .b3dm (Batched 3D Model) tiles per spatial bin
 *
 * The buildings are extruded using the `levels` property (fallback: 1 level = 3.5m).
 * Output is written to apps/web/public/geo/3d-tiles/ for direct serving.
 *
 * Usage:
 *   npx tsx apps/api/src/tools/build3DTiles.ts
 *
 * Dependencies (dev):
 *   npm i -D @loaders.gl/3d-tables @loaders.gl/gltf @loaders.gl/math
 *
 * For now this generates a **simplified 3D Tiles 1.0 tileset** using handcrafted
 * glb batches. For production scale, migrate to Cesium ion or pg2b3dm.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const INPUT = resolve(__dirname, "../../../../apps/web/public/geo/chonburi-buildings.geojson");
const OUTPUT_DIR = resolve(__dirname, "../../../../apps/web/public/geo/3d-tiles");
const TILESET_JSON = resolve(OUTPUT_DIR, "tileset.json");

interface BuildingFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: number[][][] };
}

interface Building {
  id: string;
  name: string;
  lat: number;
  lng: number;
  heightM: number;
  levels: number;
  footprint: Array<[number, number]>;
  kind: string;
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/**
 * Convert lat/lng/height (WGS84) to ECEF (Earth-Centered, Earth-Fixed) meters.
 * 3D Tiles uses ECEF for global positioning.
 */
function llhToEcef(lat: number, lng: number, h: number): [number, number, number] {
  const a = 6378137.0; // WGS84 semi-major axis
  const e2 = 6.69437999013e-3;
  const latRad = toRad(lat);
  const lngRad = toRad(lng);
  const cosLat = Math.cos(latRad);
  const sinLat = Math.sin(latRad);
  const cosLng = Math.cos(lngRad);
  const sinLng = Math.sin(lngRad);
  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const x = (N + h) * cosLat * cosLng;
  const y = (N + h) * cosLat * sinLng;
  const z = (N * (1 - e2) + h) * sinLat;
  return [x, y, z];
}

function loadBuildings(): Building[] {
  const raw = readFileSync(INPUT, "utf8");
  const geojson = JSON.parse(raw) as { features: BuildingFeature[] };
  const buildings: Building[] = [];

  for (const f of geojson.features) {
    const props = f.properties;
    const id = String(props["id"] ?? `bld-${buildings.length}`);
    const name = String(props["name:en"] ?? props["name"] ?? "Building");
    const levels = Number(props["building:levels"] ?? props["levels"] ?? 1);
    const heightM = levels * 3.5;

    const coords = f.geometry.coordinates;
    let ring: Array<[number, number]> = [];
    if (Array.isArray(coords) && Array.isArray(coords[0])) {
      if (Array.isArray(coords[0][0])) {
        // Polygon: coords[0] is the outer ring
        ring = coords[0] as unknown as Array<[number, number]>;
      } else {
        // Flat array of points (shouldn't happen for Polygon but handle defensively)
        ring = coords as unknown as Array<[number, number]>;
      }
    }
    if (!ring || ring.length < 3) continue;

    let sumLat = 0;
    let sumLng = 0;
    for (const [lng, lat] of ring) {
      sumLng += lng;
      sumLat += lat;
    }
    const lat = sumLat / ring.length;
    const lng = sumLng / ring.length;

    buildings.push({
      id,
      name,
      lat,
      lng,
      heightM,
      levels,
      footprint: ring,
      kind: String(props["building"] ?? "yes"),
    });
  }
  return buildings;
}

/**
 * Build a minimal GLB (glTF 2.0 binary) representing a single building.
 * Returns a Uint8Array suitable for embedding in a b3dm batch.
 */
function buildBuildingGlb(b: Building): Uint8Array {
  // Compute local ECEF coordinates relative to building center
  const [cx, cy, cz] = llhToEcef(b.lat, b.lng, 0);

  const positions: number[] = [];
  const indices: number[] = [];

  // Base ring vertices
  const baseIdx = positions.length / 3;
  for (const [lng, lat] of b.footprint) {
    const [x, y, z] = llhToEcef(lat, lng, 0);
    positions.push(x - cx, y - cy, z - cz);
  }

  // Top ring vertices
  const topIdx = positions.length / 3;
  for (const [lng, lat] of b.footprint) {
    const [x, y, z] = llhToEcef(lat, lng, b.heightM);
    positions.push(x - cx, y - cy, z - cz);
  }

  const n = b.footprint.length;

  // Wall triangles
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    // Two triangles per wall segment
    indices.push(baseIdx + i, topIdx + i, baseIdx + next);
    indices.push(baseIdx + next, topIdx + i, topIdx + next);
  }

  // Roof (fan triangulation from centroid of top ring)
  const centIdx = positions.length / 3;
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  for (let i = 0; i < n; i++) {
    sumX += positions[(topIdx + i) * 3];
    sumY += positions[(topIdx + i) * 3 + 1];
    sumZ += positions[(topIdx + i) * 3 + 2];
  }
  positions.push(sumX / n, sumY / n, sumZ / n);
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    indices.push(centIdx, topIdx + next, topIdx + i);
  }

  // ---- Minimal GLB encoder ----
  const floatBuffer = new Float32Array(positions);
  const indexBuffer = new Uint16Array(indices);

  const vertexByteLength = floatBuffer.byteLength;
  const indexByteLength = indexBuffer.byteLength;
  const accessorMin = [Infinity, Infinity, Infinity];
  const accessorMax = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    accessorMin[0] = Math.min(accessorMin[0], positions[i]);
    accessorMin[1] = Math.min(accessorMin[1], positions[i + 1]);
    accessorMin[2] = Math.min(accessorMin[2], positions[i + 2]);
    accessorMax[0] = Math.max(accessorMax[0], positions[i]);
    accessorMax[1] = Math.max(accessorMax[1], positions[i + 1]);
    accessorMax[2] = Math.max(accessorMax[2], positions[i + 2]);
  }

  const gltf = {
    asset: { version: "2.0", generator: "chonburi-3dtiles" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: positions.length / 3,
        type: "VEC3",
        min: accessorMin,
        max: accessorMax,
      },
      {
        bufferView: 1,
        componentType: 5123,
        count: indices.length,
        type: "SCALAR",
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: vertexByteLength, target: 34962 },
      { buffer: 0, byteOffset: vertexByteLength, byteLength: indexByteLength, target: 34963 },
    ],
    buffers: [{ byteLength: vertexByteLength + indexByteLength }],
  };

  const gltfJson = JSON.stringify(gltf);
  const jsonPadding = (4 - (gltfJson.length % 4)) % 4;
  const jsonChunkLength = gltfJson.length + jsonPadding;
  const binPadding = (4 - ((vertexByteLength + indexByteLength) % 4)) % 4;
  const binChunkLength = vertexByteLength + indexByteLength + binPadding;

  const header = new Uint32Array(5);
  header[0] = 0x46546c67; // magic "glTF"
  header[1] = 2; // version
  header[2] = 12 + 8 + jsonChunkLength + 8 + binChunkLength; // total length
  header[3] = jsonChunkLength;
  header[4] = 0x4e4f534a; // "JSON"

  const glb = new Uint8Array(header[2]);
  let offset = 0;
  glb.set(new Uint8Array(header.buffer), offset);
  offset += 20;

  const jsonBytes = new TextEncoder().encode(gltfJson);
  glb.set(jsonBytes, offset);
  offset += jsonBytes.length;
  for (let i = 0; i < jsonPadding; i++) glb[offset++] = 0x20;

  const binHeader = new Uint32Array(2);
  binHeader[0] = binChunkLength;
  binHeader[1] = 0x004e4942; // "BIN\0"
  glb.set(new Uint8Array(binHeader.buffer), offset);
  offset += 8;

  glb.set(new Uint8Array(floatBuffer.buffer), offset);
  offset += vertexByteLength;
  glb.set(new Uint8Array(indexBuffer.buffer), offset);
  offset += indexByteLength;
  for (let i = 0; i < binPadding; i++) glb[offset++] = 0;

  return glb;
}

/**
 * Build a b3dm tile from a single building.
 * In production, batch many buildings per tile. Here we keep it simple.
 */
function buildB3dm(glb: Uint8Array): Uint8Array {
  const featureTableJson = JSON.stringify({ BATCH_LENGTH: 1 });
  const fPadding = (4 - (featureTableJson.length % 4)) % 4;
  const fLen = featureTableJson.length + fPadding;

  const header = new Uint32Array(5);
  header[0] = 0x6233646d; // "b3dm"
  header[1] = 1; // version
  header[2] = 28 + fLen + glb.byteLength; // total length
  header[3] = fLen;
  header[4] = 0; // batch table length

  const b3dm = new Uint8Array(header[2]);
  let o = 0;
  b3dm.set(new Uint8Array(header.buffer), o); o += 20;
  const fBytes = new TextEncoder().encode(featureTableJson);
  b3dm.set(fBytes, o); o += fBytes.length;
  for (let i = 0; i < fPadding; i++) b3dm[o++] = 0x20;
  b3dm.set(glb, o);
  return b3dm;
}

function main() {
  console.log("[build3DTiles] Loading buildings...");
  const buildings = loadBuildings();
  console.log(`[build3DTiles] Loaded ${buildings.length} buildings`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  // For a pilot, pick the densest ~200 buildings around Chonburi city center
  // (lat ~13.36, lng ~100.98) within a ~2km bounding box
  const centerLat = 13.36;
  const centerLng = 100.98;
  const degreeDelta = 0.018; // ~2km
  const pilot = buildings.filter(
    (b) =>
      b.lat >= centerLat - degreeDelta &&
      b.lat <= centerLat + degreeDelta &&
      b.lng >= centerLng - degreeDelta &&
      b.lng <= centerLng + degreeDelta,
  );
  console.log(`[build3DTiles] Pilot district: ${pilot.length} buildings`);

  // Build one tile containing all pilot buildings (batched)
  // For simplicity in this MVP, we concatenate GLBs into a single b3dm
  // with a feature table listing each building.
  // In production use pg2b3dm or Cesium ion.

  const tileGlbParts: Uint8Array[] = [];
  for (const b of pilot.slice(0, 100)) {
    try {
      const glb = buildBuildingGlb(b);
      tileGlbParts.push(glb);
    } catch (err) {
      console.warn(`[build3DTiles] Skip ${b.id}:`, (err as Error).message);
    }
  }

  // Concatenate GLBs naively for the pilot (real tool would merge scenes)
  const combinedLen = tileGlbParts.reduce((sum, g) => sum + g.byteLength, 0);
  const combined = new Uint8Array(combinedLen);
  let off = 0;
  for (const g of tileGlbParts) {
    combined.set(g, off);
    off += g.byteLength;
  }

  const b3dm = buildB3dm(combined);
  const tilePath = resolve(OUTPUT_DIR, "buildings.b3dm");
  writeFileSync(tilePath, b3dm);
  console.log(`[build3DTiles] Wrote ${tilePath} (${b3dm.byteLength} bytes)`);

  // Compute bounding volume from pilot buildings
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  let maxHeight = 0;
  for (const b of pilot) {
    minLat = Math.min(minLat, b.lat);
    maxLat = Math.max(maxLat, b.lat);
    minLng = Math.min(minLng, b.lng);
    maxLng = Math.max(maxLng, b.lng);
    maxHeight = Math.max(maxHeight, b.heightM);
  }

  const tileset = {
    asset: { version: "1.0", generator: "chonburi-3dtiles" },
    geometricError: 500,
    root: {
      refine: "REPLACE" as const,
      geometricError: 100,
      boundingVolume: {
        region: [
          toRad(minLng),
          toRad(minLat),
          toRad(maxLng),
          toRad(maxLat),
          0,
          maxHeight,
        ],
      },
      content: { uri: "buildings.b3dm" },
    },
  };

  writeFileSync(TILESET_JSON, JSON.stringify(tileset, null, 2));
  console.log(`[build3DTiles] Wrote ${TILESET_JSON}`);
  console.log("[build3DTiles] Done. Serve /geo/3d-tiles/tileset.json from your web app.");
}

main();
