import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * chatContext contract tests — verifies the live-data snippet builder that
 * provides context to the AI chat endpoint.
 *
 * Strategy: mock all five upstream adapters plus newsArchive so no real
 * network or filesystem access occurs. Each test gets a fresh module (via
 * vi.resetModules + dynamic import) to reset the 60-second TTL cache.
 *
 * Covered:
 *   - Snippet header format (markdown section heading)
 *   - Per-adapter sections appear when adapters resolve successfully
 *   - Failed/rejected adapters are silently skipped (no throw)
 *   - 60-second TTL cache: rapid second call returns the same snippet
 *   - Empty features arrays are handled gracefully (no section added)
 */

vi.mock("./airQuality.js", () => ({
  fetchAirQualityTrend: vi.fn(),
}));
vi.mock("./cityReporter.js", () => ({
  fetchCityReports: vi.fn(),
}));
vi.mock("./itic.js", () => ({
  fetchItic: vi.fn(),
}));
vi.mock("./weather.js", () => ({
  fetchWeather: vi.fn(),
}));
vi.mock("./precipNowcast.js", () => ({
  fetchPrecipNowcast: vi.fn(),
}));
vi.mock("../lib/newsArchive.js", () => ({
  // Default to rejecting so tryNewsArchive catches → returns null → section omitted.
  // Tests that need archive data can override these in the specific test.
  digestNewsArchive: vi.fn().mockRejectedValue(new Error("not available in test env")),
  newsArchiveStats: vi.fn().mockRejectedValue(new Error("not available in test env")),
}));

// Helper NormalizedFeed shapes for each adapter
function aqFeed(aqi: number) {
  return {
    features: [{ current: { aqi, pm25: 12.5 }, station: "Chonburi Town", category: "Good" }],
    meta: { source: "air-quality", fetchedAt: "2025-01-01T00:00:00Z", ageMinutes: 10, fallbackTier: "live" as const },
  };
}

function wxFeed() {
  return {
    features: [{ tempC: 30, feelsLikeC: 35, condition: "Partly cloudy", humidity: 75, windKmh: 15 }],
    meta: { source: "weather", fetchedAt: "2025-01-01T00:00:00Z", ageMinutes: 5, fallbackTier: "live" as const },
  };
}

function precipFeed(intensity: "dry" | "light" | "moderate") {
  return {
    features: [{ intensity, total2hMm: 0.5, peakMm: 0, minutesToSignificant: null }],
    meta: { source: "precip", fetchedAt: "2025-01-01T00:00:00Z", ageMinutes: 2, fallbackTier: "live" as const },
  };
}

function crFeed(open: number, total: number) {
  return {
    features: Array.from({ length: total }, (_, i) => ({ status: i < open ? "open" : "resolved" })),
    meta: { source: "traffy", fetchedAt: "2025-01-01T00:00:00Z", ageMinutes: 5, fallbackTier: "live" as const },
  };
}

