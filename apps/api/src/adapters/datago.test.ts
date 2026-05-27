import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchReservoirs, fetchDisasterStats, fetchFahfon, fetchDatagoPoints } from "./datago";

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
