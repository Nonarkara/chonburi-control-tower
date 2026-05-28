import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchCityReports } from "./cityReporter";

/**
 * City reporter (Traffy Fondue) adapter contract tests.
 *
 * Tests verify URL, NormalizedFeed shape, bbox filtering, and fallback tier.
 * URL-capture test is FIRST — subsequent tests use the cached result.
 */

// Inside FEED_BBOX (lng 100.70–101.50, lat 12.50–13.55)
const CHONBURI_LNG = 100.9648;
const CHONBURI_LAT = 13.3611;

// Outside FEED_BBOX (west of Chonburi, in the Gulf)
const OUTSIDE_LNG = 100.00;
const OUTSIDE_LAT = 13.00;

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    ticket_id: "TEST-001",
    type: "ถนน",          // road → construction category
    state: "new",
    latitude: CHONBURI_LAT,
    longitude: CHONBURI_LNG,
    address: "ชลบุรี",
    org: "เทศบาลเมืองชลบุรี",
    timestamp: new Date().toISOString(),
    description: "Road pothole reported",
    ...overrides,
  };
}

describe("city reporter adapter (Traffy Fondue)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requests the Traffy Fondue search endpoint with Chonburi keyword", async () => {
    // FIRST test — cache miss.
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      capturedUrl = String(url);
      const payload = { results: [makeReport()] };
      return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
    });

    await fetchCityReports();

    expect(capturedUrl).toContain("traffy.in.th");
    expect(capturedUrl).toContain("ชลบุรี"); // Thai keyword in query
  });

  it("returns NormalizedFeed with live tier when items are in bbox", async () => {
    // SECOND test — cached result from test 1.
    const feed = await fetchCityReports();

    expect(feed.meta.source).toBe("traffy-fondue");
    expect(feed.meta.fallbackTier).toBe("live");
    expect(feed.features.length).toBeGreaterThan(0);

    const item = feed.features[0];
    expect(item.id).toMatch(/^traffy-/);
    expect(item.reporterPlatform).toBe("traffy");
    expect(item).toHaveProperty("lat");
    expect(item).toHaveProperty("lng");
    expect(item).toHaveProperty("category");
    expect(item).toHaveProperty("severity");
    expect(item).toHaveProperty("status");
  });
});

describe("city reporter adapter — scenario fallback (isolated)", () => {
  it("returns scenario tier and empty features when endpoint returns null", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 500 })),
    );

    const { fetchCityReports: fresh } = await import("./cityReporter");
    const feed = await fresh();

    expect(feed.meta.fallbackTier).toBe("scenario");
    expect(feed.features).toHaveLength(0);
    vi.restoreAllMocks();
  });
});

