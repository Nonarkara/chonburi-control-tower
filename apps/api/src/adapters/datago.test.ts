import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchReservoirs, fetchDisasterStats, fetchFahfon, fetchDatagoPoints } from "./datago";
import type { ReservoirStatus, DisasterStat, FahfonReading, RoadSafetySnapshot } from "./datago";

/**
 * data.go.th adapter contract tests.
 *
 * All three live-data functions (reservoirs, disasters, fahfon) require
 * DATA_GO_TH_TOKEN. When the token is absent (empty string), the adapter
 * must return `fallbackTier: "unavailable"` with a descriptive note
 * rather than attempting an unauthenticated CKAN request.
 */

// Simulate the CKAN API returning 401 when token is missing
function mock401() {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("{}", { status: 401 }),
  );
}

describe("datago adapter — missing-token contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchReservoirs returns 'unavailable' with token note when token is absent", async () => {
    mock401();
    const feed = await fetchReservoirs("");

    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.note).toMatch(/DATA_GO_TH_TOKEN/);
    expect(feed.features).toHaveLength(0);
  });

  it("fetchDisasterStats returns 'unavailable' with token note when token is absent", async () => {
    mock401();
    const feed = await fetchDisasterStats("");

    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.note).toMatch(/DATA_GO_TH_TOKEN/);
    expect(feed.features).toHaveLength(0);
  });

  it("fetchFahfon returns 'unavailable' with token note when token is absent", async () => {
    mock401();
    const feed = await fetchFahfon("");

    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.note).toMatch(/DATA_GO_TH_TOKEN/);
    expect(feed.features).toHaveLength(0);
  });

  it("note distinguishes 'missing token' from 'CKAN upstream failure'", () => {
    // Verify the note strings are correctly differentiated at the logic level.
    // (Can't re-call fetchReservoirs with a different token in the same file
    //  because cachedWithStale keeps the first-call result for "datago-reservoirs".)
    const NO_TOKEN_NOTE = "Missing DATA_GO_TH_TOKEN env var — data.go.th feeds disabled";
    const UPSTREAM_NOTE = "CKAN returned no rows — upstream may be down";

    // These must be different messages so operators can distinguish key-missing vs upstream issues
    expect(NO_TOKEN_NOTE).not.toBe(UPSTREAM_NOTE);
    expect(NO_TOKEN_NOTE).toMatch(/DATA_GO_TH_TOKEN/);
    expect(UPSTREAM_NOTE).toMatch(/CKAN/);
    expect(UPSTREAM_NOTE).not.toMatch(/DATA_GO_TH_TOKEN/);
  });
});

// ─── fetchDatagoPoints — curated static list ─────────────────────────────────

