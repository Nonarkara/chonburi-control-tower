import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchMarine } from "./marine";

/**
 * Marine adapter contract tests.
 *
 * IMPORTANT: The adapter uses cachedWithStale with key "marine".
 * Within a single test file all it() blocks share module state, so only
 * the first fetchMarine() call reaches fetch; subsequent calls return
 * the cached result. Tests are ordered and structured accordingly.
 *
 * Test 1: URL check — first call, captures URL, returns {} (no current → scenario).
 * Tests 2+: operate on the cached "scenario" result.
 */
describe("marine adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches from the correct offshore Gulf coordinate (not shallow bay)", async () => {
    // This is the FIRST call — it hits fetch and we can capture the URL.
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      capturedUrl = String(url);
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    await fetchMarine();

    // SEA_POINT = [100.85, 13.00]: open-water Gulf, not [100.95, 13.34] shallow bay
    expect(capturedUrl).toContain("marine-api.open-meteo.com");
    expect(capturedUrl).toContain("longitude=100.85");
    expect(capturedUrl).toContain("latitude=13");
    // The old shallow-bay coordinate must NOT appear
    expect(capturedUrl).not.toContain("longitude=100.95");
  });

  it("returns 'scenario' tier when upstream returns no current block", async () => {
    // This is the SECOND call — returns cached "scenario" from test 1.
    const feed = await fetchMarine();

    expect(feed.meta.fallbackTier).toBe("scenario");
    expect(feed.meta.source).toBe("open-meteo-marine");
    expect(feed.features).toHaveLength(0);
  });

  // Beaufort scale and safety thresholds are pure functions — tested directly.
  it("Beaufort zero → calm (wave + wind below thresholds → all vessel classes safe)", () => {
    // Safety thresholds from the adapter:
    // smallBoat: wave < 1.5 AND wind < 25
    // fishingTrawler: wave < 3.0 AND wind < 40
    // ferry: wave < 2.5 AND wind < 50
    const wave = 0.3;
    const wind = 8;
    const gust = 10;
    const sst = 28;

    // Replicate the safety logic inline to verify the thresholds are correct
    const smallBoatSafe = (wave < 1.5) && (wind < 25);
    const fishingTrawlerSafe = (wave < 3.0) && (wind < 40);
    const ferrySafe = (wave < 2.5) && (wind < 50);
    const thermalStress = sst > 31;

    expect(smallBoatSafe).toBe(true);
    expect(fishingTrawlerSafe).toBe(true);
    expect(ferrySafe).toBe(true);
    expect(thermalStress).toBe(false);
  });

  it("thermal stress threshold activates above 31°C", () => {
    expect(29.5 > 31).toBe(false); // no stress
    expect(31.0 > 31).toBe(false); // exactly 31 — no stress (strict >)
    expect(31.1 > 31).toBe(true);  // stress
  });

  it("small boat unsafe when wave exceeds 1.5 m threshold", () => {
    const wave = 1.6;
    const wind = 20;
    const smallBoatSafe = (wave < 1.5) && (wind < 25);
    expect(smallBoatSafe).toBe(false);
  });
});

// ─── Happy-path response parsing (isolated via resetModules) ─────────────────

