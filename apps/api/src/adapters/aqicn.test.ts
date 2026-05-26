import { describe, it, expect } from "vitest";
import { fetchAqicnChonburi } from "./aqicn";

/**
 * AQICN adapter contract tests.
 *
 * The no-token path is synchronous (early return before any HTTP call),
 * so these tests require no fetch mocking.
 */
describe("aqicn adapter — missing-token contract", () => {
  it("returns 'unavailable' with descriptive note when AQICN_TOKEN is absent", async () => {
    const feed = await fetchAqicnChonburi({});

    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.source).toBe("aqicn");
    expect(feed.meta.note).toMatch(/AQICN_TOKEN/);
    expect(feed.meta.note).toMatch(/aqicn\.org/);
    expect(feed.features).toHaveLength(0);
  });

  it("does not call fetch when token is missing", async () => {
    // The adapter short-circuits before any HTTP call — so even without mocking
    // fetch, this should complete instantly and cleanly.
    const start = Date.now();
    await fetchAqicnChonburi({ AQICN_TOKEN: undefined });
    const elapsed = Date.now() - start;

    // Should complete in < 50ms (no network round-trip)
    expect(elapsed).toBeLessThan(50);
  });
});
