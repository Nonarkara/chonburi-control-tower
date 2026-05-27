import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

/**
 * chatContext contract tests — verifies the live-data snippet builder that
 * provides context to the AI chat endpoint.
 *
 * Strategy: mock all five upstream adapters plus newsArchive so no real
 * network or filesystem access occurs. Each test gets a fresh module (via
 * vi.resetModules + dynamic import) to reset the 60-second TTL cache.
 *
 * Covered:
 *   - Snippet header format (markdown section heading, ISO timestamp)
 *   - Per-adapter sections appear when adapters resolve successfully
 *   - Failed/rejected adapters are silently skipped (no throw)
 *   - 60-second TTL cache: rapid second call returns the same snippet
 *   - Empty features: data-gated sections (AQ/weather/precip) are omitted;
 *     city reports and iTIC always appear when fulfilled (even with 0 items)
 */

vi.mock("./airQuality.js", () => ({ fetchAirQualityTrend: vi.fn() }));
vi.mock("./cityReporter.js", () => ({ fetchCityReports: vi.fn() }));
vi.mock("./itic.js", () => ({ fetchItic: vi.fn() }));
vi.mock("./weather.js", () => ({ fetchWeather: vi.fn() }));
vi.mock("./precipNowcast.js", () => ({ fetchPrecipNowcast: vi.fn() }));
vi.mock("../lib/newsArchive.js", () => ({
  // Default to rejecting so tryNewsArchive catches → returns null → section omitted.
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

// Retrieves all five mocks after a vi.resetModules() so they are fresh.
// Must be called inside each it() — resetModules clears the registry,
// and the factory creates fresh vi.fn() instances on next import.
async function getMocks() {
  const aq = (await import("./airQuality.js") as unknown as { fetchAirQualityTrend: Mock }).fetchAirQualityTrend;
  const cr = (await import("./cityReporter.js") as unknown as { fetchCityReports: Mock }).fetchCityReports;
  const it_ = (await import("./itic.js") as unknown as { fetchItic: Mock }).fetchItic;
  const wx = (await import("./weather.js") as unknown as { fetchWeather: Mock }).fetchWeather;
  const pr = (await import("./precipNowcast.js") as unknown as { fetchPrecipNowcast: Mock }).fetchPrecipNowcast;
  return { aq, cr, itic: it_, wx, pr };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

// ─── Snippet format ────────────────────────────────────────────────────────

describe("liveContextSnippet — format", () => {
  it("starts with a markdown section header containing 'Live data snapshot'", async () => {
    const { aq, cr, itic, wx, pr } = await getMocks();
    aq.mockResolvedValue(aqFeed(50));
    cr.mockResolvedValue(crFeed(2, 5));
    itic.mockResolvedValue(iticFeed(3));
    wx.mockResolvedValue(wxFeed());
    pr.mockResolvedValue(precipFeed("dry"));

    const { liveContextSnippet } = await import("./chatContext.js");
    const snippet = await liveContextSnippet();

    expect(snippet).toMatch(/^## Live data snapshot/);
    expect(snippet).toContain("Chonburi Town Municipality");
  });

  it("includes ISO timestamp in the header", async () => {
    const { aq, cr, itic, wx, pr } = await getMocks();
    aq.mockResolvedValue(aqFeed(50));
    cr.mockResolvedValue(crFeed(0, 0));
    itic.mockResolvedValue(iticFeed(0));
    wx.mockResolvedValue(wxFeed());
    pr.mockResolvedValue(precipFeed("dry"));

    const { liveContextSnippet } = await import("./chatContext.js");
    const snippet = await liveContextSnippet();

    expect(snippet).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

// ─── Per-adapter sections ──────────────────────────────────────────────────

describe("liveContextSnippet — per-adapter sections", () => {
  it("includes air quality section when aqFeed has data", async () => {
    const { aq, cr, itic, wx, pr } = await getMocks();
    aq.mockResolvedValue(aqFeed(50));
    cr.mockResolvedValue(crFeed(0, 0));
    itic.mockResolvedValue(iticFeed(0));
    wx.mockResolvedValue(wxFeed());
    pr.mockResolvedValue(precipFeed("dry"));

    const { liveContextSnippet } = await import("./chatContext.js");
    const snippet = await liveContextSnippet();

    expect(snippet).toContain("Air quality");
    expect(snippet).toContain("AQI 50");
    expect(snippet).toContain("PM2.5");
  });

  it("includes weather section with temperature and condition", async () => {
    const { aq, cr, itic, wx, pr } = await getMocks();
    aq.mockResolvedValue({ features: [], meta: {} });
    cr.mockResolvedValue(crFeed(0, 0));
    itic.mockResolvedValue(iticFeed(0));
    wx.mockResolvedValue(wxFeed());
    pr.mockResolvedValue(precipFeed("dry"));

    const { liveContextSnippet } = await import("./chatContext.js");
    const snippet = await liveContextSnippet();

    expect(snippet).toContain("Weather");
    expect(snippet).toContain("30°C");
    expect(snippet).toContain("Partly cloudy");
  });

  it("includes dry rain nowcast section", async () => {
    const { aq, cr, itic, wx, pr } = await getMocks();
    aq.mockResolvedValue({ features: [], meta: {} });
    cr.mockResolvedValue(crFeed(0, 0));
    itic.mockResolvedValue(iticFeed(0));
    wx.mockResolvedValue({ features: [], meta: {} });
    pr.mockResolvedValue(precipFeed("dry"));

    const { liveContextSnippet } = await import("./chatContext.js");
    const snippet = await liveContextSnippet();

    expect(snippet).toContain("Rain nowcast");
    expect(snippet).toContain("dry");
  });

  it("includes city reports with open/total counts", async () => {
    const { aq, cr, itic, wx, pr } = await getMocks();
    aq.mockResolvedValue({ features: [], meta: {} });
    cr.mockResolvedValue(crFeed(3, 10)); // 3 open, 10 total
    itic.mockResolvedValue(iticFeed(0));
    wx.mockResolvedValue({ features: [], meta: {} });
    pr.mockResolvedValue({ features: [], meta: {} });

    const { liveContextSnippet } = await import("./chatContext.js");
    const snippet = await liveContextSnippet();

    expect(snippet).toContain("Citizen reports");
    expect(snippet).toContain("10"); // total
    expect(snippet).toContain("3");  // open
  });

  it("includes iTIC traffic section with event count", async () => {
    const { aq, cr, itic, wx, pr } = await getMocks();
    aq.mockResolvedValue({ features: [], meta: {} });
    cr.mockResolvedValue(crFeed(0, 0));
    itic.mockResolvedValue(iticFeed(7));
    wx.mockResolvedValue({ features: [], meta: {} });
    pr.mockResolvedValue({ features: [], meta: {} });

    const { liveContextSnippet } = await import("./chatContext.js");
    const snippet = await liveContextSnippet();

    expect(snippet).toContain("iTIC traffic events");
    expect(snippet).toContain("7");
  });
});

// ─── Error handling ────────────────────────────────────────────────────────

describe("liveContextSnippet — error handling", () => {
  it("does not throw when all adapters reject", async () => {
    const { aq, cr, itic, wx, pr } = await getMocks();
    aq.mockRejectedValue(new Error("timeout"));
    cr.mockRejectedValue(new Error("timeout"));
    itic.mockRejectedValue(new Error("timeout"));
    wx.mockRejectedValue(new Error("timeout"));
    pr.mockRejectedValue(new Error("timeout"));

    const { liveContextSnippet } = await import("./chatContext.js");
    await expect(liveContextSnippet()).resolves.toMatch(/## Live data snapshot/);
  });

  it("omits data-gated sections (AQ/weather/precip) when adapters return empty features", async () => {
    // AQ, weather, and precip are guarded by features.length > 0.
    // City reports and iTIC are always emitted when fulfilled (even 0 items).
    const { aq, cr, itic, wx, pr } = await getMocks();
    const empty = { features: [], meta: {} };
    aq.mockResolvedValue(empty);
    cr.mockResolvedValue(empty);
    itic.mockResolvedValue(empty);
    wx.mockResolvedValue(empty);
    pr.mockResolvedValue(empty);

    const { liveContextSnippet } = await import("./chatContext.js");
    const snippet = await liveContextSnippet();

    expect(snippet).toMatch(/^## Live data snapshot/);
    expect(snippet).not.toContain("Air quality");
    expect(snippet).not.toContain("Weather");
    expect(snippet).not.toContain("Rain nowcast");
    // Always emitted when fulfilled
    expect(snippet).toContain("Citizen reports");
    expect(snippet).toContain("iTIC");
  });

  it("skips failed adapters but includes successful ones", async () => {
    const { aq, cr, itic, wx, pr } = await getMocks();
    aq.mockRejectedValue(new Error("network error"));
    cr.mockResolvedValue(crFeed(1, 3));
    itic.mockRejectedValue(new Error("timeout"));
    wx.mockResolvedValue(wxFeed());
    pr.mockRejectedValue(new Error("timeout"));

    const { liveContextSnippet } = await import("./chatContext.js");
    const snippet = await liveContextSnippet();

    expect(snippet).toContain("Weather");
    expect(snippet).toContain("Citizen reports");
    expect(snippet).not.toContain("Air quality");
  });
});

// ─── TTL cache ─────────────────────────────────────────────────────────────

describe("liveContextSnippet — 60-second TTL cache", () => {
  it("returns the same snippet on rapid successive calls without re-fetching adapters", async () => {
    const { aq, cr, itic, wx, pr } = await getMocks();
    aq.mockResolvedValue(aqFeed(42));
    cr.mockResolvedValue(crFeed(0, 0));
    itic.mockResolvedValue(iticFeed(0));
    wx.mockResolvedValue(wxFeed());
    pr.mockResolvedValue(precipFeed("dry"));

    const { liveContextSnippet } = await import("./chatContext.js");
    const first = await liveContextSnippet();
    const second = await liveContextSnippet();

    expect(first).toBe(second); // same string from cache
    expect(aq).toHaveBeenCalledTimes(1);
    expect(wx).toHaveBeenCalledTimes(1);
  });
});
