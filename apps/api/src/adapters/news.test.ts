import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchNews } from "./news";

/**
 * News adapter contract tests.
 *
 * cachedWithStale stores results in a module-level Map.
 * Rule: the FIRST test in this file (which owns the cache miss) runs against
 * the real fetchNews import and captures URL patterns. Subsequent isolated
 * tests use `vi.resetModules()` + dynamic `import()` to get a fresh module
 * instance with an empty cache.
 */

function makeRss(items: Array<{ title: string; link: string; description?: string; daysAgo?: number }>): string {
  const parts = items.map(({ title, link, description = "", daysAgo = 0 }) => {
    const pubDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toUTCString();
    return `<item>
  <title><![CDATA[${title}]]></title>
  <link>${link}</link>
  <description><![CDATA[${description}]]></description>
  <pubDate>${pubDate}</pubDate>
</item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Test Feed</title>
${parts.join("\n")}
</channel></rss>`;
}

describe("news adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requests all configured RSS feed domains on first call", async () => {
    // FIRST test — cache miss → actual fetch calls go through.
    const capturedUrls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      capturedUrls.push(String(url));
      const xml = makeRss([{ title: "Chonburi city news", link: "https://example.com/1" }]);
      return Promise.resolve(new Response(xml, { status: 200 }));
    });

    await fetchNews();

    expect(capturedUrls.some((u) => u.includes("news.google.com"))).toBe(true);
    expect(capturedUrls.some((u) => u.includes("bangkokpost.com"))).toBe(true);
    expect(capturedUrls.some((u) => u.includes("thaipbs.or.th"))).toBe(true);
    // All configured feeds must be requested (6 as of writing)
    expect(capturedUrls.length).toBeGreaterThanOrEqual(6);
  });

  it("returns NormalizedFeed shape with live tier when items are parsed", async () => {
    // SECOND test — works with cached result from test 1.
    const feed = await fetchNews();

    expect(feed.meta.source).toContain("google-news");
    expect(feed.meta.fallbackTier).toBe("live");
    expect(feed.features.length).toBeGreaterThan(0);

    const item = feed.features[0];
    expect(item).toHaveProperty("id");
    expect(item).toHaveProperty("title");
    expect(item).toHaveProperty("kind", "news");
    expect(item.score).toBeGreaterThan(0);
    // publishedAt must be an ISO string
    expect(() => new Date(item.publishedAt)).not.toThrow();
  });
});

// ── Isolated tests — each gets a fresh module instance via vi.resetModules() ──

describe("news adapter — scenario fallback (isolated)", () => {
  it("returns scenario tier when all feeds return 503", async () => {
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 503 })),
    );

    const { fetchNews: fresh } = await import("./news");
    const feed = await fresh();

    expect(feed.meta.fallbackTier).toBe("scenario");
    expect(feed.features).toHaveLength(0);
    vi.restoreAllMocks();
  });
});

describe("news adapter — scoring (isolated)", () => {
  it("ranks Chonburi / EEC items above generic items", async () => {
    vi.resetModules();
    const xml = makeRss([
      { title: "Chonburi EEC investment announcement", link: "https://bangkokpost.com/eec" },
      { title: "Weather forecast for Bangkok city",    link: "https://bangkokpost.com/bkk" },
    ]);
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("bangkokpost.com")) {
        return Promise.resolve(new Response(xml, { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const { fetchNews: fresh } = await import("./news");
    const feed = await fresh();

    expect(feed.features.length).toBe(2);
    const [first] = feed.features;
    expect(first.score).toBeGreaterThanOrEqual(feed.features[1].score);
    expect(first.title).toMatch(/chonburi|eec/i);
    vi.restoreAllMocks();
  });
});

describe("news adapter — freshness gate (isolated)", () => {
  it("excludes items older than 7 days", async () => {
    vi.resetModules();
    const xml = makeRss([
      { title: "Fresh Chonburi update today",          link: "https://bangkokpost.com/fresh",  daysAgo: 1 },
      { title: "Stale Chonburi story from 10 days ago", link: "https://bangkokpost.com/stale", daysAgo: 10 },
    ]);
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("bangkokpost.com")) {
        return Promise.resolve(new Response(xml, { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const { fetchNews: fresh } = await import("./news");
    const feed = await fresh();

    // Stale item must be absent
    expect(feed.features.every((it) => !it.title.includes("10 days ago"))).toBe(true);
    // Fresh item must be present
    expect(feed.features.some((it) => it.title.includes("today"))).toBe(true);
    vi.restoreAllMocks();
  });
});

describe("news adapter — deduplication (isolated)", () => {
  it("returns no duplicate titles even when multiple feeds carry the same story", async () => {
    vi.resetModules();
    // Same title in two separate <item> blocks within one feed (simulates cross-feed dup)
    const xml = makeRss([
      { title: "Chonburi flood warning", link: "https://example.com/a" },
      { title: "Chonburi flood warning", link: "https://example.com/b" },
    ]);
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(xml, { status: 200 })),
    );

    const { fetchNews: fresh } = await import("./news");
    const feed = await fresh();

    const titles = feed.features.map((it) => it.title.toLowerCase().trim());
    expect(new Set(titles).size).toBe(titles.length);
    vi.restoreAllMocks();
  });
});

describe("news adapter — action tags (isolated)", () => {
  it("applies EM tag to flood-related items and boosts their score", async () => {
    vi.resetModules();
    // Thai flood keyword (น้ำท่วม) + English flood — both should trigger EM
    const xml = makeRss([
      { title: "น้ำท่วมหนัก Chonburi municipal area flood emergency", link: "https://thaipbs.or.th/flood1" },
    ]);
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("thaipbs.or.th")) {
        return Promise.resolve(new Response(xml, { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const { fetchNews: fresh } = await import("./news");
    const feed = await fresh();

    expect(feed.features.length).toBeGreaterThan(0);
    const floodItem = feed.features[0];
    expect(floodItem.tags).toContain("EM");
    // EM boost (+15) should push score above the baseline trust score (~42 for thaipbs 0.82 × 50)
    expect(floodItem.score).toBeGreaterThan(55);
    vi.restoreAllMocks();
  });
});
