import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchItic } from "./itic";

/**
 * iTIC (Longdo traffic events) adapter contract tests.
 *
 * Tests verify URL, NormalizedFeed shape, type/severity classification,
 * bbox filtering, and fallback tier.
 * URL-capture test is FIRST — subsequent tests use the cached result.
 */

// Inside FEED_BBOX (lng 100.70–101.50, lat 12.50–13.55)
const CHONBURI_LNG = 100.9648;
const CHONBURI_LAT = 13.3611;
// Outside FEED_BBOX
const OUTSIDE_LNG = 99.0;
const OUTSIDE_LAT = 15.0;

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    eid: "EVT-001",
    title: "Traffic congestion",
    title_en: "Traffic congestion on Sukhumvit",
    description_en: "Heavy traffic near Bang Saen junction",
    latitude: String(CHONBURI_LAT),
    longitude: String(CHONBURI_LNG),
    type: "5",        // 5 = traffic (not 1/2/3)
    severity: "1",    // 1 = low severity
    start: "2026-01-01 08:00:00",
    stop: "2026-01-01 10:00:00",
    ...overrides,
  };
}

describe("iTIC adapter (Longdo)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requests the Longdo event feed endpoint", async () => {
    // FIRST test — cache miss.
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      capturedUrl = String(url);
      const payload = { events: [makeEvent()] };
      return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
    });

    await fetchItic();

    expect(capturedUrl).toContain("longdo.com");
    expect(capturedUrl).toContain("event");
  });

  it("returns NormalizedFeed with live tier when events are in bbox", async () => {
    // SECOND test — cached result from test 1.
    const feed = await fetchItic();

    expect(feed.meta.source).toBe("itic-longdo");
    expect(feed.meta.fallbackTier).toBe("live");
    expect(feed.features.length).toBeGreaterThan(0);

    const item = feed.features[0];
    expect(item.id).toMatch(/^itic-/);
    expect(item.reporterPlatform).toBe("itic");
    expect(item.status).toBe("in-progress");
    expect(item).toHaveProperty("lat");
    expect(item).toHaveProperty("lng");
    expect(item).toHaveProperty("category");
    expect(item).toHaveProperty("severity");
  });
});

describe("iTIC adapter — scenario fallback (isolated)", () => {
  it("returns scenario tier and empty features when endpoint returns null", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 500 })),
    );

    const { fetchItic: fresh } = await import("./itic");
    const feed = await fresh();

    expect(feed.meta.fallbackTier).toBe("scenario");
    expect(feed.features).toHaveLength(0);
    vi.restoreAllMocks();
  });
});

describe("iTIC adapter — type classification (isolated)", () => {
  it("classifies type=1 as traffic-accident with at least medium severity", async () => {
    vi.resetModules();
    const evt = makeEvent({ eid: "ACC-001", type: "1", severity: "1" });

    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ events: [evt] }), { status: 200 })),
    );

    const { fetchItic: fresh } = await import("./itic");
    const feed = await fresh();

    const item = feed.features.find((f) => f.id === "itic-ACC-001");
    expect(item).toBeDefined();
    expect(item!.category).toBe("traffic-accident");
    // Even at severity code 1, accidents are boosted to "medium"
    expect(item!.severity).toBe("medium");
    vi.restoreAllMocks();
  });

  it("classifies type=3 as construction", async () => {
    vi.resetModules();
    const evt = makeEvent({ eid: "CON-001", type: "3", severity: "2" });

    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ events: [evt] }), { status: 200 })),
    );

    const { fetchItic: fresh } = await import("./itic");
    const feed = await fresh();

    const item = feed.features.find((f) => f.id === "itic-CON-001");
    expect(item!.category).toBe("construction");
    vi.restoreAllMocks();
  });
});

describe("iTIC adapter — bbox filtering (isolated)", () => {
  it("excludes events outside the Eastern Seaboard bbox", async () => {
    vi.resetModules();
    const inside = makeEvent({ eid: "IN-001", latitude: String(CHONBURI_LAT), longitude: String(CHONBURI_LNG) });
    const outside = makeEvent({ eid: "OUT-001", latitude: String(OUTSIDE_LAT), longitude: String(OUTSIDE_LNG) });

    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ events: [inside, outside] }), { status: 200 }),
      ),
    );

    const { fetchItic: fresh } = await import("./itic");
    const feed = await fresh();

    expect(feed.features.some((f) => f.id === "itic-IN-001")).toBe(true);
    expect(feed.features.some((f) => f.id === "itic-OUT-001")).toBe(false);
    vi.restoreAllMocks();
  });
});
