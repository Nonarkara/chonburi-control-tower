import { describe, it, expect, vi, afterEach } from "vitest";
import { searchCities } from "./useCustomClocks";

/**
 * searchCities contract tests — the Open-Meteo geocoding search
 * used by the custom-clocks modal. Getting the query guard, field
 * mapping, or admin1 label logic wrong silently shows wrong cities
 * or breaks clock-add UX.
 *
 * Covered:
 *   - short query guard (< 2 chars → empty without fetch)
 *   - empty string / whitespace-only guard
 *   - non-OK HTTP response → []
 *   - network error (fetch throws) → []
 *   - filters results without a timezone
 *   - maps all ClockSpec fields from the geocoding response
 *   - label = "City, Region" when admin1 ≠ name
 *   - label = "City" when admin1 is absent or equals name
 *   - id construction (name + country_code + admin1)
 *   - country fallback when country_code is missing
 */

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Query guard ─────────────────────────────────────────────────────────────

describe("searchCities — query guard", () => {
  it("returns [] without fetching for empty string", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const result = await searchCities("");
    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns [] without fetching for single character", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const result = await searchCities("a");
    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns [] without fetching for whitespace-only string", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const result = await searchCities("  ");
    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("fetches when query has 2+ non-whitespace characters", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );
    const result = await searchCities("Ba");
    expect(result).toEqual([]);
  });
});

// ─── HTTP error handling ──────────────────────────────────────────────────────

describe("searchCities — HTTP error handling", () => {
  it("returns [] when upstream returns 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 500 }),
    );
    const result = await searchCities("Bangkok");
    expect(result).toEqual([]);
  });

  it("returns [] when upstream returns 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 404 }),
    );
    expect(await searchCities("Bangkok")).toEqual([]);
  });

  it("returns [] when fetch throws (network error)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));
    const result = await searchCities("Bangkok");
    expect(result).toEqual([]);
  });

  it("returns [] when upstream returns empty results array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );
    expect(await searchCities("Xyz123Nonexistent")).toEqual([]);
  });

  it("returns [] when upstream returns no results key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    expect(await searchCities("Bangkok")).toEqual([]);
  });
});

// ─── Timezone filter ──────────────────────────────────────────────────────────

describe("searchCities — timezone filter", () => {
  it("excludes results without a timezone field", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        results: [
          { name: "NoTZ", latitude: 0, longitude: 0 },              // no timezone → excluded
          { name: "HasTZ", latitude: 1, longitude: 1, timezone: "UTC" }, // included
        ],
      }), { status: 200 }),
    );
    const result = await searchCities("Test");
    expect(result).toHaveLength(1);
    expect(result[0].id).toContain("HasTZ");
  });

  it("excludes results with null/empty timezone", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        results: [
          { name: "EmptyTZ", latitude: 0, longitude: 0, timezone: "" },
        ],
      }), { status: 200 }),
    );
    const result = await searchCities("Test");
    expect(result).toHaveLength(0);
  });
});

// ─── Field mapping ────────────────────────────────────────────────────────────

describe("searchCities — field mapping", () => {
  const SINGAPORE = {
    name: "Singapore",
    country: "Singapore",
    country_code: "SG",
    admin1: "Central Singapore",
    timezone: "Asia/Singapore",
    latitude: 1.3521,
    longitude: 103.8198,
  };

  it("maps timezone to tz field", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [SINGAPORE] }), { status: 200 }),
    );
    const [result] = await searchCities("Singapore");
    expect(result.tz).toBe("Asia/Singapore");
  });

  it("maps latitude → lat and longitude → lng", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [SINGAPORE] }), { status: 200 }),
    );
    const [result] = await searchCities("Singapore");
    expect(result.lat).toBeCloseTo(1.3521);
    expect(result.lng).toBeCloseTo(103.8198);
  });

  it("uses country_code as country field", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [SINGAPORE] }), { status: 200 }),
    );
    const [result] = await searchCities("Singapore");
    expect(result.country).toBe("SG");
  });

  it("falls back to empty string country when country_code is absent", async () => {
    const noCode = { ...SINGAPORE, country_code: undefined };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [noCode] }), { status: 200 }),
    );
    const [result] = await searchCities("Singapore");
    expect(result.country).toBe("");
  });
});

// ─── Label construction ───────────────────────────────────────────────────────

describe("searchCities — label construction", () => {
  it("uses 'Name, Admin1' when admin1 is present and differs from name", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        results: [{
          name: "Boston",
          country_code: "US",
          admin1: "Massachusetts",
          timezone: "America/New_York",
          latitude: 42.36,
          longitude: -71.06,
        }],
      }), { status: 200 }),
    );
    const [result] = await searchCities("Boston");
    expect(result.label).toBe("Boston, Massachusetts");
  });

  it("uses just 'Name' when admin1 equals name", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        results: [{
          name: "Singapore",
          country_code: "SG",
          admin1: "Singapore",  // same as name
          timezone: "Asia/Singapore",
          latitude: 1.35,
          longitude: 103.82,
        }],
      }), { status: 200 }),
    );
    const [result] = await searchCities("Singapore");
    expect(result.label).toBe("Singapore");
  });

  it("uses just 'Name' when admin1 is absent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        results: [{
          name: "Chonburi",
          country_code: "TH",
          timezone: "Asia/Bangkok",
          latitude: 13.36,
          longitude: 100.98,
        }],
      }), { status: 200 }),
    );
    const [result] = await searchCities("Chonburi");
    expect(result.label).toBe("Chonburi");
  });
});

// ─── ID construction ──────────────────────────────────────────────────────────

describe("searchCities — id construction", () => {
  it("id = 'name-countryCode-admin1'", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        results: [{
          name: "Tokyo",
          country_code: "JP",
          admin1: "Tokyo",
          timezone: "Asia/Tokyo",
          latitude: 35.68,
          longitude: 139.69,
        }],
      }), { status: 200 }),
    );
    const [result] = await searchCities("Tokyo");
    expect(result.id).toBe("Tokyo-JP-Tokyo");
  });

  it("id uses empty string for country code when absent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        results: [{
          name: "Somewhere",
          timezone: "UTC",
          latitude: 0,
          longitude: 0,
        }],
      }), { status: 200 }),
    );
    const [result] = await searchCities("Somewhere");
    expect(result.id).toBe("Somewhere--");
  });
});

// ─── URL encoding ─────────────────────────────────────────────────────────────

describe("searchCities — URL encoding", () => {
  it("URL-encodes special characters in the query", async () => {
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      capturedUrl = String(url);
      return Promise.resolve(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    });

    await searchCities("São Paulo");
    expect(capturedUrl).toContain("geocoding-api.open-meteo.com");
    expect(capturedUrl).not.toContain(" ");
    // "ã" and spaces must be encoded
    expect(capturedUrl).toContain("%20");
  });

  it("targets the Open-Meteo geocoding endpoint with count=8", async () => {
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      capturedUrl = String(url);
      return Promise.resolve(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    });

    await searchCities("Bangkok");
    expect(capturedUrl).toContain("geocoding-api.open-meteo.com");
    expect(capturedUrl).toContain("count=8");
    expect(capturedUrl).toContain("language=en");
    expect(capturedUrl).toContain("name=Bangkok");
  });
});