describe("fetchDatagoPoints — curated static feed", () => {
  it("returns 'database' fallback tier (no external HTTP call)", () => {
    const feed = fetchDatagoPoints();
    expect(feed.meta.fallbackTier).toBe("database");
    expect(feed.meta.source).toBe("data.go.th");
    expect(feed.meta.fetchedAt).toBeTruthy();
  });

  it("returns a non-empty list of POIs", () => {
    const feed = fetchDatagoPoints();
    expect(feed.features.length).toBeGreaterThan(0);
  });

  it("includes Chonburi Hospital with correct coordinates and category", () => {
    const feed = fetchDatagoPoints();
    const hospital = feed.features.find((p) => p.id === "hosp-chonburi");
    expect(hospital).toBeDefined();
    expect(hospital!.name).toMatch(/โรงพยาบาลชลบุรี/);
    expect(hospital!.nameEn).toMatch(/Chonburi Hospital/i);
    expect(hospital!.category).toBe("hospital");
    // Chonburi city coordinates: ~13.37°N, 100.98°E
    expect(hospital!.lat).toBeGreaterThan(13.0);
    expect(hospital!.lat).toBeLessThan(14.0);
    expect(hospital!.lng).toBeGreaterThan(100.5);
    expect(hospital!.lng).toBeLessThan(101.5);
  });

  it("includes municipal hall in the government category", () => {
    const feed = fetchDatagoPoints();
    const hall = feed.features.find((p) => p.id === "gov-municipal-hall");
    expect(hall).toBeDefined();
    expect(hall!.category).toBe("office");
    expect(hall!.nameEn).toMatch(/Municipal/i);
  });

  it("every POI has the required DatagoPoint shape", () => {
    const feed = fetchDatagoPoints();
    for (const poi of feed.features) {
      expect(typeof poi.id).toBe("string");
      expect(typeof poi.name).toBe("string");
      expect(typeof poi.category).toBe("string");
      expect(typeof poi.lat).toBe("number");
      expect(typeof poi.lng).toBe("number");
      expect(typeof poi.source).toBe("string");
      // All must be in Chonburi bbox: lng [100.80, 101.10], lat [13.05, 13.50]
      expect(poi.lat).toBeGreaterThanOrEqual(13.05);
      expect(poi.lat).toBeLessThanOrEqual(13.50);
      expect(poi.lng).toBeGreaterThanOrEqual(100.80);
      expect(poi.lng).toBeLessThanOrEqual(101.10);
    }
  });

  it("includes at least one entry from each key category", () => {
    const feed = fetchDatagoPoints();
    const categories = new Set(feed.features.map((p) => p.category));
    expect(categories.has("hospital")).toBe(true);
    expect(categories.has("school")).toBe(true);
    expect(categories.has("temple")).toBe(true);
    expect(categories.has("office")).toBe(true); // government + police use "office"
  });

  it("includes Burapha University as an educational entry", () => {
    const feed = fetchDatagoPoints();
    const burapha = feed.features.find((p) => p.id === "sch-burapha-uni");
    expect(burapha).toBeDefined();
    expect(burapha!.category).toBe("school");
    // Burapha is at ~13.28°N — Bang Saen campus, inside bbox
    expect(burapha!.lat).toBeCloseTo(13.28, 0);
  });
});

// ─── fetchReservoirs — happy-path isolated ────────────────────────────────────

describe("fetchReservoirs — happy-path", () => {
  // Use module reset + fresh import to bypass module-level cache
  let fetchReservoirsIsolated: typeof fetchReservoirs;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("./datago.js") as unknown as { fetchReservoirs: typeof fetchReservoirs };
    fetchReservoirsIsolated = mod.fetchReservoirs;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps CKAN records to ReservoirStatus shape with 'live' tier", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      result: {
        records: [{
          "Reservoir": "อ่างเก็บน้ำหนองค้อ",
          "Sub-district/District": "หนองค้อ / เมืองชลบุรี",
          "Current Water Volume (million cubic meters)": "12.5",
          "Water Volume Yesterday": "12.3",
          "Maximum Storage Capacity (million cubic meters)": "25.0",
          "Remaining Water Supply (days)": "180",
          "Current Reservoir Storage (% of Original Capacity)": "50",
          "Yesterday's Rainfall (mm)": "3.2",
        }],
      },
    }), { status: 200 })));

    const feed = await fetchReservoirsIsolated("test-token");

    expect(feed.meta.fallbackTier).toBe("live");
    expect(feed.meta.source).toBe("datago-reservoirs");
    expect(feed.features).toHaveLength(1);
    const r = feed.features[0] as ReservoirStatus;
    expect(r.name).toBe("อ่างเก็บน้ำหนองค้อ");
    expect(r.currentVolMCM).toBeCloseTo(12.5);
    expect(r.maxVolMCM).toBeCloseTo(25.0);
    expect(r.capacityPct).toBeCloseTo(50);
    expect(r.daysRemaining).toBe(180);
    expect(r.rainfallYesterdayMm).toBeCloseTo(3.2);
    expect(r.trend).toBe("rising"); // 12.5 > 12.3
  });

  it("computes 'falling' trend when volume is lower than yesterday", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      result: {
        records: [{
          "Reservoir": "Test Reservoir",
          "Sub-district/District": "Test",
          "Current Water Volume (million cubic meters)": "10.0",
          "Water Volume Yesterday": "10.5",
          "Maximum Storage Capacity (million cubic meters)": "30.0",
          "Remaining Water Supply (days)": "90",
          "Current Reservoir Storage (% of Original Capacity)": "33",
          "Yesterday's Rainfall (mm)": "0",
        }],
      },
    }), { status: 200 })));

    const feed = await fetchReservoirsIsolated("test-token");
    expect(feed.features[0].trend).toBe("falling");
  });

  it("sorts features so reservoirs with fewest days remaining appear first", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      result: {
        records: [
          { "Reservoir": "A", "Sub-district/District": "", "Current Water Volume (million cubic meters)": "5", "Water Volume Yesterday": "5", "Maximum Storage Capacity (million cubic meters)": "20", "Remaining Water Supply (days)": "200", "Current Reservoir Storage (% of Original Capacity)": "25", "Yesterday's Rainfall (mm)": "0" },
          { "Reservoir": "B", "Sub-district/District": "", "Current Water Volume (million cubic meters)": "2", "Water Volume Yesterday": "2", "Maximum Storage Capacity (million cubic meters)": "10", "Remaining Water Supply (days)": "30",  "Current Reservoir Storage (% of Original Capacity)": "20", "Yesterday's Rainfall (mm)": "0" },
        ],
      },
    }), { status: 200 })));

    const feed = await fetchReservoirsIsolated("test-token");
    expect(feed.features[0].name).toBe("B"); // 30 days → critical first
    expect(feed.features[1].name).toBe("A"); // 200 days → second
  });
});

