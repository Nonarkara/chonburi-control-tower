import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchNasaEarth } from "./nasa-power";
import type { NasaEarthReadings } from "@chonburi/shared";

/**
 * NASA POWER adapter contract tests.
 *
 * No auth required. Tests the maintenance/unavailable path when the API
 * returns a response with no usable parameters, and the happy path when
 * realistic MERRA-2 data is present.
 */
describe("nasa-power adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requests NASA POWER with correct Chonburi coordinates and date range", async () => {
    // FIRST test in file — initial cache-miss, so fetch IS called.
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      capturedUrl = String(url);
      return Promise.resolve(new Response(JSON.stringify({ properties: {} }), { status: 200 }));
    });

    await fetchNasaEarth();

    expect(capturedUrl).toContain("power.larc.nasa.gov");
    expect(capturedUrl).toContain("T2M");
    expect(capturedUrl).toContain("community=RE");
    // Chonburi lat/lng — should be approximately 13.3° N / 100.9° E
    expect(capturedUrl).toMatch(/latitude=13\./);
    expect(capturedUrl).toMatch(/longitude=100\./);
  });

  it("returns 'unavailable' with a note when API returns no parameter block", async () => {
    // SECOND test — returns cached "unavailable" result from test 1.
    const feed = await fetchNasaEarth();

    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.source).toBe("nasa-power-merra2");
    expect(feed.meta.note).toMatch(/NASA POWER/);
    // Still returns one reading placeholder (nulled-out values)
    expect(feed.features).toHaveLength(1);
  });

  it("solar unit conversion: 18.4 MJ/m² ÷ 3.6 ≈ 5.1 kWh/m²", () => {
    // Verify the conversion constant inline (pure math, no caching concern)
    const solarMJm2 = 18.4;
    const solarKWhm2 = Math.round((solarMJm2 / 3.6) * 10) / 10;
    expect(solarKWhm2).toBeCloseTo(5.1, 0);
  });

  it("NASA fill-value threshold: values at -990 or below map to null", () => {
    // Mirrors the clean() function in nasa-power.ts
    const clean = (v: number | undefined): number | null => {
      if (v == null || v === -999 || v <= -990) return null;
      return v;
    };
    expect(clean(-999)).toBeNull();
    expect(clean(-990)).toBeNull();
    expect(clean(-991)).toBeNull();
    expect(clean(-989)).toBe(-989); // just above threshold — not filtered
    expect(clean(30.2)).toBe(30.2);
    expect(clean(0)).toBe(0);
  });
});

// ─── Happy-path response parsing (isolated via resetModules) ─────────────────

describe("nasa-power adapter — happy-path parsing (isolated)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Realistic MERRA-2 data for Chonburi, early May
  const TODAY = "20260501";
  const PREV  = "20260430";

  const GOOD_RESPONSE = {
    properties: {
      parameter: {
        T2M:               { [PREV]: 29.4, [TODAY]: 30.1 },
        PRECTOTCORR:       { [PREV]: 12.3, [TODAY]:  5.0 },
        ALLSKY_SFC_SW_DWN: { [PREV]: 18.4, [TODAY]: 16.2 },
        ALLSKY_KT:         { [PREV]:  0.52, [TODAY]:  0.48 },
      },
    },
  };

  it("maps MERRA-2 parameters to NasaEarthReadings shape", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(GOOD_RESPONSE), { status: 200 }),
    );
    const { fetchNasaEarth: fresh } = await import("./nasa-power.js") as unknown as {
      fetchNasaEarth: typeof fetchNasaEarth;
    };

    const feed = await fresh();

    expect(feed.meta.fallbackTier).toBe("live");
    expect(feed.meta.source).toBe("nasa-power-merra2");
    expect(feed.features).toHaveLength(1);

    const r: NasaEarthReadings = feed.features[0];
    // Most-recent non-null value — TODAY is 20260501 (sorts later)
    expect(r.tempC).toBeCloseTo(30.1, 1);
    expect(r.precipMmDay).toBeCloseTo(5.0, 1);
    // Solar: 16.2 MJ/m² → 16.2 / 3.6 = 4.5 kWh/m² (rounded to 1 dp)
    expect(r.solarKWhm2).toBeCloseTo(4.5, 0);
    expect(r.clearnessIndex).toBeCloseTo(0.48, 2);
    // dataDate should be the date key of the latest non-null T2M value
    expect(r.dataDate).toBe(TODAY);
    vi.restoreAllMocks();
  });

  it("returns 'live' tier when any parameter has data", async () => {
    vi.resetModules();
    // Only T2M populated — other params are all fill values
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        properties: {
          parameter: {
            T2M: { "20260501": 28.0 },
            PRECTOTCORR: { "20260501": -999 },
            ALLSKY_SFC_SW_DWN: {},
            ALLSKY_KT: {},
          },
        },
      }), { status: 200 }),
    );
    const { fetchNasaEarth: fresh } = await import("./nasa-power.js") as unknown as {
      fetchNasaEarth: typeof fetchNasaEarth;
    };

    const feed = await fresh();
    expect(feed.meta.fallbackTier).toBe("live");
    expect(feed.features[0].tempC).toBeCloseTo(28.0, 1);
    expect(feed.features[0].precipMmDay).toBeNull(); // fill value filtered
    expect(feed.features[0].solarKWhm2).toBeNull();  // no data
    vi.restoreAllMocks();
  });

  it("picks most-recent non-null entry when latest date has fill value", async () => {
    vi.resetModules();
    // TODAY is a fill value → should fall back to PREV
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        properties: {
          parameter: {
            T2M: { [TODAY]: -999, [PREV]: 27.5 },
            PRECTOTCORR: {},
            ALLSKY_SFC_SW_DWN: {},
            ALLSKY_KT: {},
          },
        },
      }), { status: 200 }),
    );
    const { fetchNasaEarth: fresh } = await import("./nasa-power.js") as unknown as {
      fetchNasaEarth: typeof fetchNasaEarth;
    };

    const feed = await fresh();
    expect(feed.features[0].tempC).toBeCloseTo(27.5, 1);
    vi.restoreAllMocks();
  });

  it("dataDate returns 'unknown' when all T2M and PRECTOTCORR values are fill values", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        properties: {
          parameter: {
            T2M: { [TODAY]: -999, [PREV]: -999 },
            PRECTOTCORR: { [TODAY]: -999 },
            ALLSKY_SFC_SW_DWN: {},
            ALLSKY_KT: {},
          },
        },
      }), { status: 200 }),
    );
    const { fetchNasaEarth: fresh } = await import("./nasa-power.js") as unknown as {
      fetchNasaEarth: typeof fetchNasaEarth;
    };

    const feed = await fresh();
    expect(feed.features[0].dataDate).toBe("unknown");
    expect(feed.features[0].tempC).toBeNull();
    vi.restoreAllMocks();
  });

  it("yyyymmdd: request URL contains date in YYYYMMDD format 4 days before now", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    // Set a fixed date so the URL's start date is deterministic
    vi.setSystemTime(new Date("2026-06-15T00:00:00Z"));
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      capturedUrl = String(url);
      return Promise.resolve(new Response(JSON.stringify({ properties: {} }), { status: 200 }));
    });

    const { fetchNasaEarth: fresh } = await import("./nasa-power.js") as unknown as {
      fetchNasaEarth: typeof fetchNasaEarth;
    };
    await fresh();

    // d4 = June 11, d3 = June 12
    expect(capturedUrl).toContain("start=20260611");
    expect(capturedUrl).toContain("end=20260612");
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