describe("city reporter adapter — bbox filtering (isolated)", () => {
  it("excludes reports outside the Eastern Seaboard bbox", async () => {
    vi.resetModules();
    const insideReport = makeReport({ latitude: CHONBURI_LAT, longitude: CHONBURI_LNG, ticket_id: "IN-001" });
    const outsideReport = makeReport({
      latitude: OUTSIDE_LAT,
      longitude: OUTSIDE_LNG,
      org: "", address: "Bangkok",   // no Chonburi org-match either
      ticket_id: "OUT-001",
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ results: [insideReport, outsideReport] }), { status: 200 }),
      ),
    );

    const { fetchCityReports: fresh } = await import("./cityReporter");
    const feed = await fresh();

    // Inside item must be present, outside item must be filtered
    expect(feed.features.some((f) => f.id === "traffy-IN-001")).toBe(true);
    expect(feed.features.some((f) => f.id === "traffy-OUT-001")).toBe(false);
    vi.restoreAllMocks();
  });

  it("accepts out-of-bbox reports when org/address matches ชลบุรี", async () => {
    vi.resetModules();
    // Coordinates outside bbox but address includes ชลบุรี
    const orgMatchReport = makeReport({
      latitude: OUTSIDE_LAT,
      longitude: OUTSIDE_LNG,
      org: "สาขาชลบุรี",
      address: "ชลบุรี 20000",
      ticket_id: "ORG-001",
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ results: [orgMatchReport] }), { status: 200 }),
      ),
    );

    const { fetchCityReports: fresh } = await import("./cityReporter");
    const feed = await fresh();

    expect(feed.features.some((f) => f.id === "traffy-ORG-001")).toBe(true);
    vi.restoreAllMocks();
  });

  it("falls back to coords array when lat/lng fields are absent", async () => {
    vi.resetModules();
    // Traffy sometimes sends coords as [lng, lat] stringified array instead of lat/lng fields
    const coordsReport = {
      ticket_id: "COORDS-001",
      type: "ถนน",
      state: "new",
      coords: ["100.9648", "13.3611"],  // [lng, lat] as strings
      address: "ชลบุรี",
      org: "เทศบาลเมืองชลบุรี",
      timestamp: new Date().toISOString(),
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ results: [coordsReport] }), { status: 200 }),
      ),
    );

    const { fetchCityReports: fresh } = await import("./cityReporter");
    const feed = await fresh();

    const feature = feed.features.find((f) => f.id === "traffy-COORDS-001");
    expect(feature).toBeDefined();
    expect(feature!.lng).toBeCloseTo(100.9648, 3);
    expect(feature!.lat).toBeCloseTo(13.3611, 3);
    vi.restoreAllMocks();
  });

  it("skips reports where both lat/lng and coords are absent or zero", async () => {
    vi.resetModules();
    const noCoords = makeReport({ latitude: 0, longitude: 0, ticket_id: "ZERO-001" });
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ results: [noCoords] }), { status: 200 }),
      ),
    );

    const { fetchCityReports: fresh } = await import("./cityReporter");
    const feed = await fresh();
    expect(feed.features.some((f) => f.id === "traffy-ZERO-001")).toBe(false);
    vi.restoreAllMocks();
  });
});

// ─── mapCategory — all branches (isolated) ───────────────────────────────────

describe("city reporter adapter — mapCategory (isolated)", () => {
  type FetchCityReports = typeof import("./cityReporter").fetchCityReports;

  async function categoryFor(type: string | string[]): Promise<string> {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ results: [makeReport({ type })] }), { status: 200 }),
      ),
    );
    const { fetchCityReports: fresh } = await import("./cityReporter") as unknown as { fetchCityReports: FetchCityReports };
    const feed = await fresh();
    vi.restoreAllMocks();
    return feed.features[0]?.category ?? "";
  }

  it("ถนน → construction", async () => {
    expect(await categoryFor("ถนน")).toBe("construction");
  });

  it("road → construction", async () => {
    expect(await categoryFor("road damage")).toBe("construction");
  });

  it("น้ำท่วม → flooding", async () => {
    expect(await categoryFor("น้ำท่วม")).toBe("flooding");
  });

  it("flood → flooding", async () => {
    expect(await categoryFor("flood risk")).toBe("flooding");
  });

  it("ขยะ → waste", async () => {
    expect(await categoryFor("ขยะ")).toBe("waste");
  });

  it("trash → waste", async () => {
    expect(await categoryFor("trash collection")).toBe("waste");
  });

  it("ไฟ → lighting", async () => {
    // "ไฟฟ้า" contains "ไฟ" but NOT "ถนน" (which would match construction first)
    expect(await categoryFor("ไฟฟ้า")).toBe("lighting");
  });

  it("light → lighting", async () => {
    expect(await categoryFor("street light broken")).toBe("lighting");
  });

  it("ทางเท้า → sidewalk", async () => {
    expect(await categoryFor("ทางเท้า")).toBe("sidewalk");
  });

  it("ระบาย → drainage", async () => {
    expect(await categoryFor("ระบายน้ำ")).toBe("drainage");
  });

  it("drain → drainage", async () => {
    expect(await categoryFor("drain blocked")).toBe("drainage");
  });

  it("ต้นไม้ → trees", async () => {
    expect(await categoryFor("ต้นไม้ล้ม")).toBe("trees");
  });

  it("tree → trees", async () => {
    expect(await categoryFor("fallen tree")).toBe("trees");
  });

  it("จราจร → traffic-congestion", async () => {
    expect(await categoryFor("จราจร")).toBe("traffic-congestion");
  });

  it("traffic → traffic-congestion", async () => {
    expect(await categoryFor("traffic jam")).toBe("traffic-congestion");
  });

  it("unknown type → other", async () => {
    expect(await categoryFor("something unknown")).toBe("other");
  });

  it("array type — joins and matches first keyword", async () => {
    expect(await categoryFor(["ถนน", "ชำรุด"])).toBe("construction");
  });
});

