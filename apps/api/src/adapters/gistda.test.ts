import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchGistdaPoi, fetchGistdaSolar, fetchGistdaLandUse } from "./gistda";

/**
 * GISTDA adapter contract tests.
 *
 * The adapters use cachedWithStale, so we test the upstream-failure path
 * by stubbing fetch to simulate a down endpoint.
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
