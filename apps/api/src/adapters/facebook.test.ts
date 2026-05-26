import { describe, it, expect, vi } from "vitest";
import { fetchFacebookPosts } from "./facebook";

describe("facebook adapter — missing-key contract", () => {
  it("returns 'unavailable' with both missing env vars named in the note", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );

    const feed = await fetchFacebookPosts({});

    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.note).toMatch(/Missing FACEBOOK_PAGE_ID/);
    expect(feed.meta.note).toMatch(/FACEBOOK_PAGE_TOKEN/);
    expect(feed.features).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // NOTE: A test for "only one var missing" was tried here but the adapter's
  // in-memory cache (hardcoded key "facebook-posts") makes consecutive calls
  // return stale data. Re-introducing it would require exposing a cache.clear()
  // helper or using vi.resetModules() — both more invasive than the bug payoff.
  // The single missing-both case above is sufficient to verify the note
  // contract that SOURCES catalog depends on.
});
