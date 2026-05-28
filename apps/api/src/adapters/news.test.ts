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

  it("applies PU tag to public-health / hospital items", async () => {
    vi.resetModules();
    const xml = makeRss([
      { title: "Chonburi hospital launches vaccination drive for outbreak", link: "https://bangkokpost.com/health" },
    ]);
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("bangkokpost.com")) return Promise.resolve(new Response(xml, { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const { fetchNews: fresh } = await import("./news");
    const feed = await fresh();

    expect(feed.features.length).toBeGreaterThan(0);
    expect(feed.features[0].tags).toContain("PU");
    vi.restoreAllMocks();
  });

  it("applies multiple tags when item matches multiple patterns", async () => {
    vi.resetModules();
    // Earthquake + emergency both present
    const xml = makeRss([
      { title: "Earthquake triggers tsunami warning flood emergency Chonburi", link: "https://bangkokpost.com/quake" },
    ]);
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("bangkokpost.com")) return Promise.resolve(new Response(xml, { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const { fetchNews: fresh } = await import("./news");
    const feed = await fresh();

    expect(feed.features.length).toBeGreaterThan(0);
    // At least EM should be present (flood keyword)
    expect(feed.features[0].tags.length).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });
});

describe("news adapter — item shape invariants (isolated)", () => {
  it("every returned item has the required NewsItem fields", async () => {
    vi.resetModules();
    const xml = makeRss([
      { title: "Chonburi city council approves smart city budget", link: "https://bangkokpost.com/smart-city" },
    ]);
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("bangkokpost.com")) return Promise.resolve(new Response(xml, { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const { fetchNews: fresh } = await import("./news");
    const feed = await fresh();

    for (const item of feed.features) {
      expect(typeof item.id).toBe("string");
      expect(item.id.length).toBeGreaterThan(0);
      expect(typeof item.title).toBe("string");
      expect(item.title.length).toBeGreaterThan(0);
      expect(typeof item.sourceUrl).toBe("string");
      expect(item.sourceUrl).toMatch(/^https?:\/\//);
      expect(typeof item.publishedAt).toBe("string");
      expect(() => new Date(item.publishedAt)).not.toThrow();
      expect(typeof item.score).toBe("number");
      expect(item.score).toBeGreaterThan(0);
      expect(Array.isArray(item.tags)).toBe(true);
      expect(item.kind).toBe("news");
    }
    vi.restoreAllMocks();
  });

  it("items are sorted by score descending", async () => {
    vi.resetModules();
    const xml = makeRss([
      { title: "Generic international market news", link: "https://bangkokpost.com/market" },
      { title: "น้ำท่วม Chonburi flood emergency EEC disruption", link: "https://bangkokpost.com/flood" },
    ]);
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("bangkokpost.com")) return Promise.resolve(new Response(xml, { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const { fetchNews: fresh } = await import("./news");
    const feed = await fresh();

    const scores = feed.features.map((it) => it.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
    vi.restoreAllMocks();
  });
});

// ── Location extraction ───────────────────────────────────────────────────────

describe("news adapter — location extraction (isolated)", () => {
  it("attaches lat/lng/placeName when title contains a known place alias", async () => {
    vi.resetModules();
    // "bang saen" is an alias for Bang Saen Beach
    const xml = makeRss([
      { title: "Flooding reported at Bang Saen beach area", link: "https://bangkokpost.com/bangsaen-flood" },
    ]);
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("bangkokpost.com")) return Promise.resolve(new Response(xml, { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const { fetchNews: fresh } = await import("./news") as unknown as { fetchNews: typeof import("./news").fetchNews };
    const feed = await fresh();

    expect(feed.features.length).toBeGreaterThan(0);
    const item = feed.features[0];
    expect(item.lat).toBeCloseTo(13.29, 1);
    expect(item.lng).toBeCloseTo(100.92, 1);
    expect(item.placeName).toBe("Bang Saen Beach");
    vi.restoreAllMocks();
  });

  it("geo-boosted items score higher than non-geolocated equivalent", async () => {
    vi.resetModules();
    const xml = makeRss([
      { title: "Laem Chabang port expansion news",  link: "https://bangkokpost.com/port" },
      { title: "Generic municipal update elsewhere", link: "https://bangkokpost.com/generic" },
    ]);
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("bangkokpost.com")) return Promise.resolve(new Response(xml, { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const { fetchNews: fresh } = await import("./news") as unknown as { fetchNews: typeof import("./news").fetchNews };
    const feed = await fresh();

    const port = feed.features.find((it) => it.placeName === "Laem Chabang Port");
    const generic = feed.features.find((it) => it.placeName === null);
    expect(port).toBeDefined();
    // Port item is geo-boosted (+10 score)
    if (generic) expect(port!.score).toBeGreaterThan(generic.score);
    vi.restoreAllMocks();
  });

  it("returns null lat/lng when no known alias appears in text", async () => {
    vi.resetModules();
    const xml = makeRss([
      { title: "General news from distant region about rainfall", link: "https://bangkokpost.com/distant" },
    ]);
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("bangkokpost.com")) return Promise.resolve(new Response(xml, { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const { fetchNews: fresh } = await import("./news") as unknown as { fetchNews: typeof import("./news").fetchNews };
    const feed = await fresh();

    expect(feed.features.length).toBeGreaterThan(0);
    const item = feed.features[0];
    expect(item.lat).toBeNull();
    expect(item.lng).toBeNull();
    expect(item.placeName).toBeNull();
    vi.restoreAllMocks();
  });
});

// ── Action tags — remaining 6 tags (FU, HO, FE, IN, BZ, PO) ─────────────────

describe("news adapter — remaining action tags (isolated)", () => {
  async function tagsFor(title: string): Promise<string[]> {
    vi.resetModules();
    const xml = makeRss([{ title, link: "https://bangkokpost.com/item" }]);
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("bangkokpost.com")) return Promise.resolve(new Response(xml, { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const { fetchNews: fresh } = await import("./news") as unknown as { fetchNews: typeof import("./news").fetchNews };
    const feed = await fresh();
    vi.restoreAllMocks();
    return feed.features[0]?.tags ?? [];
  }

  it("FU tag — funeral/cremation keywords", async () => {
    expect(await tagsFor("Funeral ceremony held for Chonburi dignitary")).toContain("FU");
  });

  it("FU tag — Thai keyword งานศพ", async () => {
    expect(await tagsFor("งานศพ ผู้นำชุมชนชลบุรี จัดพิธีไว้อาลัย")).toContain("FU");
  });

  it("HO tag — award/recognition", async () => {
    expect(await tagsFor("Chonburi school wins national award prize recognition")).toContain("HO");
  });

  it("HO tag — Thai keyword รางวัล", async () => {
    expect(await tagsFor("ชลบุรีได้รับรางวัลเมืองน่าอยู่ระดับประเทศ")).toContain("HO");
  });

  it("FE tag — festival/opening ceremony", async () => {
    expect(await tagsFor("Grand opening ceremony for Chonburi cultural festival 2026")).toContain("FE");
  });

  it("FE tag — Thai keyword สงกรานต์", async () => {
    expect(await tagsFor("เตรียมจัดงานสงกรานต์ชลบุรีประจำปี 2569")).toContain("FE");
  });

  it("IN tag — road damage / pothole infrastructure", async () => {
    expect(await tagsFor("Road damage and potholes on Sukhumvit Chonburi need repair")).toContain("IN");
  });

  it("IN tag — Thai keyword ถนนชำรุด", async () => {
    expect(await tagsFor("ถนนชำรุดในเขตเทศบาลเมืองชลบุรีรอการซ่อมแซม")).toContain("IN");
  });

  it("BZ tag — EEC investment / MOU signing", async () => {
    expect(await tagsFor("EEC investment signing ceremony for new Laem Chabang factory")).toContain("BZ");
  });

  it("BZ tag — Thai keyword อีอีซี", async () => {
    expect(await tagsFor("อีอีซีลงนาม MOU กับนักลงทุนต่างชาติที่ชลบุรี")).toContain("BZ");
  });

  it("PO tag — protest/arrested crackdown", async () => {
    expect(await tagsFor("Protesters arrested outside Chonburi city hall crackdown")).toContain("PO");
  });

  it("PO tag — Thai keyword ประท้วง", async () => {
    expect(await tagsFor("ประชาชนประท้วงหน้าศาลากลางชลบุรี ตำรวจสลายการชุมนุม")).toContain("PO");
  });
});

// ── stripHtml / pick — entity decoding ───────────────────────────────────────

describe("news adapter — HTML entity decoding (isolated)", () => {
  it("decodes &amp; &quot; &lt; &gt; in non-CDATA title fields", async () => {
    vi.resetModules();
    const rawXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Test</title>
<item>
  <title>Chonburi &amp; EEC: &quot;Future Ready&quot; plan &lt;2030&gt;</title>
  <link>https://bangkokpost.com/entities</link>
  <pubDate>${new Date().toUTCString()}</pubDate>
</item>
</channel></rss>`;
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("bangkokpost.com")) return Promise.resolve(new Response(rawXml, { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const { fetchNews: fresh } = await import("./news") as unknown as { fetchNews: typeof import("./news").fetchNews };
    const feed = await fresh();

    expect(feed.features.length).toBeGreaterThan(0);
    const item = feed.features[0];
    expect(item.title).toContain("Chonburi & EEC");
    expect(item.title).toContain('"Future Ready"');
    expect(item.title).toContain("<2030>");
    vi.restoreAllMocks();
  });

  it("decodes numeric decimal char ref &#36; → $", async () => {
    vi.resetModules();
    const rawXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Test</title>
<item>
  <title>&#36;500m EEC fund announced Chonburi</title>
  <link>https://bangkokpost.com/numref</link>
  <pubDate>${new Date().toUTCString()}</pubDate>
</item>
</channel></rss>`;
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("bangkokpost.com")) return Promise.resolve(new Response(rawXml, { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const { fetchNews: fresh } = await import("./news") as unknown as { fetchNews: typeof import("./news").fetchNews };
    const feed = await fresh();

    expect(feed.features[0]?.title).toContain("$500m");
    vi.restoreAllMocks();
  });

  it("decodes hex char ref &#x24; → $", async () => {
    vi.resetModules();
    const rawXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Test</title>
<item>
  <title>Chonburi EEC &#x24;1B investment boom</title>
  <link>https://bangkokpost.com/hexref</link>
  <pubDate>${new Date().toUTCString()}</pubDate>
</item>
</channel></rss>`;
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("bangkokpost.com")) return Promise.resolve(new Response(rawXml, { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const { fetchNews: fresh } = await import("./news") as unknown as { fetchNews: typeof import("./news").fetchNews };
    const feed = await fresh();

    // &#x24; = $ (U+0024 DOLLAR SIGN)
    expect(feed.features[0]?.title).toContain("$1B");
    vi.restoreAllMocks();
  });

  it("strips HTML tags from CDATA description leaving plain text", async () => {
    vi.resetModules();
    const rawXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Test</title>
<item>
  <title><![CDATA[Chonburi smart city update]]></title>
  <link>https://bangkokpost.com/htmltags</link>
  <description><![CDATA[<p>Municipal <strong>budget</strong> approved for <a href="x">EEC</a> projects.</p>]]></description>
  <pubDate>${new Date().toUTCString()}</pubDate>
</item>
</channel></rss>`;
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("bangkokpost.com")) return Promise.resolve(new Response(rawXml, { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const { fetchNews: fresh } = await import("./news") as unknown as { fetchNews: typeof import("./news").fetchNews };
    const feed = await fresh();

    const summary = feed.features[0]?.summary ?? "";
    expect(summary).toContain("Municipal");
    expect(summary).toContain("budget");
    expect(summary).not.toContain("<p>");
    expect(summary).not.toContain("<strong>");
    vi.restoreAllMocks();
  });
});

// ── Items missing title or link are silently skipped ─────────────────────────

describe("news adapter — malformed items skipped (isolated)", () => {
  it("skips items with empty title", async () => {
    vi.resetModules();
    const rawXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Test</title>
<item>
  <title><![CDATA[Chonburi city news valid]]></title>
  <link>https://bangkokpost.com/valid</link>
  <pubDate>${new Date().toUTCString()}</pubDate>
</item>
<item>
  <title></title>
  <link>https://bangkokpost.com/notitle</link>
  <pubDate>${new Date().toUTCString()}</pubDate>
</item>
</channel></rss>`;
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("bangkokpost.com")) return Promise.resolve(new Response(rawXml, { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const { fetchNews: fresh } = await import("./news") as unknown as { fetchNews: typeof import("./news").fetchNews };
    const feed = await fresh();

    expect(feed.features.every((it) => it.title.length > 0)).toBe(true);
    vi.restoreAllMocks();
  });

  it("skips items with no link element", async () => {
    vi.resetModules();
    const rawXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Test</title>
<item>
  <title><![CDATA[Chonburi news with link]]></title>
  <link>https://bangkokpost.com/withlink</link>
  <pubDate>${new Date().toUTCString()}</pubDate>
</item>
<item>
  <title><![CDATA[Chonburi news without link]]></title>
  <pubDate>${new Date().toUTCString()}</pubDate>
</item>
</channel></rss>`;
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("bangkokpost.com")) return Promise.resolve(new Response(rawXml, { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const { fetchNews: fresh } = await import("./news") as unknown as { fetchNews: typeof import("./news").fetchNews };
    const feed = await fresh();

    expect(feed.features.some((it) => it.title.includes("with link"))).toBe(true);
    expect(feed.features.some((it) => it.title.includes("without link"))).toBe(false);
    vi.restoreAllMocks();
  });
});

// ── parseDate edge cases (isolated) ──────────────────────────────────────────

describe("news adapter — parseDate fallback (isolated)", () => {
  it("uses current time when pubDate field is absent", async () => {
    vi.resetModules();
    const before = Date.now();
    const rawXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Test</title>
<item>
  <title><![CDATA[Chonburi no-date news item]]></title>
  <link>https://bangkokpost.com/nodate</link>
</item>
</channel></rss>`;
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("bangkokpost.com")) return Promise.resolve(new Response(rawXml, { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const { fetchNews: fresh } = await import("./news") as unknown as { fetchNews: typeof import("./news").fetchNews };
    const feed = await fresh();
    const after = Date.now();

    expect(feed.features.length).toBeGreaterThan(0);
    const publishedMs = new Date(feed.features[0].publishedAt).getTime();
    expect(publishedMs).toBeGreaterThanOrEqual(before - 1000);
    expect(publishedMs).toBeLessThanOrEqual(after + 1000);
    vi.restoreAllMocks();
  });

  it("uses current time when pubDate is not a valid date string", async () => {
    vi.resetModules();
    const before = Date.now();
    const rawXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Test</title>
<item>
  <title><![CDATA[Chonburi invalid-date news]]></title>
  <link>https://bangkokpost.com/baddate</link>
  <pubDate>not-a-date-at-all</pubDate>
</item>
</channel></rss>`;
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("bangkokpost.com")) return Promise.resolve(new Response(rawXml, { status: 200 }));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const { fetchNews: fresh } = await import("./news") as unknown as { fetchNews: typeof import("./news").fetchNews };
    const feed = await fresh();
    const after = Date.now();

    expect(feed.features.length).toBeGreaterThan(0);
    const publishedMs = new Date(feed.features[0].publishedAt).getTime();
    expect(publishedMs).toBeGreaterThanOrEqual(before - 1000);
    expect(publishedMs).toBeLessThanOrEqual(after + 1000);
    vi.restoreAllMocks();
  });
});
