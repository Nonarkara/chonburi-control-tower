import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchGistdaPoi, fetchGistdaSolar, fetchGistdaLandUse } from "./gistda";
import type { GistdaSolarBuilding, GistdaLandUse } from "./gistda";

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
    // fetchJsonOrThrow will parse this, and `data?.features` will be undefined.
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

// ─── fetchGistdaSolar — happy-path (isolated) ─────────────────────────────────

describe("gistda adapter — fetchGistdaSolar happy path (isolated)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses solar building features to GistdaSolarBuilding shape", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      features: [{
        attributes: {
          OBJECTID: 42,
          BL_HEIGHT: 8.5,
          BLDG_Area: 200,
          sun_irr: 155.3,
          rooftype_th: "หลังคาแบน",
          buildtype_th: "พาณิชย์",
          smonth_th: "มกราคม",
          smonth_num: 1,
          lat: 13.361,
          long: 100.984,
        },
        geometry: { x: 100.984, y: 13.361 },
      }],
    }), { status: 200 })));

    const { fetchGistdaSolar: fresh } = await import("./gistda.js") as unknown as { fetchGistdaSolar: typeof fetchGistdaSolar };
    const feed = await fresh(1);

    expect(feed.meta.fallbackTier).toBe("live");
    expect(feed.features).toHaveLength(1);
    const b = feed.features[0] as GistdaSolarBuilding;
    expect(b.id).toBe(42);
    expect(b.height).toBeCloseTo(8.5);
    expect(b.area).toBe(200);
    expect(b.solarIrr).toBeCloseTo(155.3);
    expect(b.roofType).toBe("หลังคาแบน");
    expect(b.monthNum).toBe(1);
    expect(b.lat).toBeCloseTo(13.361);
    expect(b.lng).toBeCloseTo(100.984);
  });

  it("filters out buildings with zero solarIrr or zero coordinates", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      features: [
        {
          // Valid building
          attributes: { OBJECTID: 1, BL_HEIGHT: 5, BLDG_Area: 100, sun_irr: 120, rooftype_th: "", buildtype_th: "", smonth_th: "", smonth_num: 6, lat: 13.36, long: 100.98 },
          geometry: { x: 100.98, y: 13.36 },
        },
        {
          // Zero solarIrr — should be filtered
          attributes: { OBJECTID: 2, BL_HEIGHT: 5, BLDG_Area: 100, sun_irr: 0, rooftype_th: "", buildtype_th: "", smonth_th: "", smonth_num: 6, lat: 13.36, long: 100.98 },
          geometry: { x: 100.98, y: 13.36 },
        },
      ],
    }), { status: 200 })));

    const { fetchGistdaSolar: fresh } = await import("./gistda.js") as unknown as { fetchGistdaSolar: typeof fetchGistdaSolar };
    const feed = await fresh(6);
    expect(feed.features).toHaveLength(1);
  });
});

// ─── fetchGistdaLandUse — happy-path (isolated) ───────────────────────────────

describe("gistda adapter — fetchGistdaLandUse happy path (isolated)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses ArcGIS land-use features to GistdaLandUse shape", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      features: [{
        attributes: {
          OBJECTID: 7,
          LU_CODE: "Y302",
          LU_NAME: "ที่อยู่อาศัยหนาแน่นน้อย",
          LU_NAME_EN: "Low Density Residential",
          Shape_Area: 12500.5,
        },
        geometry: { x: 100.985, y: 13.362 },
      }],
    }), { status: 200 })));

    const { fetchGistdaLandUse: fresh } = await import("./gistda.js") as unknown as { fetchGistdaLandUse: typeof fetchGistdaLandUse };
    const feed = await fresh();

    expect(feed.meta.fallbackTier).toBe("live");
    expect(feed.features).toHaveLength(1);
    const lu = feed.features[0] as GistdaLandUse;
    expect(lu.id).toBe(7);
    expect(lu.code).toBe("Y302");
    expect(lu.name).toBe("ที่อยู่อาศัยหนาแน่นน้อย");
    expect(lu.nameEn).toBe("Low Density Residential");
    expect(lu.area).toBeCloseTo(12500.5);
    expect(lu.lat).toBeCloseTo(13.362);
    expect(lu.lng).toBeCloseTo(100.985);
  });

  it("filters out land-use records with empty name", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      features: [
        { attributes: { OBJECTID: 1, LU_CODE: "Y101", LU_NAME: "ที่พักอาศัย", LU_NAME_EN: "Residential", Shape_Area: 5000 }, geometry: { x: 100.98, y: 13.36 } },
        { attributes: { OBJECTID: 2, LU_CODE: "", LU_NAME: "", LU_NAME_EN: "", Shape_Area: 0 }, geometry: { x: 100.97, y: 13.35 } },
      ],
    }), { status: 200 })));

    const { fetchGistdaLandUse: fresh } = await import("./gistda.js") as unknown as { fetchGistdaLandUse: typeof fetchGistdaLandUse };
    const feed = await fresh();
    expect(feed.features).toHaveLength(1);
    expect(feed.features[0].name).toBe("ที่พักอาศัย");
  });
});
