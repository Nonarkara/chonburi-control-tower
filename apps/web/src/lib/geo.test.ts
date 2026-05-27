import { describe, it, expect } from "vitest";
import { centroid } from "./geo";
import type { MultiPolygon, Polygon } from "geojson";

/**
 * centroid() contract tests.
 *
 * centroid() computes the arithmetic mean of all ring vertices (including the
 * closing duplicate) — a fast approximation used for map fly-to navigation in
 * BuildingSearch. The closing vertex pulls the result slightly toward the
 * first vertex, but for map navigation the result is always within the bbox.
 *
 * Getting it wrong pans the map to the wrong location when an operator clicks
 * a building in the search.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rect(
  minLng: number, minLat: number,
  maxLng: number, maxLat: number,
): Polygon {
  // 5 ring positions (closing vertex = first vertex)
  return {
    type: "Polygon",
    coordinates: [[
      [minLng, minLat],
      [maxLng, minLat],
      [maxLng, maxLat],
      [minLng, maxLat],
      [minLng, minLat], // closed ring
    ]],
  };
}

// ─── Polygon ──────────────────────────────────────────────────────────────────

describe("centroid — Polygon", () => {
  it("result is inside the bounding box for any rectangle", () => {
    const geom = rect(100.978, 13.360, 100.980, 13.362);
    const [lng, lat] = centroid(geom);
    expect(lng).toBeGreaterThanOrEqual(100.978);
    expect(lng).toBeLessThanOrEqual(100.980);
    expect(lat).toBeGreaterThanOrEqual(13.360);
    expect(lat).toBeLessThanOrEqual(13.362);
  });

  it("returns [lng, lat] order (deck.gl coordinate convention)", () => {
    const geom = rect(100.9, 13.3, 101.0, 13.4);
    const [lng, lat] = centroid(geom);
    // lng should be near 100.9–101.0, not 13.3–13.4
    expect(lng).toBeGreaterThan(100);
    expect(lat).toBeLessThan(15);
    // Arithmetic mean of 5 positions: minLng appears 3×, maxLng 2×
    // lng: (100.9×3 + 101.0×2) / 5 = 100.94
    expect(lng).toBeCloseTo(100.94, 2);
    // lat: (13.3×3 + 13.4×2) / 5 = 13.34
    expect(lat).toBeCloseTo(13.34, 2);
  });

  it("computes correct mean for a known unit rectangle", () => {
    // Ring: [0,0],[2,0],[2,2],[0,2],[0,0] → 5 positions
    // mean_x = (0+2+2+0+0)/5 = 0.8, mean_y same
    const geom = rect(0, 0, 2, 2);
    const [lng, lat] = centroid(geom);
    expect(lng).toBeCloseTo(0.8, 5);
    expect(lat).toBeCloseTo(0.8, 5);
  });

  it("works with a non-square rectangle", () => {
    // Wide rectangle [0,0]–[4,2]
    // Ring: [0,0],[4,0],[4,2],[0,2],[0,0]
    // mean_x = (0+4+4+0+0)/5 = 8/5 = 1.6
    // mean_y = (0+0+2+2+0)/5 = 4/5 = 0.8
    const geom = rect(0, 0, 4, 2);
    const [lng, lat] = centroid(geom);
    expect(lng).toBeCloseTo(1.6, 5);
    expect(lat).toBeCloseTo(0.8, 5);
  });

  it("handles a triangle (closed with duplicate first vertex)", () => {
    // Triangle: [0,0],[3,0],[0,3],[0,0] → 4 ring positions
    // mean_x = (0+3+0+0)/4 = 0.75, mean_y = (0+0+3+0)/4 = 0.75
    const geom: Polygon = {
      type: "Polygon",
      coordinates: [[
        [0, 0],
        [3, 0],
        [0, 3],
        [0, 0],
      ]],
    };
    const [lng, lat] = centroid(geom);
    expect(lng).toBeCloseTo(0.75, 5);
    expect(lat).toBeCloseTo(0.75, 5);
  });

  it("works with real Chonburi building coordinates", () => {
    // Small building block near Chonburi Municipal Hall
    const geom = rect(100.9840, 13.3610, 100.9842, 13.3612);
    const [lng, lat] = centroid(geom);
    // Must be in the Eastern Seaboard region
    expect(lng).toBeGreaterThan(100);
    expect(lng).toBeLessThan(102);
    expect(lat).toBeGreaterThan(13);
    expect(lat).toBeLessThan(14);
    // Must be inside the bbox
    expect(lng).toBeGreaterThanOrEqual(100.9840);
    expect(lng).toBeLessThanOrEqual(100.9842);
  });
});

// ─── MultiPolygon ─────────────────────────────────────────────────────────────

describe("centroid — MultiPolygon", () => {
  it("uses only the first ring of the first polygon, ignoring other polygons", () => {
    // First polygon: unit square [0,0]–[2,2]
    // Second polygon: offset square [10,10]–[12,12] — must be ignored
    const geom: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [
        [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],         // first polygon
        [[[10, 10], [12, 10], [12, 12], [10, 12], [10, 10]]], // ignored
      ],
    };
    const [lng, lat] = centroid(geom);
    // Same as unit square: (0+2+2+0+0)/5 = 0.8
    expect(lng).toBeCloseTo(0.8, 5);
    expect(lat).toBeCloseTo(0.8, 5);
  });

  it("result is inside the first polygon's bounding box", () => {
    const geom: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [[
        [
          [100.984, 13.361],
          [100.986, 13.361],
          [100.986, 13.363],
          [100.984, 13.363],
          [100.984, 13.361],
        ],
      ]],
    };
    const [lng, lat] = centroid(geom);
    expect(lng).toBeGreaterThanOrEqual(100.984);
    expect(lng).toBeLessThanOrEqual(100.986);
    expect(lat).toBeGreaterThanOrEqual(13.361);
    expect(lat).toBeLessThanOrEqual(13.363);
  });

  it("computes same result as equivalent Polygon", () => {
    const poly = rect(100.9, 13.3, 101.1, 13.5);
    const multi: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [poly.coordinates],
    };
    const [pLng, pLat] = centroid(poly);
    const [mLng, mLat] = centroid(multi);
    expect(mLng).toBeCloseTo(pLng, 8);
    expect(mLat).toBeCloseTo(pLat, 8);
  });
});
