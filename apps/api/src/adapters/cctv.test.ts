import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchCctv } from "./cctv";

/**
 * CCTV (Longdo camera feed) adapter contract tests.
 *
 * Tests verify URL, NormalizedFeed shape, bbox filtering, and
 * scenario-tier fallback when no cameras are returned.
 *
 * URL-capture test is FIRST — subsequent tests use the cached result.
 */

// Inside FEED_BBOX (lng 100.70–101.50, lat 12.50–13.55)
const CHONBURI_LNG = 100.9648;
const CHONBURI_LAT = 13.3611;
// Outside FEED_BBOX — north of bbox
const OUTSIDE_LNG = 99.0;
const OUTSIDE_LAT = 16.0;

function makeCamera(overrides: Record<string, unknown> = {}) {
  return {
    camid: "CAM-001",
    title: "หน้าศาลากลาง",
    latitude: String(CHONBURI_LAT),
    longitude: String(CHONBURI_LNG),
    imgurl: "https://camera.longdo.com/snapshot/CAM-001.jpg",
    hls_url: "https://camera.longdo.com/hls/CAM-001.m3u8",
    organization: "ชลบุรี",
    lastupdate: "2026-01-01T08:00:00Z",
    ...overrides,
  };
}

describe("CCTV adapter (Longdo)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requests the Longdo camera feed endpoint", async () => {
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      capturedUrl = String(url);
      return Promise.resolve(
        new Response(
          JSON.stringify({ cameras: [makeCamera()] }),
          { status: 200 },
        ),
      );
    });

    await fetchCctv();

    expect(capturedUrl).toContain("longdo.com");
    expect(capturedUrl).toContain("camera");
  });

  it("returns NormalizedFeed with live tier and correct shape", async () => {
    // Uses cached result from first test
    const feed = await fetchCctv();

    expect(feed.meta.source).toBe("longdo-cameras");
    expect(feed.meta.fallbackTier).toBe("live");
    expect(feed.features.length).toBeGreaterThan(0);

    const cam = feed.features[0];
    expect(cam.id).toMatch(/^longdo-/);
    expect(cam.vendor).toBe("longdo");
    expect(cam).toHaveProperty("lat");
    expect(cam).toHaveProperty("lng");
    expect(cam).toHaveProperty("name");
  });
});

describe("CCTV adapter — bbox filtering (isolated)", () => {
  it("excludes cameras outside the Eastern Seaboard bbox", async () => {
    vi.resetModules();
    const inside = makeCamera({ camid: "IN-001", latitude: String(CHONBURI_LAT), longitude: String(CHONBURI_LNG) });
    const outside = makeCamera({ camid: "OUT-001", latitude: String(OUTSIDE_LAT), longitude: String(OUTSIDE_LNG) });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ cameras: [inside, outside] }), { status: 200 }),
    );

    const { fetchCctv: fresh } = await import("./cctv");
    const feed = await fresh();

    expect(feed.features.some((c) => c.id === "longdo-IN-001")).toBe(true);
    expect(feed.features.some((c) => c.id === "longdo-OUT-001")).toBe(false);
    vi.restoreAllMocks();
  });

  it("handles flat array response shape (no cameras wrapper)", async () => {
    vi.resetModules();
    const cam = makeCamera({ camid: "FLAT-001" });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([cam]), { status: 200 }),
    );

    const { fetchCctv: fresh } = await import("./cctv");
    const feed = await fresh();

    expect(feed.features.some((c) => c.id === "longdo-FLAT-001")).toBe(true);
    vi.restoreAllMocks();
  });
});

describe("CCTV adapter — scenario fallback (isolated)", () => {
  it("returns scenario tier when upstream returns no cameras", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ cameras: [] }), { status: 200 }),
    );

    const { fetchCctv: fresh } = await import("./cctv");
    const feed = await fresh();

    expect(feed.meta.fallbackTier).toBe("scenario");
    expect(feed.features).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it("returns scenario tier when API fails", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 503 }),
    );

    const { fetchCctv: fresh } = await import("./cctv");
    const feed = await fresh();

    expect(feed.meta.fallbackTier).toBe("scenario");
    expect(feed.features).toHaveLength(0);
    vi.restoreAllMocks();
  });
});

describe("CCTV adapter — camera field mapping (isolated)", () => {
  it("maps Longdo fields to CctvCamera shape correctly", async () => {
    vi.resetModules();
    const cam = makeCamera({ camid: "MAP-001", title: "  Test Camera  " });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ cameras: [cam] }), { status: 200 }),
    );

    const { fetchCctv: fresh } = await import("./cctv");
    const feed = await fresh();

    const c = feed.features.find((f) => f.id === "longdo-MAP-001");
    expect(c).toBeDefined();
    expect(c!.name).toBe("Test Camera"); // trimmed
    expect(c!.imageUrl).toContain("CAM-001.jpg");
    expect(c!.hlsUrl).toContain("CAM-001.m3u8");
    expect(c!.organization).toBe("ชลบุรี");
    expect(c!.lat).toBeCloseTo(CHONBURI_LAT, 3);
    expect(c!.lng).toBeCloseTo(CHONBURI_LNG, 3);
    vi.restoreAllMocks();
  });

  it("skips cameras with invalid coordinates", async () => {
    vi.resetModules();
    const badCam = makeCamera({ camid: "BAD-001", latitude: "not-a-number", longitude: "also-bad" });
    const goodCam = makeCamera({ camid: "GOOD-001" });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ cameras: [badCam, goodCam] }), { status: 200 }),
    );

    const { fetchCctv: fresh } = await import("./cctv");
    const feed = await fresh();

    expect(feed.features.some((c) => c.id === "longdo-BAD-001")).toBe(false);
    expect(feed.features.some((c) => c.id === "longdo-GOOD-001")).toBe(true);
    vi.restoreAllMocks();
  });
});
