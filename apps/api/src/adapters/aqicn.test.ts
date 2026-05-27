import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchAqicnChonburi, fetchAqicnByGeo, fetchAqicnByStation } from "./aqicn";

/**
 * AQICN adapter contract tests.
 *
 * The no-token path is synchronous (early return before any HTTP call),
 * so those tests require no fetch mocking.
 *
 * fetchAqicnByGeo/Station are uncached — happy-path tests can run
 * without vi.resetModules().
 */

// ─── Missing-token ─────────────────────────────────────────────────────────────

describe("aqicn adapter — missing-token contract", () => {
  it("returns 'unavailable' with descriptive note when AQICN_TOKEN is absent", async () => {
    const feed = await fetchAqicnChonburi({});

    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.source).toBe("aqicn");
    expect(feed.meta.note).toMatch(/AQICN_TOKEN/);
    expect(feed.meta.note).toMatch(/aqicn\.org/);
    expect(feed.features).toHaveLength(0);
  });

  it("does not call fetch when token is missing", async () => {
    // The adapter short-circuits before any HTTP call — so even without mocking
    // fetch, this should complete instantly and cleanly.
    const start = Date.now();
    await fetchAqicnChonburi({ AQICN_TOKEN: undefined });
    const elapsed = Date.now() - start;

    // Should complete in < 50ms (no network round-trip)
    expect(elapsed).toBeLessThan(50);
  });
});

// ─── fetchAqicnByGeo (uncached, tests full response parsing) ─────────────────

describe("aqicn adapter — fetchAqicnByGeo response parsing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const GOOD_RESP = {
    status: "ok",
    data: {
      aqi: 45,
      idx: 5774,
      city: {
        name: "Chonburi, Ban Bung",
        url: "https://aqicn.org/city/chonburi",
        geo: [13.3611, 100.9648],
      },
      iaqi: {
        pm25: { v: 12.3 },
        pm10: { v: 20.0 },
        no2:  { v: 8.5 },
        o3:   { v: 42.0 },
      },
      time: { iso: "2026-01-01T08:00:00+07:00" },
    },
  };

  it("returns null when no token is provided", async () => {
    const result = await fetchAqicnByGeo({}, 13.36, 100.96);
    expect(result).toBeNull();
  });

  it("maps a full API response to AqicnStation shape", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(GOOD_RESP), { status: 200 }),
    );

    const station = await fetchAqicnByGeo({ AQICN_TOKEN: "tok" }, 13.3611, 100.9648);

    expect(station).not.toBeNull();
    expect(station!.aqi).toBe(45);
    expect(station!.pm25).toBeCloseTo(12.3);
    expect(station!.pm10).toBeCloseTo(20.0);
    expect(station!.no2).toBeCloseTo(8.5);
    expect(station!.o3).toBeCloseTo(42.0);
    expect(station!.station).toBe("Chonburi, Ban Bung");
    expect(station!.stationUrl).toBe("https://aqicn.org/city/chonburi");
    expect(station!.lat).toBeCloseTo(13.3611);
    expect(station!.lng).toBeCloseTo(100.9648);
    expect(station!.observedAt).toBe("2026-01-01T08:00:00+07:00");
  });

  it("returns null when API returns error status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "error", data: "Invalid key" }), { status: 200 }),
    );

    const station = await fetchAqicnByGeo({ AQICN_TOKEN: "bad-tok" }, 13.36, 100.96);
    expect(station).toBeNull();
  });

  it("returns null when API returns nug (no data for location)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "nug" }), { status: 200 }),
    );

    const station = await fetchAqicnByGeo({ AQICN_TOKEN: "tok" }, 0, 0);
    expect(station).toBeNull();
  });

  it("handles partial iaqi (missing pm10, no2, o3)", async () => {
    const partial = {
      status: "ok",
      data: {
        aqi: 30,
        city: { name: "Partial Station", geo: [13.0, 101.0] },
        iaqi: { pm25: { v: 8 } },
        time: { iso: "2026-01-01T06:00:00+07:00" },
      },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(partial), { status: 200 }),
    );

    const station = await fetchAqicnByGeo({ AQICN_TOKEN: "tok" }, 13.0, 101.0);
    expect(station).not.toBeNull();
    expect(station!.pm25).toBe(8);
    expect(station!.pm10).toBeNull();
    expect(station!.no2).toBeNull();
    expect(station!.o3).toBeNull();
  });
});

// ─── fetchAqicnByStation — URL normalization ──────────────────────────────────

describe("aqicn adapter — fetchAqicnByStation URL", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("adds @ prefix when station id does not start with @", async () => {
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      capturedUrl = String(url);
      return Promise.resolve(new Response(JSON.stringify({ status: "nug" }), { status: 200 }));
    });

    await fetchAqicnByStation({ AQICN_TOKEN: "tok" }, "5774");
    expect(capturedUrl).toContain("/feed/@5774/");
  });

  it("does not double-add @ when id already starts with @", async () => {
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      capturedUrl = String(url);
      return Promise.resolve(new Response(JSON.stringify({ status: "nug" }), { status: 200 }));
    });

    await fetchAqicnByStation({ AQICN_TOKEN: "tok" }, "@5774");
    expect(capturedUrl).toContain("/feed/@5774/");
    expect(capturedUrl).not.toContain("/feed/@@");
  });
});