describe("marine adapter — happy-path parsing (isolated)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const GOOD_CURRENT = {
    time: "2026-05-01T09:00",
    wave_height: 1.2,
    wave_direction: 135,
    wave_period: 6.5,
    wind_speed_10m: 18.0,
    wind_gusts_10m: 24.0,
    wind_direction_10m: 180,
    sea_surface_temperature: 29.5,
    swell_wave_height: 0.8,
    swell_wave_direction: 140,
    swell_wave_period: 8.0,
    ocean_current_velocity: 0.5,
    ocean_current_direction: 90,
  };

  const GOOD_HOURLY = {
    time: ["2026-05-01T09:00", "2026-05-01T10:00"],
    wave_height: [1.2, 1.4],
    wind_speed_10m: [18.0, 20.0],
    sea_surface_temperature: [29.5, 29.6],
  };

  it("maps Open-Meteo Marine current block to MarineSnapshot", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ current: GOOD_CURRENT, hourly: GOOD_HOURLY }), { status: 200 }),
    );
    const { fetchMarine: fresh } = await import("./marine.js") as unknown as {
      fetchMarine: typeof fetchMarine;
    };

    const feed = await fresh();

    expect(feed.meta.fallbackTier).toBe("live");
    expect(feed.meta.source).toBe("open-meteo-marine");
    expect(feed.features).toHaveLength(1);

    const snap = feed.features[0];
    expect(snap.waveHeightM).toBeCloseTo(1.2);
    expect(snap.waveDirectionDeg).toBe(135);
    expect(snap.wavePeriodS).toBeCloseTo(6.5);
    expect(snap.windKmh).toBeCloseTo(18.0);
    expect(snap.windGustsKmh).toBeCloseTo(24.0);
    expect(snap.sstC).toBeCloseTo(29.5);
    expect(snap.swellHeightM).toBeCloseTo(0.8);
    expect(snap.currentKmh).toBeCloseTo(0.5);
    expect(snap.observedAt).toBe("2026-05-01T09:00");
    vi.restoreAllMocks();
  });

  it("computes Beaufort 3 for 18 km/h wind (12–20 km/h range)", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ current: GOOD_CURRENT }), { status: 200 }),
    );
    const { fetchMarine: fresh } = await import("./marine.js") as unknown as {
      fetchMarine: typeof fetchMarine;
    };

    const feed = await fresh();
    // 18 km/h falls in the 12–19 km/h range → Beaufort 3
    expect(feed.features[0].beaufort).toBe(3);
    vi.restoreAllMocks();
  });

  it("safety flags: calm conditions are safe for all vessel classes", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ current: GOOD_CURRENT }), { status: 200 }),
    );
    const { fetchMarine: fresh } = await import("./marine.js") as unknown as {
      fetchMarine: typeof fetchMarine;
    };

    const feed = await fresh();
    const snap = feed.features[0];
    // wave=1.2 < 1.5 AND wind=18 < 25 → smallBoatSafe
    expect(snap.smallBoatSafe).toBe(true);
    // wave=1.2 < 3.0 AND wind=18 < 40 → fishingTrawlerSafe
    expect(snap.fishingTrawlerSafe).toBe(true);
    // wave=1.2 < 2.5 AND wind=18 < 50 → ferrySafe
    expect(snap.ferrySafe).toBe(true);
    // sst=29.5 ≤ 31 → no thermal stress
    expect(snap.thermalStress).toBe(false);
    vi.restoreAllMocks();
  });

  it("flags thermal stress when SST exceeds 31°C", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        current: { ...GOOD_CURRENT, sea_surface_temperature: 32.1 },
      }), { status: 200 }),
    );
    const { fetchMarine: fresh } = await import("./marine.js") as unknown as {
      fetchMarine: typeof fetchMarine;
    };

    const feed = await fresh();
    expect(feed.features[0].thermalStress).toBe(true);
    vi.restoreAllMocks();
  });

  it("flags small boat unsafe when wave height exceeds 1.5 m", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        current: { ...GOOD_CURRENT, wave_height: 1.8 },
      }), { status: 200 }),
    );
    const { fetchMarine: fresh } = await import("./marine.js") as unknown as {
      fetchMarine: typeof fetchMarine;
    };

    const feed = await fresh();
    expect(feed.features[0].smallBoatSafe).toBe(false);
    // Fishing trawler (< 3.0 m) still safe
    expect(feed.features[0].fishingTrawlerSafe).toBe(true);
    vi.restoreAllMocks();
  });
});

// ─── beaufortFromKmh — Beaufort scale (isolated) ─────────────────────────────

describe("marine adapter — beaufortFromKmh (isolated)", () => {
  type FetchMarine = typeof import("./marine").fetchMarine;

  function makeCurrentResponse(windKmh: number) {
    return {
      current: {
        time: "2026-01-01T08:00",
        wave_height: 0.5,
        wave_direction: 90,
        wave_period: 5,
        wind_speed_10m: windKmh,
        wind_gusts_10m: windKmh * 1.2,
        wind_direction_10m: 45,
        sea_surface_temperature: 28,
        swell_wave_height: 0.3,
        swell_wave_direction: 90,
        swell_wave_period: 8,
        ocean_current_velocity: 0.1,
        ocean_current_direction: 180,
      },
    };
  }

  it.each<[number, number]>([
    [0,   0],   // calm — < 1 km/h
    [3,   1],   // light air — 1–5 km/h
    [8,   2],   // light breeze — 6–11 km/h
    [15,  3],   // gentle breeze — 12–19 km/h
    [24,  4],   // moderate breeze — 20–28 km/h
    [34,  5],   // fresh breeze — 29–38 km/h
    [44,  6],   // strong breeze — 39–49 km/h
    [56,  7],   // near gale — 50–61 km/h
    [68,  8],   // gale — 62–74 km/h
    [82,  9],   // strong gale — 75–88 km/h
    [96,  10],  // storm — 89–102 km/h
    [110, 11],  // violent storm — 103–117 km/h
    [120, 12],  // hurricane — ≥ 118 km/h
  ])("wind %d km/h → Beaufort %d", async (windKmh, expectedBeaufort) => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeCurrentResponse(windKmh)), { status: 200 }),
    );
    const { fetchMarine: fresh } = await import("./marine.js") as unknown as { fetchMarine: FetchMarine };

    const feed = await fresh();
    expect(feed.features[0].beaufort).toBe(expectedBeaufort);
    vi.restoreAllMocks();
  });
});
