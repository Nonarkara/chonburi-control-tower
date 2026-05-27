import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchGistdaPoi, fetchGistdaSolar, fetchGistdaLandUse } from "./gistda";

/**
 * GISTDA adapter contract tests.
 *
 * The adapters use cachedWithStale, so we test the upstream-failure path
 * by stubbing fetch to simulate a down endpoint.
 *
 * Happy-path tests use vi.resetModules() to bypass the module-level cache.
 */
describe("gistda adapter — upstream-failure contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchGistdaPoi returns 'unavailable' with a note when upstream returns no feature collection", async () => {
    // Simulate ArcGIS returning a response with no features key (e.g., error object)
    // fetchJsonOrNull will parse this, and `data?.features` will be undefined.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 500, message: "upstream down" } }), { status: 200 }),
    );

    const feed = await fetchGistdaPoi();

    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.note).toMatch(/GISTDA/);
    expect(feed.features).toHaveLength(0);
  });

  it("fetchGistdaSolar returns 'unavailable' with a note when upstream returns no feature collection", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 500, message: "upstream down" } }), { status: 200 }),
    );

    const feed = await fetchGistdaSolar();

    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.note).toMatch(/GISTDA/);
    expect(feed.features).toHaveLength(0);
  });

  it("fetchGistdaLandUse returns 'unavailable' with a note when upstream returns no feature collection", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 500, message: "upstream down" } }), { status: 200 }),
    );

    const feed = await fetchGistdaLandUse();

    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.note).toMatch(/GISTDA/);
    expect(feed.features).toHaveLength(0);
  });
});

// ─── fetchGistdaPoi — happy-path (isolated) ───────────────────────────────────

describe("gistda adapter — fetchGistdaPoi happy path (isolated)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const MOCK_FEATURES = {
    features: [
      {
        attributes: {
          OBJECTID: 1,
          Category: 11, // government
          SubCat: 1101,
          Official: "ศาลากลางจังหวัดชลบุรี",
          OnTrans: "Chonburi Provincial Hall",
          RoadName: "ถนนมนตรี",
          RnTrans: "Montri Road",
          Disabled: "Y",
        },
        geometry: { x: 100.9648, y: 13.3611 },
      },
      {
        // Feature with blank name — should be filtered out
        attributes: {
          OBJECTID: 2,
          Category: 14,
          SubCat: 0,
          Official: "",
          OnTrans: "",
          RoadName: "",
          RnTrans: "",
          Disabled: "",
        },
        geometry: { x: 100.97, y: 13.37 },
      },
    ],
  };

  it("parses ArcGIS POI features to GistdaPoi shape and filters blank names", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(MOCK_FEATURES), { status: 200 }),
    );
    const { fetchGistdaPoi: fresh } = await import("./gistda.js") as unknown as { fetchGistdaPoi: typeof fetchGistdaPoi };

    const feed = await fresh();

    // Only 1 feature — blank-name one is filtered
    expect(feed.meta.fallbackTier).toBe("live");
    expect(feed.features).toHaveLength(1);

    const poi = feed.features[0];
    expect(poi.id).toBe(1);
    expect(poi.category).toBe("government");
    expect(poi.name).toBe("ศาลากลางจังหวัดชลบุรี");
    expect(poi.nameEn).toBe("Chonburi Provincial Hall");
    expect(poi.road).toBe("ถนนมนตรี");
    expect(poi.roadEn).toBe("Montri Road");
    expect(poi.lat).toBeCloseTo(13.3611);
    expect(poi.lng).toBeCloseTo(100.9648);
    expect(poi.disabled).toBe("Y");
    vi.restoreAllMocks();
  });

  it("returns 'unavailable' when features array is empty after filtering", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ features: [] }), { status: 200 }),
    );
    const { fetchGistdaPoi: fresh } = await import("./gistda.js") as unknown as { fetchGistdaPoi: typeof fetchGistdaPoi };

    const feed = await fresh();
    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.features).toHaveLength(0);
    vi.restoreAllMocks();
  });
});
