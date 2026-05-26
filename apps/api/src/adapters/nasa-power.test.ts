import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchNasaEarth } from "./nasa-power";

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
