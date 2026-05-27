/**
 * Pure geometry helpers — extracted from BuildingSearch for unit testing.
 */

import type { MultiPolygon, Polygon } from "geojson";

/**
 * Compute the centroid of a GeoJSON Polygon or MultiPolygon.
 *
 * Uses the arithmetic mean of the outer ring's vertices (a fast approximation
 * that is sufficient for map navigation — the result is always inside a convex
 * polygon and usually close to the visual centre for convex-ish building shapes).
 *
 * Returns [lng, lat] (deck.gl / GeoJSON coordinate order).
 */
export function centroid(geom: Polygon | MultiPolygon): [number, number] {
  const ring =
    geom.type === "Polygon"
      ? geom.coordinates[0]
      : geom.coordinates[0][0]; // first ring of first polygon for MultiPolygon
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return [sx / ring.length, sy / ring.length];
}