// ─── mapStatus — all branches (isolated) ─────────────────────────────────────

describe("city reporter adapter — mapStatus (isolated)", () => {
  type FetchCityReports = typeof import("./cityReporter").fetchCityReports;

  async function statusFor(state: string): Promise<string> {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ results: [makeReport({ state })] }), { status: 200 }),
      ),
    );
    const { fetchCityReports: fresh } = await import("./cityReporter") as unknown as { fetchCityReports: FetchCityReports };
    const feed = await fresh();
    vi.restoreAllMocks();
    return feed.features[0]?.status ?? "";
  }

  it("no state → received", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ results: [makeReport({ state: undefined })] }), { status: 200 }),
      ),
    );
    const { fetchCityReports: fresh } = await import("./cityReporter") as unknown as { fetchCityReports: FetchCityReports };
    const feed = await fresh();
    vi.restoreAllMocks();
    expect(feed.features[0]?.status).toBe("received");
  });

  it("'new' → received (no keyword match)", async () => {
    expect(await statusFor("new")).toBe("received");
  });

  it("'เสร็จ' → resolved (Thai complete keyword)", async () => {
    expect(await statusFor("เสร็จแล้ว")).toBe("resolved");
  });

  it("'resolved' → resolved", async () => {
    expect(await statusFor("resolved")).toBe("resolved");
  });

  it("'finish' → resolved", async () => {
    expect(await statusFor("finish")).toBe("resolved");
  });

  it("'ดำเนิน' → in-progress (Thai in-progress keyword)", async () => {
    expect(await statusFor("กำลังดำเนินการ")).toBe("in-progress");
  });

  it("'in-progress' → in-progress", async () => {
    expect(await statusFor("in-progress")).toBe("in-progress");
  });

  it("'active' → in-progress", async () => {
    expect(await statusFor("active")).toBe("in-progress");
  });

  it("'assigned' → assigned", async () => {
    expect(await statusFor("assigned")).toBe("assigned");
  });
});

// ─── inferSeverity — all branches (isolated) ─────────────────────────────────

describe("city reporter adapter — inferSeverity (isolated)", () => {
  type FetchCityReports = typeof import("./cityReporter").fetchCityReports;

  async function severityFor(type: string, description: string): Promise<string> {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ results: [makeReport({ type, description })] }), { status: 200 }),
      ),
    );
    const { fetchCityReports: fresh } = await import("./cityReporter") as unknown as { fetchCityReports: FetchCityReports };
    const feed = await fresh();
    vi.restoreAllMocks();
    return feed.features[0]?.severity ?? "";
  }

  it("flooding category → high severity", async () => {
    expect(await severityFor("น้ำท่วม", "flooding area")).toBe("high");
  });

  it("'urgent' in description → high", async () => {
    expect(await severityFor("ถนน", "urgent repair needed")).toBe("high");
  });

  it("'ด่วน' in description → high", async () => {
    expect(await severityFor("ถนน", "ซ่อมด่วน")).toBe("high");
  });

  it("traffic-congestion category → medium", async () => {
    expect(await severityFor("traffic jam", "heavy traffic")).toBe("medium");
  });

  it("drainage category → medium", async () => {
    expect(await severityFor("drain blocked", "clogged drain")).toBe("medium");
  });

  it("construction category without urgency → low", async () => {
    expect(await severityFor("ถนน", "Road pothole reported")).toBe("low");
  });

  it("other category → low", async () => {
    expect(await severityFor("something else", "minor issue")).toBe("low");
  });
});
