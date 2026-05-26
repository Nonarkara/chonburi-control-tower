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
});
