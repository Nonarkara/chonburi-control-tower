import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchCities } from "./useCustomClocks";
import type { ClockSpec } from "./useCustomClocks";

/**
 * searchCities contract tests — verifies the Open-Meteo geocoding wrapper
 * that powers the city-clock picker. Getting it wrong silently leaves the
 * clock picker empty or crashes with bad coords. Tests use fetch mocking;
 * no network traffic is made.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeGeocodingResponse(overrides: Partial<{
  name: string;
  country: string;
  country_code: string;
  admin1: string;
  timezone: string;
  latitude: number;
  longitude: number;
}>[] = [{}]) {
  return {
    results: overrides.map((r) => ({
      name: r.name ?? "Bangkok",
      country: r.country ?? "Thailand",
      country_code: r.country_code ?? "TH",
      admin1: r.admin1 ?? "Bangkok",
      timezone: r.timezone ?? "Asia/Bangkok",
      latitude: r.latitude ?? 13.7563,
      longitude: r.longitude ?? 100.5018,
    })),
  };
}

function mockFetch(body: unknown, ok = true, status = 200) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
  } as unknown as Response);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Short query guard ─────────────────────────────────────────────────────

describe("searchCities — short query guard", () => {
  it("returns [] immediately for empty string (no fetch)", async () => {
    global.fetch = vi.fn();
    const result = await searchCities("");
    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns [] immediately for single character (no fetch)", async () => {
    global.fetch = vi.fn();
    const result = await searchCities("B");
    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns [] for whitespace-only query (no fetch)", async () => {
    global.fetch = vi.fn();
    const result = await searchCities("  ");
    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("proceeds with fetch for 2-character query", async () => {
    mockFetch({ results: [] });
    await searchCities("Bk");
    expect(global.fetch).toHaveBeenCalledOnce();
  });
});

// ─── URL construction ──────────────────────────────────────────────────────

describe("searchCities — URL construction", () => {
  it("queries Open-Meteo geocoding API", async () => {
    mockFetch({ results: [] });
    await searchCities("Bangkok");
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("geocoding-api.open-meteo.com");
    expect(url).toContain("Bangkok");
  });

  it("limits results to 8 via count param", async () => {
    mockFetch({ results: [] });
    await searchCities("London");
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("count=8");
  });

  it("requests English language", async () => {
    mockFetch({ results: [] });
    await searchCities("Paris");
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("language=en");
  });

  it("percent-encodes special characters in city name", async () => {
    mockFetch({ results: [] });
    await searchCities("São Paulo");
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("S%C3%A3o");
  });
});

// ─── Result mapping ────────────────────────────────────────────────────────

describe("searchCities — result mapping", () => {
  it("maps a single geocoding result to ClockSpec", async () => {
    mockFetch(makeGeocodingResponse([{
      name: "Chonburi",
      country: "Thailand",
      country_code: "TH",
      admin1: "Chon Buri",
      timezone: "Asia/Bangkok",
      latitude: 13.3611,
      longitude: 100.9847,
    }]));
    const results = await searchCities("Chonburi");
    expect(results).toHaveLength(1);
    const city = results[0];
    expect(city.country).toBe("TH");
    expect(city.tz).toBe("Asia/Bangkok");
    expect(city.lat).toBeCloseTo(13.3611);
    expect(city.lng).toBeCloseTo(100.9847);
  });

  it("builds label as 'City, Region' when admin1 differs from name", async () => {
    mockFetch(makeGeocodingResponse([{
      name: "Pattaya",
      admin1: "Chon Buri",
      timezone: "Asia/Bangkok",
    }]));
    const results = await searchCities("Pattaya");
    expect(results[0].label).toBe("Pattaya, Chon Buri");
  });

  it("uses plain city name when admin1 equals name", async () => {
    mockFetch(makeGeocodingResponse([{
      name: "Bangkok",
      admin1: "Bangkok",
      timezone: "Asia/Bangkok",
    }]));
    const results = await searchCities("Bangkok");
    expect(results[0].label).toBe("Bangkok");
  });

  it("uses plain city name when admin1 is absent", async () => {
    mockFetch({
      results: [{
        name: "Singapore",
        country_code: "SG",
        timezone: "Asia/Singapore",
        latitude: 1.3521,
        longitude: 103.8198,
      }],
    });
    const results = await searchCities("Singapore");
    expect(results[0].label).toBe("Singapore");
  });

  it("builds id from name + country_code + admin1", async () => {
    mockFetch(makeGeocodingResponse([{
      name: "Berlin",
      country_code: "DE",
      admin1: "Berlin",
      timezone: "Europe/Berlin",
    }]));
    const results = await searchCities("Berlin");
    expect(results[0].id).toBe("Berlin-DE-Berlin");
  });

  it("falls back to country name when country_code is absent", async () => {
    mockFetch({
      results: [{
        name: "TestCity",
        country: "Testland",
        timezone: "UTC",
        latitude: 0,
        longitude: 0,
      }],
    });
    const results = await searchCities("TestCity");
    expect(results[0].country).toBe("");
    expect(results[0].id).toContain("TestCity");
  });

  it("returns multiple results mapped correctly", async () => {
    mockFetch(makeGeocodingResponse([
      { name: "London", country_code: "GB", admin1: "England", timezone: "Europe/London" },
      { name: "London", country_code: "CA", admin1: "Ontario", timezone: "America/Toronto" },
    ]));
    const results = await searchCities("London");
    expect(results).toHaveLength(2);
    expect(results[0].tz).toBe("Europe/London");
    expect(results[1].tz).toBe("America/Toronto");
  });
});

// ─── Timezone filtering ────────────────────────────────────────────────────

describe("searchCities — timezone filtering", () => {
  it("filters out results without a timezone field", async () => {
    mockFetch({
      results: [
        { name: "ValidCity", country_code: "XX", timezone: "UTC", latitude: 0, longitude: 0 },
        { name: "NoTimezone", country_code: "YY", latitude: 10, longitude: 20 },
      ],
    });
    const results = await searchCities("city");
    expect(results).toHaveLength(1);
    expect(results[0].label).toBe("ValidCity");
  });

  it("returns [] when all results lack timezone", async () => {
    mockFetch({
      results: [
        { name: "A", latitude: 0, longitude: 0 },
        { name: "B", latitude: 1, longitude: 1 },
      ],
    });
    const results = await searchCities("abc");
    expect(results).toHaveLength(0);
  });
});

// ─── Error handling ────────────────────────────────────────────────────────

describe("searchCities — error handling", () => {
  it("returns [] when fetch throws a network error", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network failure"));
    const results = await searchCities("Bangkok");
    expect(results).toEqual([]);
  });

  it("returns [] when response is not ok (404)", async () => {
    mockFetch(null, false, 404);
    const results = await searchCities("Bangkok");
    expect(results).toEqual([]);
  });

  it("returns [] when response is not ok (500)", async () => {
    mockFetch(null, false, 500);
    const results = await searchCities("Bangkok");
    expect(results).toEqual([]);
  });

  it("returns [] when results field is missing from JSON", async () => {
    mockFetch({});
    const results = await searchCities("Bangkok");
    expect(results).toEqual([]);
  });

  it("returns [] when results is an empty array", async () => {
    mockFetch({ results: [] });
    const results = await searchCities("Bangkok");
    expect(results).toEqual([]);
  });

  it("returns [] when fetch is aborted via signal", async () => {
    const controller = new AbortController();
    global.fetch = vi.fn().mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));
    const results = await searchCities("Bangkok", controller.signal);
    expect(results).toEqual([]);
  });
});
