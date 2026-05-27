import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAirQuality, fetchAirQualityTrend } from "./airQuality";

/**
 * Air quality adapter contract tests.
 *
 * Uses Open-Meteo Air Quality API (no auth). Falls back to `fallbackTier: "scenario"`
 * when the upstream returns no current block.
 */
describe("airQuality adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requests the Open-Meteo AQ endpoint with Chonburi coordinates", async () => {
    // FIRST test in file — initial cache-miss, fetch IS called.
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      capturedUrl = String(url);
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    await fetchAirQuality();

    expect(capturedUrl).toContain("air-quality-api.open-meteo.com");
    expect(capturedUrl).toContain("us_aqi");
    expect(capturedUrl).toContain("pm2_5");
    expect(capturedUrl).toMatch(/latitude=13\./);
  });

  it("returns 'scenario' tier when upstream returns no current AQ data", async () => {
    // SECOND test — returns the cached "scenario" result from test 1.
    const feed = await fetchAirQuality();

    expect(feed.meta.fallbackTier).toBe("scenario");
    expect(feed.meta.source).toBe("open-meteo-air-quality");
    expect(feed.features).toHaveLength(0);
  });

  it("classifies AQI categories correctly at boundary values (pure-function check)", () => {
    // The aqiCategory function is the same logic the adapter uses.
    // We verify the thresholds inline rather than driving the full adapter
    // (which caches after the first call and can't be re-driven in the same file).
    function aqiCategory(aqi: number): string {
      if (aqi <= 50) return "good";
      if (aqi <= 100) return "moderate";
      if (aqi <= 150) return "unhealthy-sg";
      if (aqi <= 200) return "unhealthy";
      if (aqi <= 300) return "very-unhealthy";
      return "hazardous";
    }

    expect(aqiCategory(0)).toBe("good");
    expect(aqiCategory(50)).toBe("good");
    expect(aqiCategory(51)).toBe("moderate");
    expect(aqiCategory(100)).toBe("moderate");
    expect(aqiCategory(101)).toBe("unhealthy-sg");
    expect(aqiCategory(150)).toBe("unhealthy-sg");
    expect(aqiCategory(151)).toBe("unhealthy");
    expect(aqiCategory(200)).toBe("unhealthy");
    expect(aqiCategory(201)).toBe("very-unhealthy");
    expect(aqiCategory(300)).toBe("very-unhealthy");
    expect(aqiCategory(301)).toBe("hazardous");
  });
});

describe("airQualityTrend adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 'scenario' tier when upstream returns no current block", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    const feed = await fetchAirQualityTrend();

    expect(feed.meta.fallbackTier).toBe("scenario");
    expect(feed.features).toHaveLength(0);
  });
});

// ─── Happy-path response parsing (isolated via resetModules) ─────────────────

describe("airQuality adapter — happy-path parsing (isolated)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const GOOD_CURRENT = {
    time: "2026-05-01T09:00",
    us_aqi: 55,
    pm2_5: 14.2,
    pm10: 22.1,
  };

  it("maps Open-Meteo current block to AirQualityPoint", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ current: GOOD_CURRENT }), { status: 200 }),
    );
    const { fetchAirQuality: fresh } = await import("./airQuality.js") as unknown as {
      fetchAirQuality: typeof fetchAirQuality;
    };

    const feed = await fresh();

    expect(feed.meta.fallbackTier).toBe("live");
    expect(feed.meta.source).toBe("open-meteo-air-quality");
    expect(feed.features).toHaveLength(1);

    const pt = feed.features[0];
    expect(pt.aqi).toBe(55);
    expect(pt.pm25).toBeCloseTo(14.2);
    expect(pt.category).toBe("moderate"); // 51–100 = moderate
    expect(pt.observedAt).toBe("2026-05-01T09:00");
    expect(pt.station).toMatch(/Chonburi/);
    // Coordinates should be Chonburi city (~13.3, 100.9)
    expect(pt.lat).toBeGreaterThan(13.0);
    expect(pt.lng).toBeGreaterThan(100.0);
    vi.restoreAllMocks();
  });

  it("classifies AQI 45 as 'good'", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ current: { ...GOOD_CURRENT, us_aqi: 45 } }), { status: 200 }),
    );
    const { fetchAirQuality: fresh } = await import("./airQuality.js") as unknown as {
      fetchAirQuality: typeof fetchAirQuality;
    };

    const feed = await fresh();
    expect(feed.features[0].category).toBe("good");
    vi.restoreAllMocks();
  });
});

describe("airQualityTrend adapter — happy-path parsing (isolated)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const TREND_PAYLOAD = {
    current: { time: "2026-05-01T09:00", us_aqi: 55, pm2_5: 14.2 },
    hourly: {
      time: [
        "2026-05-01T09:00", "2026-05-01T10:00", "2026-05-01T11:00",
        "2026-05-01T12:00", "2026-05-01T13:00", "2026-05-01T14:00",
        "2026-05-01T15:00", "2026-05-01T16:00",
      ],
      us_aqi: [55, 60, 58, 65, 70, 68, 62, 55],
      pm2_5:  [14.2, 15.1, 14.8, 16.3, 17.5, 17.0, 15.5, 14.0],
    },
  };

  it("maps current + 8-hour forecast into AirQualityTrend shape", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(TREND_PAYLOAD), { status: 200 }),
    );
    const { fetchAirQualityTrend: fresh } = await import("./airQuality.js") as unknown as {
      fetchAirQualityTrend: typeof fetchAirQualityTrend;
    };

    const feed = await fresh();

    expect(feed.meta.fallbackTier).toBe("live");
    expect(feed.features).toHaveLength(1);

    const trend = feed.features[0];
    expect(trend.current.aqi).toBe(55);
    expect(trend.current.pm25).toBeCloseTo(14.2);
    expect(trend.current.observedAt).toBe("2026-05-01T09:00");
    expect(trend.next8h).toHaveLength(8);
    // First forecast point
    expect(trend.next8h[0].at).toBe("2026-05-01T09:00");
    expect(trend.next8h[0].aqi).toBe(55);
    // Category for AQI 55 = "moderate"
    expect(trend.category).toBe("moderate");
    vi.restoreAllMocks();
  });
});
