import { describe, it, expect, vi, beforeEach } from "vitest";
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

// ─── Happy-path response parsing (isolated via resetModules) ─────────────────

describe("facebook adapter — happy-path parsing (isolated)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const MOCK_GRAPH = {
    data: [
      {
        id: "123456789",
        message: "ขอแสดงความยินดีกับนักเรียนชลบุรีที่ได้รับทุนการศึกษา",
        created_time: "2026-05-01T09:00:00+0000",
        permalink_url: "https://facebook.com/permalink/123456789",
        full_picture: "https://example.com/photo.jpg",
        reactions: { summary: { total_count: 42 } },
        comments: { summary: { total_count: 7 } },
        shares: { count: 3 },
      },
      {
        // No message + no story — should be filtered out
        id: "999",
        message: "",
        story: "",
        created_time: "2026-05-01T08:00:00+0000",
      },
    ],
  };

  it("maps Graph API posts to FacebookPost shape and filters blank messages", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(MOCK_GRAPH), { status: 200 }),
    );
    const { fetchFacebookPosts: fresh } = await import("./facebook.js") as unknown as {
      fetchFacebookPosts: typeof fetchFacebookPosts;
    };

    const feed = await fresh({ FACEBOOK_PAGE_ID: "111222333", FACEBOOK_PAGE_TOKEN: "fake-token" });

    // Only 1 feature — blank-message one is filtered
    expect(feed.meta.fallbackTier).toBe("live");
    expect(feed.meta.source).toBe("facebook-graph");
    expect(feed.features).toHaveLength(1);

    const post = feed.features[0];
    expect(post.id).toBe("123456789");
    expect(post.message).toContain("ขอแสดงความยินดี");
    expect(post.permalink).toBe("https://facebook.com/permalink/123456789");
    expect(post.createdAt).toBe("2026-05-01T09:00:00+0000");
    expect(post.image).toBe("https://example.com/photo.jpg");
    expect(post.reactions).toBe(42);
    expect(post.comments).toBe(7);
    expect(post.shares).toBe(3);
    vi.restoreAllMocks();
  });

  it("returns 'unavailable' when Graph API returns empty data array", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    const { fetchFacebookPosts: fresh } = await import("./facebook.js") as unknown as {
      fetchFacebookPosts: typeof fetchFacebookPosts;
    };

    const feed = await fresh({ FACEBOOK_PAGE_ID: "111", FACEBOOK_PAGE_TOKEN: "tok" });
    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.note).toMatch(/no posts/i);
    expect(feed.features).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it("uses story field as fallback when message is absent", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        data: [{
          id: "777",
          story: "Chonburi Municipality shared a photo.",
          created_time: "2026-05-01T07:00:00+0000",
        }],
      }), { status: 200 }),
    );
    const { fetchFacebookPosts: fresh } = await import("./facebook.js") as unknown as {
      fetchFacebookPosts: typeof fetchFacebookPosts;
    };

    const feed = await fresh({ FACEBOOK_PAGE_ID: "111", FACEBOOK_PAGE_TOKEN: "tok" });
    expect(feed.features).toHaveLength(1);
    expect(feed.features[0].message).toContain("shared a photo");
    vi.restoreAllMocks();
  });

  it("uses singular 'env var' in note when only PAGE_ID is missing", async () => {
    vi.resetModules();
    const { fetchFacebookPosts: fresh } = await import("./facebook.js") as unknown as {
      fetchFacebookPosts: typeof fetchFacebookPosts;
    };

    const feed = await fresh({ FACEBOOK_PAGE_TOKEN: "tok" });
    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.note).toMatch(/FACEBOOK_PAGE_ID/);
    expect(feed.meta.note).not.toMatch(/\+/);    // no "+" → singular
    expect(feed.meta.note).toMatch(/env var[^s]/); // "env var " not "env vars"
    vi.restoreAllMocks();
  });

  it("uses singular 'env var' in note when only PAGE_TOKEN is missing", async () => {
    vi.resetModules();
    const { fetchFacebookPosts: fresh } = await import("./facebook.js") as unknown as {
      fetchFacebookPosts: typeof fetchFacebookPosts;
    };

    const feed = await fresh({ FACEBOOK_PAGE_ID: "111" });
    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.note).toMatch(/FACEBOOK_PAGE_TOKEN/);
    expect(feed.meta.note).not.toMatch(/\+/);
    expect(feed.meta.note).toMatch(/env var[^s]/);
    vi.restoreAllMocks();
  });

  it("falls back to unavailable when Graph API returns HTTP 500", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );
    const { fetchFacebookPosts: fresh } = await import("./facebook.js") as unknown as {
      fetchFacebookPosts: typeof fetchFacebookPosts;
    };

    const feed = await fresh({ FACEBOOK_PAGE_ID: "111", FACEBOOK_PAGE_TOKEN: "tok" });
    // fetchJsonOrNull returns null on 500 → payload is null → posts=[]
    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.features).toHaveLength(0);
    vi.restoreAllMocks();
  });
});
