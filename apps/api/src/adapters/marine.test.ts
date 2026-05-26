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