function iticFeed(count: number) {
  return {
    features: Array.from({ length: count }, (_, i) => ({ id: `ev-${i}` })),
    meta: { source: "itic", fetchedAt: "2025-01-01T00:00:00Z", ageMinutes: 2, fallbackTier: "live" as const },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

// ─── Snippet format ────────────────────────────────────────────────────────

describe("liveContextSnippet — format", () => {
  it("starts with a markdown section header containing 'Live data snapshot'", async () => {
    const { fetchAirQualityTrend } = await import("./airQuality.js") as { fetchAirQualityTrend: ReturnType<typeof vi.fn> };
    const { fetchCityReports } = await import("./cityReporter.js") as { fetchCityReports: ReturnType<typeof vi.fn> };
    const { fetchItic } = await import("./itic.js") as { fetchItic: ReturnType<typeof vi.fn> };
    const { fetchWeather } = await import("./weather.js") as { fetchWeather: ReturnType<typeof vi.fn> };
    const { fetchPrecipNowcast } = await import("./precipNowcast.js") as { fetchPrecipNowcast: ReturnType<typeof vi.fn> };

    fetchAirQualityTrend.mockResolvedValue(aqFeed(50));
    fetchCityReports.mockResolvedValue(crFeed(2, 5));
    fetchItic.mockResolvedValue(iticFeed(3));
    fetchWeather.mockResolvedValue(wxFeed());
    fetchPrecipNowcast.mockResolvedValue(precipFeed("dry"));

    const { liveContextSnippet } = await import("./chatContext.js");
    const snippet = await liveContextSnippet();

    expect(snippet).toMatch(/^## Live data snapshot/);
    expect(snippet).toContain("Chonburi Town Municipality");
  });

  it("includes ISO timestamp in the header", async () => {
    const { fetchAirQualityTrend } = await import("./airQuality.js") as { fetchAirQualityTrend: ReturnType<typeof vi.fn> };
    const { fetchCityReports } = await import("./cityReporter.js") as { fetchCityReports: ReturnType<typeof vi.fn> };
    const { fetchItic } = await import("./itic.js") as { fetchItic: ReturnType<typeof vi.fn> };
    const { fetchWeather } = await import("./weather.js") as { fetchWeather: ReturnType<typeof vi.fn> };
    const { fetchPrecipNowcast } = await import("./precipNowcast.js") as { fetchPrecipNowcast: ReturnType<typeof vi.fn> };

    fetchAirQualityTrend.mockResolvedValue(aqFeed(50));
    fetchCityReports.mockResolvedValue(crFeed(0, 0));
    fetchItic.mockResolvedValue(iticFeed(0));
    fetchWeather.mockResolvedValue(wxFeed());
    fetchPrecipNowcast.mockResolvedValue(precipFeed("dry"));

    const { liveContextSnippet } = await import("./chatContext.js");
    const snippet = await liveContextSnippet();

    // ISO-8601 pattern: e.g. "2025-01-01T12:34:56.789Z"
    expect(snippet).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

// ─── Per-adapter sections ──────────────────────────────────────────────────

describe("liveContextSnippet — per-adapter sections", () => {
  it("includes air quality section when aqFeed has data", async () => {
    const { fetchAirQualityTrend } = await import("./airQuality.js") as { fetchAirQualityTrend: ReturnType<typeof vi.fn> };
    const { fetchCityReports } = await import("./cityReporter.js") as { fetchCityReports: ReturnType<typeof vi.fn> };
    const { fetchItic } = await import("./itic.js") as { fetchItic: ReturnType<typeof vi.fn> };
    const { fetchWeather } = await import("./weather.js") as { fetchWeather: ReturnType<typeof vi.fn> };
    const { fetchPrecipNowcast } = await import("./precipNowcast.js") as { fetchPrecipNowcast: ReturnType<typeof vi.fn> };

    fetchAirQualityTrend.mockResolvedValue(aqFeed(50));
    fetchCityReports.mockResolvedValue(crFeed(0, 0));
    fetchItic.mockResolvedValue(iticFeed(0));
    fetchWeather.mockResolvedValue(wxFeed());
    fetchPrecipNowcast.mockResolvedValue(precipFeed("dry"));

    const { liveContextSnippet } = await import("./chatContext.js");
    const snippet = await liveContextSnippet();

    expect(snippet).toContain("Air quality");
    expect(snippet).toContain("AQI 50");
    expect(snippet).toContain("PM2.5");
  });

  it("includes weather section with temperature and condition", async () => {
    const { fetchAirQualityTrend } = await import("./airQuality.js") as { fetchAirQualityTrend: ReturnType<typeof vi.fn> };
    const { fetchCityReports } = await import("./cityReporter.js") as { fetchCityReports: ReturnType<typeof vi.fn> };
    const { fetchItic } = await import("./itic.js") as { fetchItic: ReturnType<typeof vi.fn> };
    const { fetchWeather } = await import("./weather.js") as { fetchWeather: ReturnType<typeof vi.fn> };
    const { fetchPrecipNowcast } = await import("./precipNowcast.js") as { fetchPrecipNowcast: ReturnType<typeof vi.fn> };

    fetchAirQualityTrend.mockResolvedValue({ features: [], meta: {} });
    fetchCityReports.mockResolvedValue(crFeed(0, 0));
    fetchItic.mockResolvedValue(iticFeed(0));
    fetchWeather.mockResolvedValue(wxFeed());
    fetchPrecipNowcast.mockResolvedValue(precipFeed("dry"));

    const { liveContextSnippet } = await import("./chatContext.js");
    const snippet = await liveContextSnippet();

    expect(snippet).toContain("Weather");
    expect(snippet).toContain("30°C");
    expect(snippet).toContain("Partly cloudy");
  });

  it("includes dry rain nowcast section", async () => {
    const { fetchAirQualityTrend } = await import("./airQuality.js") as { fetchAirQualityTrend: ReturnType<typeof vi.fn> };
    const { fetchCityReports } = await import("./cityReporter.js") as { fetchCityReports: ReturnType<typeof vi.fn> };
    const { fetchItic } = await import("./itic.js") as { fetchItic: ReturnType<typeof vi.fn> };
    const { fetchWeather } = await import("./weather.js") as { fetchWeather: ReturnType<typeof vi.fn> };
    const { fetchPrecipNowcast } = await import("./precipNowcast.js") as { fetchPrecipNowcast: ReturnType<typeof vi.fn> };

    fetchAirQualityTrend.mockResolvedValue({ features: [], meta: {} });
    fetchCityReports.mockResolvedValue(crFeed(0, 0));
    fetchItic.mockResolvedValue(iticFeed(0));
    fetchWeather.mockResolvedValue({ features: [], meta: {} });
    fetchPrecipNowcast.mockResolvedValue(precipFeed("dry"));

    const { liveContextSnippet } = await import("./chatContext.js");
    const snippet = await liveContextSnippet();

    expect(snippet).toContain("Rain nowcast");
    expect(snippet).toContain("dry");
  });

  it("includes city reports with open/total counts", async () => {
    const { fetchAirQualityTrend } = await import("./airQuality.js") as { fetchAirQualityTrend: ReturnType<typeof vi.fn> };
    const { fetchCityReports } = await import("./cityReporter.js") as { fetchCityReports: ReturnType<typeof vi.fn> };
    const { fetchItic } = await import("./itic.js") as { fetchItic: ReturnType<typeof vi.fn> };
    const { fetchWeather } = await import("./weather.js") as { fetchWeather: ReturnType<typeof vi.fn> };
    const { fetchPrecipNowcast } = await import("./precipNowcast.js") as { fetchPrecipNowcast: ReturnType<typeof vi.fn> };

    fetchAirQualityTrend.mockResolvedValue({ features: [], meta: {} });
    fetchCityReports.mockResolvedValue(crFeed(3, 10)); // 3 open, 10 total
    fetchItic.mockResolvedValue(iticFeed(0));
    fetchWeather.mockResolvedValue({ features: [], meta: {} });
    fetchPrecipNowcast.mockResolvedValue({ features: [], meta: {} });

    const { liveContextSnippet } = await import("./chatContext.js");
    const snippet = await liveContextSnippet();

    expect(snippet).toContain("Citizen reports");
    expect(snippet).toContain("10");  // total count
    expect(snippet).toContain("3");   // open count
  });

  it("includes iTIC traffic section with event count", async () => {
    const { fetchAirQualityTrend } = await import("./airQuality.js") as { fetchAirQualityTrend: ReturnType<typeof vi.fn> };
    const { fetchCityReports } = await import("./cityReporter.js") as { fetchCityReports: ReturnType<typeof vi.fn> };
    const { fetchItic } = await import("./itic.js") as { fetchItic: ReturnType<typeof vi.fn> };
    const { fetchWeather } = await import("./weather.js") as { fetchWeather: ReturnType<typeof vi.fn> };
    const { fetchPrecipNowcast } = await import("./precipNowcast.js") as { fetchPrecipNowcast: ReturnType<typeof vi.fn> };

    fetchAirQualityTrend.mockResolvedValue({ features: [], meta: {} });
    fetchCityReports.mockResolvedValue(crFeed(0, 0));
    fetchItic.mockResolvedValue(iticFeed(7));
    fetchWeather.mockResolvedValue({ features: [], meta: {} });
    fetchPrecipNowcast.mockResolvedValue({ features: [], meta: {} });

    const { liveContextSnippet } = await import("./chatContext.js");
    const snippet = await liveContextSnippet();

    expect(snippet).toContain("iTIC traffic events");
    expect(snippet).toContain("7");
  });
});

// ─── Error handling ────────────────────────────────────────────────────────

describe("liveContextSnippet — error handling", () => {
  it("does not throw when all adapters reject", async () => {
    const { fetchAirQualityTrend } = await import("./airQuality.js") as { fetchAirQualityTrend: ReturnType<typeof vi.fn> };
    const { fetchCityReports } = await import("./cityReporter.js") as { fetchCityReports: ReturnType<typeof vi.fn> };
    const { fetchItic } = await import("./itic.js") as { fetchItic: ReturnType<typeof vi.fn> };
    const { fetchWeather } = await import("./weather.js") as { fetchWeather: ReturnType<typeof vi.fn> };
    const { fetchPrecipNowcast } = await import("./precipNowcast.js") as { fetchPrecipNowcast: ReturnType<typeof vi.fn> };

    fetchAirQualityTrend.mockRejectedValue(new Error("timeout"));
    fetchCityReports.mockRejectedValue(new Error("timeout"));
    fetchItic.mockRejectedValue(new Error("timeout"));
    fetchWeather.mockRejectedValue(new Error("timeout"));
    fetchPrecipNowcast.mockRejectedValue(new Error("timeout"));

    const { liveContextSnippet } = await import("./chatContext.js");
    // Must not throw — Promise.allSettled handles rejections
    await expect(liveContextSnippet()).resolves.toMatch(/## Live data snapshot/);
  });

  it("omits data-gated sections (AQ/weather/precip) when adapters return empty features", async () => {
    // chatContext guards AQ, weather, precip behind features.length > 0.
    // City reports and iTIC are always emitted when fulfilled (even with 0 items).
    const { fetchAirQualityTrend } = await import("./airQuality.js") as { fetchAirQualityTrend: ReturnType<typeof vi.fn> };
    const { fetchCityReports } = await import("./cityReporter.js") as { fetchCityReports: ReturnType<typeof vi.fn> };
    const { fetchItic } = await import("./itic.js") as { fetchItic: ReturnType<typeof vi.fn> };
    const { fetchWeather } = await import("./weather.js") as { fetchWeather: ReturnType<typeof vi.fn> };
    const { fetchPrecipNowcast } = await import("./precipNowcast.js") as { fetchPrecipNowcast: ReturnType<typeof vi.fn> };

    const empty = { features: [], meta: {} };
    fetchAirQualityTrend.mockResolvedValue(empty);
    fetchCityReports.mockResolvedValue(empty);
    fetchItic.mockResolvedValue(empty);
    fetchWeather.mockResolvedValue(empty);
    fetchPrecipNowcast.mockResolvedValue(empty);

    const { liveContextSnippet } = await import("./chatContext.js");
    const snippet = await liveContextSnippet();

    expect(snippet).toMatch(/^## Live data snapshot/);
    // Data-gated sections are absent when features is empty
    expect(snippet).not.toContain("Air quality");
    expect(snippet).not.toContain("Weather");
    expect(snippet).not.toContain("Rain nowcast");
    // City reports and iTIC are always included when fulfilled (shows "0 near municipality")
    expect(snippet).toContain("Citizen reports");
    expect(snippet).toContain("iTIC");
  });

  it("skips failed adapters but includes successful ones", async () => {
    const { fetchAirQualityTrend } = await import("./airQuality.js") as { fetchAirQualityTrend: ReturnType<typeof vi.fn> };
    const { fetchCityReports } = await import("./cityReporter.js") as { fetchCityReports: ReturnType<typeof vi.fn> };
    const { fetchItic } = await import("./itic.js") as { fetchItic: ReturnType<typeof vi.fn> };
    const { fetchWeather } = await import("./weather.js") as { fetchWeather: ReturnType<typeof vi.fn> };
    const { fetchPrecipNowcast } = await import("./precipNowcast.js") as { fetchPrecipNowcast: ReturnType<typeof vi.fn> };

    fetchAirQualityTrend.mockRejectedValue(new Error("network error"));
    fetchCityReports.mockResolvedValue(crFeed(1, 3));
    fetchItic.mockRejectedValue(new Error("timeout"));
    fetchWeather.mockResolvedValue(wxFeed());
    fetchPrecipNowcast.mockRejectedValue(new Error("timeout"));

    const { liveContextSnippet } = await import("./chatContext.js");
    const snippet = await liveContextSnippet();

    // Weather and city reports succeeded; AQ, iTIC, precip did not
    expect(snippet).toContain("Weather");
    expect(snippet).toContain("Citizen reports");
    expect(snippet).not.toContain("Air quality");
    expect(snippet).not.toContain("iTIC");
  });
});

// ─── TTL cache ─────────────────────────────────────────────────────────────

describe("liveContextSnippet — 60-second TTL cache", () => {
  it("returns the same snippet on rapid successive calls without re-fetching adapters", async () => {
    const { fetchAirQualityTrend } = await import("./airQuality.js") as { fetchAirQualityTrend: ReturnType<typeof vi.fn> };
    const { fetchCityReports } = await import("./cityReporter.js") as { fetchCityReports: ReturnType<typeof vi.fn> };
    const { fetchItic } = await import("./itic.js") as { fetchItic: ReturnType<typeof vi.fn> };
    const { fetchWeather } = await import("./weather.js") as { fetchWeather: ReturnType<typeof vi.fn> };
    const { fetchPrecipNowcast } = await import("./precipNowcast.js") as { fetchPrecipNowcast: ReturnType<typeof vi.fn> };

    fetchAirQualityTrend.mockResolvedValue(aqFeed(42));
    fetchCityReports.mockResolvedValue(crFeed(0, 0));
    fetchItic.mockResolvedValue(iticFeed(0));
    fetchWeather.mockResolvedValue(wxFeed());
    fetchPrecipNowcast.mockResolvedValue(precipFeed("dry"));

    const { liveContextSnippet } = await import("./chatContext.js");

    const first = await liveContextSnippet();
    const second = await liveContextSnippet();

    // Identical string because cached
    expect(first).toBe(second);
    // Adapters were only called once (not twice)
    expect(fetchAirQualityTrend).toHaveBeenCalledTimes(1);
    expect(fetchWeather).toHaveBeenCalledTimes(1);
  });
});
