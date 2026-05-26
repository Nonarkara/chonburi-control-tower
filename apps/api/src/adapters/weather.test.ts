import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchWeather } from "./weather";

/**
 * Weather adapter contract tests.
 *
 * Uses Open-Meteo (no auth). Falls back to `fallbackTier: "scenario"` when
 * the upstream returns no current block (empty JSON or missing fields).
 */
describe("weather adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requests the correct Chonburi coordinates from Open-Meteo", async () => {
    // FIRST test in file — this is the initial cache-miss, so fetch IS called.
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      capturedUrl = String(url);
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    await fetchWeather();

    // CHONBURI.center is [100.9648, 13.3611] — lat 13.3..., lng 100.9...
    expect(capturedUrl).toMatch(/latitude=13\./);
    expect(capturedUrl).toMatch(/longitude=100\./);
    expect(capturedUrl).toContain("open-meteo.com");
    expect(capturedUrl).toContain("wind_speed_unit=kmh");
  });

  it("returns 'scenario' tier when upstream returns no current block", async () => {
    // SECOND test — returns the cached "scenario" result from test 1.
    const feed = await fetchWeather();

    expect(feed.meta.fallbackTier).toBe("scenario");
    expect(feed.meta.source).toBe("open-meteo");
    expect(feed.features).toHaveLength(0);
  });
});
