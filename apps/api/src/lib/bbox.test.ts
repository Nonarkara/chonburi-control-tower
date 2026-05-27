import { describe, it, expect } from "vitest";
import { FEED_BBOX, OUTER_BBOX, inBbox, inMunicipality } from "./bbox";

/**
 * Bbox utility tests — boundary conditions, corners, and clear in/out cases.
 * These functions filter every single adapter feed; getting them wrong silently
 * removes real incidents from the dashboard or leaks Bangkok noise in.
 */

describe("FEED_BBOX constants", () => {
  it("has correct Eastern Seaboard bounds", () => {
    expect(FEED_BBOX.minLng).toBe(100.70);
    expect(FEED_BBOX.minLat).toBe(12.50);
    expect(FEED_BBOX.maxLng).toBe(101.50);
    expect(FEED_BBOX.maxLat).toBe(13.55);
  });

  it("is wider than OUTER_BBOX (feeds cover more than just the municipality)", () => {
    expect(FEED_BBOX.minLng).toBeLessThan(OUTER_BBOX.minLng);
    expect(FEED_BBOX.minLat).toBeLessThan(OUTER_BBOX.minLat);
    expect(FEED_BBOX.maxLng).toBeGreaterThan(OUTER_BBOX.maxLng);
    expect(FEED_BBOX.maxLat).toBeGreaterThan(OUTER_BBOX.maxLat);
  });
});

describe("inBbox", () => {
  // Chonburi Town Municipality center
  const CHO_LNG = 100.9648;
  const CHO_LAT = 13.3611;

  it("returns true for Chonburi center", () => {
    expect(inBbox(CHO_LNG, CHO_LAT)).toBe(true);
  });

  it("returns true for Pattaya (south edge of bbox)", () => {
    // Pattaya: ~100.877°E, 12.924°N — inside
    expect(inBbox(100.877, 12.924)).toBe(true);
  });

  it("returns true for Laem Chabang port", () => {
    // Laem Chabang: ~100.885°E, 13.07°N
    expect(inBbox(100.885, 13.07)).toBe(true);
  });

  it("returns false for Bangkok city center (north of bbox)", () => {
    // Bangkok Silom: ~100.527°E, 13.724°N — lat > maxLat (13.55)
    expect(inBbox(100.527, 13.724)).toBe(false);
  });

  it("returns false for Myanmar (west of bbox)", () => {
    expect(inBbox(97.0, 16.0)).toBe(false);
  });

  it("returns false for Vietnam (east of bbox)", () => {
    expect(inBbox(106.0, 11.0)).toBe(false);
  });

  it("returns false for South China Sea (south of bbox)", () => {
    expect(inBbox(100.9, 10.0)).toBe(false);
  });

  it("returns true at exact minLng boundary (inclusive)", () => {
    expect(inBbox(FEED_BBOX.minLng, CHO_LAT)).toBe(true);
  });

  it("returns true at exact maxLng boundary (inclusive)", () => {
    expect(inBbox(FEED_BBOX.maxLng, CHO_LAT)).toBe(true);
  });

  it("returns true at exact minLat boundary (inclusive)", () => {
    expect(inBbox(CHO_LNG, FEED_BBOX.minLat)).toBe(true);
  });

  it("returns true at exact maxLat boundary (inclusive)", () => {
    expect(inBbox(CHO_LNG, FEED_BBOX.maxLat)).toBe(true);
  });

  it("returns false just outside minLng", () => {
    expect(inBbox(FEED_BBOX.minLng - 0.001, CHO_LAT)).toBe(false);
  });

  it("returns false just outside maxLat", () => {
    expect(inBbox(CHO_LNG, FEED_BBOX.maxLat + 0.001)).toBe(false);
  });
});

describe("inMunicipality", () => {
  // CHONBURI.center = [100.9847, 13.3611]; outerBounds SW = [100.965, 13.342]
  const CHO_LNG = 100.9847;
  const CHO_LAT = 13.3611;

  it("returns true for Chonburi center", () => {
    expect(inMunicipality(CHO_LNG, CHO_LAT)).toBe(true);
  });

  it("returns false for Pattaya (inside FEED_BBOX but outside municipality)", () => {
    // Pattaya: 100.877°E, 12.924°N — outside the tighter OUTER_BBOX
    const result = inMunicipality(100.877, 12.924);
    // Pattaya is well south — should be outside municipality bounds
    expect(result).toBe(false);
  });

  it("returns false for Bangkok", () => {
    expect(inMunicipality(100.527, 13.724)).toBe(false);
  });
});