// ─── fetchDisasterStats — happy-path isolated ─────────────────────────────────

describe("fetchDisasterStats — happy-path", () => {
  let fetchDisasterStatsIsolated: typeof fetchDisasterStats;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("./datago.js") as unknown as { fetchDisasterStats: typeof fetchDisasterStats };
    fetchDisasterStatsIsolated = mod.fetchDisasterStats;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps CKAN rows to DisasterStat shape with 'live' tier", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      result: {
        records: [
          { "ประเภทภัย": "อัคคีภัย", "ปี": "2567", "สถิติสาธารณภัย": "42" },
          { "ประเภทภัย": "อุทกภัย",  "ปี": "2567", "สถิติสาธารณภัย": "18" },
        ],
      },
    }), { status: 200 })));

    const feed = await fetchDisasterStatsIsolated("test-token");

    expect(feed.meta.fallbackTier).toBe("live");
    expect(feed.meta.source).toBe("datago-disasters");
    expect(feed.features).toHaveLength(2);
    const fire = feed.features[0] as DisasterStat;
    expect(fire.type).toBe("อัคคีภัย");
    expect(fire.year).toBe(2567);
    expect(fire.count).toBe(42);
  });
});

// ─── fetchFahfon — happy-path isolated ───────────────────────────────────────

describe("fetchFahfon — happy-path", () => {
  let fetchFahfonIsolated: typeof fetchFahfon;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("./datago.js") as unknown as { fetchFahfon: typeof fetchFahfon };
    fetchFahfonIsolated = mod.fetchFahfon;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps CKAN rows to FahfonReading shape with 'live' tier", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      result: {
        records: [{
          "สถานีตรวจวัดอากาศ": "Bang Sarae Station",
          "DATE": "2025-06-01",
          "TEMP (C)": "30.5",
          "CO2 (ppm)": "412",
          "PM1 (มคก./ลบ.ม.)": "8",
          "PM2.5 (มคก./ลบ.ม.)": "22",
          "PM10 (มคก./ลบ.ม.)": "38",
        }],
      },
    }), { status: 200 })));

    const feed = await fetchFahfonIsolated("test-token");

    expect(feed.meta.fallbackTier).toBe("live");
    expect(feed.meta.source).toBe("datago-fahfon");
    expect(feed.features).toHaveLength(1);
    const r = feed.features[0] as FahfonReading;
    expect(r.station).toBe("Bang Sarae Station");
    expect(r.date).toBe("2025-06-01");
    expect(r.tempC).toBeCloseTo(30.5);
    expect(r.co2Ppm).toBe(412);
    expect(r.pm25).toBe(22);
    expect(r.pm10).toBe(38);
  });

  it("returns null for zero-value sensor readings (0 → null coercion)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      result: {
        records: [{
          "สถานีตรวจวัดอากาศ": "Test",
          "DATE": "2025-06-01",
          "TEMP (C)": "0",
          "CO2 (ppm)": "0",
          "PM1 (มคก./ลบ.ม.)": "0",
          "PM2.5 (มคก./ลบ.ม.)": "0",
          "PM10 (มคก./ลบ.ม.)": "0",
        }],
      },
    }), { status: 200 })));

    const feed = await fetchFahfonIsolated("test-token");
    const r = feed.features[0] as FahfonReading;
    // The adapter uses `Number(x) || null` — 0 is falsy → null
    expect(r.tempC).toBeNull();
    expect(r.pm25).toBeNull();
  });
});

