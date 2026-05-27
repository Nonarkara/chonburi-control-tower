import { describe, it, expect } from "vitest";
import { fetchWaterQuality } from "./waterQuality";

/**
 * Water quality adapter tests — verifies the stub shape and metadata
 * contract. These tests document the expected shape so the adapter can be
 * replaced with a live PCD/DMCR feed without silent shape regressions.
 */

describe("waterQuality adapter (stub)", () => {
  it("returns a NormalizedFeed with scenario fallback tier", async () => {
    const feed = await fetchWaterQuality();
    expect(feed.meta.source).toBe("water-quality-stub");
    expect(feed.meta.fallbackTier).toBe("scenario");
    expect(feed.meta.fetchedAt).toBeTruthy();
  });

  it("returns at least one monitoring station", async () => {
    const feed = await fetchWaterQuality();
    expect(feed.features.length).toBeGreaterThanOrEqual(1);
  });

  it("includes Bang Saen coastal station", async () => {
    const feed = await fetchWaterQuality();
    const bangSaen = feed.features.find((s) => s.stationId === "WQ-BANGSAN-01");
    expect(bangSaen).toBeDefined();
    expect(bangSaen!.stationName).toMatch(/Bang Saen/i);
    // Bang Saen is at ~13.28°N, 100.92°E
    expect(bangSaen!.lat).toBeCloseTo(13.278, 1);
    expect(bangSaen!.lng).toBeCloseTo(100.921, 1);
  });

  it("every station has the required WaterQualityReading shape", async () => {
    const feed = await fetchWaterQuality();
    for (const s of feed.features) {
      expect(s).toHaveProperty("stationId");
      expect(s).toHaveProperty("stationName");
      expect(s).toHaveProperty("stationNameTh");
      expect(s).toHaveProperty("lat");
      expect(s).toHaveProperty("lng");
      expect(s).toHaveProperty("observedAt");
      expect(s).toHaveProperty("doMgL");
      expect(s).toHaveProperty("salinityPpt");
      expect(s).toHaveProperty("turbidityNtu");
      expect(s).toHaveProperty("pH");
      expect(s).toHaveProperty("doVerdict");
    }
  });

  it("sensor readings are null until PCD/DMCR API is wired", async () => {
    const feed = await fetchWaterQuality();
    for (const s of feed.features) {
      // All readings are null until real sensor data is connected.
      // This assertion documents the stub state — when it fails, it means
      // live data has been wired and these tests should be updated.
      expect(s.doMgL).toBeNull();
      expect(s.salinityPpt).toBeNull();
      expect(s.turbidityNtu).toBeNull();
      expect(s.pH).toBeNull();
      expect(s.doVerdict).toBeNull();
    }
  });

  it("stations are in the Gulf of Thailand area (sensible coordinates)", async () => {
    const feed = await fetchWaterQuality();
    for (const s of feed.features) {
      // All stations should be in the Eastern Seaboard coastal zone
      expect(s.lat).toBeGreaterThan(12.0);
      expect(s.lat).toBeLessThan(14.0);
      expect(s.lng).toBeGreaterThan(100.5);
      expect(s.lng).toBeLessThan(102.0);
    }
  });
});
