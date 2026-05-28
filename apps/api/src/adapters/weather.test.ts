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

// ─── Happy-path response parsing (isolated via resetModules) ─────────────────

describe("weather adapter — happy-path parsing (isolated)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const GOOD_CURRENT = {
    time: "2026-01-01T08:00",
    temperature_2m: 28.5,
    apparent_temperature: 32.0,
    relative_humidity_2m: 75,
    wind_speed_10m: 15.2,
    precipitation: 0,
    weather_code: 2,
  };

  it("maps all Open-Meteo current fields to WeatherSnapshot", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ current: GOOD_CURRENT }), { status: 200 }),
    );
    const { fetchWeather: fresh } = await import("./weather.js") as unknown as { fetchWeather: typeof import("./weather").fetchWeather };

    const feed = await fresh();

    expect(feed.meta.fallbackTier).toBe("live");
    expect(feed.meta.source).toBe("open-meteo");
    expect(feed.features).toHaveLength(1);

    const w = feed.features[0];
    expect(w.tempC).toBeCloseTo(28.5);
    expect(w.feelsLikeC).toBeCloseTo(32.0);
    expect(w.humidity).toBe(75);
    expect(w.windKmh).toBeCloseTo(15.2);
    expect(w.precipMm).toBe(0);
    expect(w.condition).toBe("Partly cloudy"); // weather_code 2
    expect(w.observedAt).toBe("2026-01-01T08:00");
    vi.restoreAllMocks();
  });

  it("resolves unknown weather_code to '—'", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ current: { ...GOOD_CURRENT, weather_code: 9999 } }), { status: 200 }),
    );
    const { fetchWeather: fresh } = await import("./weather.js") as unknown as { fetchWeather: typeof import("./weather").fetchWeather };

    const feed = await fresh();
    expect(feed.features[0].condition).toBe("—");
    vi.restoreAllMocks();
  });

  it("falls back to apparent_temperature when feelsLikeC is absent", async () => {
    vi.resetModules();
    const noFeelsLike = { ...GOOD_CURRENT, apparent_temperature: undefined };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ current: noFeelsLike }), { status: 200 }),
    );
    const { fetchWeather: fresh } = await import("./weather.js") as unknown as { fetchWeather: typeof import("./weather").fetchWeather };

    const feed = await fresh();
    // feelsLikeC falls back to tempC (temperature_2m)
    expect(feed.features[0].feelsLikeC).toBeCloseTo(GOOD_CURRENT.temperature_2m);
    vi.restoreAllMocks();
  });

  it("returns scenario tier when upstream returns 500", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );
    const { fetchWeather: fresh } = await import("./weather.js") as unknown as { fetchWeather: typeof import("./weather").fetchWeather };

    const feed = await fresh();
    expect(feed.meta.fallbackTier).toBe("scenario");
    expect(feed.features).toHaveLength(0);
    vi.restoreAllMocks();
  });
});

// ─── Weather code lookup table (isolated per code) ───────────────────────────

describe("weather adapter — WEATHER_CODE lookup (isolated)", () => {
  type FetchWeather = typeof import("./weather").fetchWeather;

  const BASE_CURRENT = {
    time: "2026-01-01T08:00",
    temperature_2m: 28.5,
    apparent_temperature: 32.0,
    relative_humidity_2m: 75,
    wind_speed_10m: 15.2,
    precipitation: 0,
  };

  it.each<[number, string]>([
    [0,  "Clear"],
    [1,  "Mainly clear"],
    [3,  "Overcast"],
    [45, "Foggy"],
    [48, "Rime fog"],
    [51, "Light drizzle"],
    [55, "Heavy drizzle"],
    [61, "Light rain"],
    [63, "Rain"],
    [65, "Heavy rain"],
    [80, "Showers"],
    [95, "Thunderstorm"],
  ])("weather_code %i → '%s'", async (code, expected) => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ current: { ...BASE_CURRENT, weather_code: code } }),
        { status: 200 },
      ),
    );
    const { fetchWeather: fresh } = await import("./weather.js") as unknown as { fetchWeather: FetchWeather };

    const feed = await fresh();
    expect(feed.features[0].condition).toBe(expected);
    vi.restoreAllMocks();
  });
});