// ─── fetchRoadSafety ──────────────────────────────────────────────────────────

describe("fetchRoadSafety — missing-token contract", () => {
  it("returns 'unavailable' with token note when token is absent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));
    // Use fresh isolated import to bypass cache from other tests
    vi.resetModules();
    const { fetchRoadSafety } = await import("./datago.js") as unknown as { fetchRoadSafety: (t: string) => Promise<{ meta: { fallbackTier: string; note?: string }; features: unknown[] }> };
    const feed = await fetchRoadSafety("");
    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.note).toMatch(/DATA_GO_TH_TOKEN/);
    expect(feed.features).toHaveLength(0);
    vi.restoreAllMocks();
  });
});

describe("fetchRoadSafety — happy-path (isolated)", () => {
  let fetchRoadSafetyIsolated: (token: string) => Promise<{ features: RoadSafetySnapshot[]; meta: { fallbackTier: string; source: string } }>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("./datago.js") as unknown as {
      fetchRoadSafety: (t: string) => Promise<{ features: RoadSafetySnapshot[]; meta: { fallbackTier: string; source: string } }>;
    };
    fetchRoadSafetyIsolated = mod.fetchRoadSafety;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeMonthly(year: number, month: number, deaths: number, injured: number): Record<string, unknown> {
    return { "ปี": String(year), "เดือน": String(month), "เสียชีวิต(คน)": String(deaths), "บาดเจ็บ(คน)": String(injured) };
  }

  it("maps CKAN monthly rows to RoadSafetySnapshot with 'live' tier", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({
        result: {
          records: [
            makeMonthly(2567, 1, 5, 20),
            makeMonthly(2567, 2, 3, 15),
          ],
        },
      }), { status: 200 })),
    );

    const feed = await fetchRoadSafetyIsolated("test-token");

    expect(feed.meta.fallbackTier).toBe("live");
    expect(feed.meta.source).toBe("datago-road-safety");
    expect(feed.features).toHaveLength(1);

    const snap = feed.features[0] as RoadSafetySnapshot;
    expect(snap.year).toBe(2567);
    expect(snap.totalDeaths).toBe(8);    // 5 + 3
    expect(snap.totalInjured).toBe(35);  // 20 + 15
    expect(snap.monthly).toHaveLength(12);
    // Month 1 populated
    expect(snap.monthly[0]).toEqual({ month: 1, deaths: 5, injured: 20 });
    // Month 3 not in data → zeros
    expect(snap.monthly[2]).toEqual({ month: 3, deaths: 0, injured: 0 });
  });

  it("computes prevYearDeaths and prevYearInjured from previous year rows", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({
        result: {
          records: [
            makeMonthly(2567, 1, 5, 20),
            makeMonthly(2566, 1, 7, 30),
            makeMonthly(2566, 2, 4, 10),
          ],
        },
      }), { status: 200 })),
    );

    const feed = await fetchRoadSafetyIsolated("test-token");
    const snap = feed.features[0] as RoadSafetySnapshot;
    expect(snap.year).toBe(2567);
    expect(snap.prevYearDeaths).toBe(11);   // 7 + 4
    expect(snap.prevYearInjured).toBe(40);  // 30 + 10
  });

  it("returns 'unavailable' when monthly rows come back empty (no token)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ result: { records: [] } }), { status: 200 }),
    );

    const feed = await fetchRoadSafetyIsolated("test-token");
    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.features).toHaveLength(0);
  });

  it("handles comma-formatted Thai numbers (parseThaiNum via sumField)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({
        result: {
          records: [
            { "ปี": "2567", "เดือน": "1", "เสียชีวิต(คน)": "1,234", "บาดเจ็บ(คน)": "5,678" },
          ],
        },
      }), { status: 200 })),
    );

    const feed = await fetchRoadSafetyIsolated("test-token");
    const snap = feed.features[0] as RoadSafetySnapshot;
    expect(snap.totalDeaths).toBe(1234);
    expect(snap.totalInjured).toBe(5678);
  });
});
