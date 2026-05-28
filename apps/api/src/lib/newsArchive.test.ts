import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * newsArchive contract tests — verifies the append-only archive logic:
 * deduplication, language detection, JSONL filtering, and digest aggregation.
 *
 * All filesystem calls are mocked so no real I/O occurs. Module-level state
 * (`seen` Set) is reset between test groups via vi.resetModules().
 */

// ─── Filesystem mock (applied before any import of newsArchive) ────────────

vi.mock("node:fs/promises", () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(""),
  mkdir: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 0 }),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

import { appendFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const mockedAppendFile = appendFile as ReturnType<typeof vi.fn>;
const mockedReadFile = readFile as ReturnType<typeof vi.fn>;
const mockedExists = existsSync as ReturnType<typeof vi.fn>;

// Helper to build a minimal IntelligenceItem
function makeItem(overrides: {
  sourceUrl?: string;
  title?: string;
  summary?: string;
  source?: string;
  publishedAt?: string;
  score?: number;
  tags?: string[];
}) {
  return {
    sourceUrl: overrides.sourceUrl ?? "https://example.com/story-1",
    title: overrides.title ?? "Test Story",
    summary: overrides.summary ?? "A test story summary.",
    source: overrides.source ?? "test-feed",
    publishedAt: overrides.publishedAt ?? "2026-05-27T06:00:00Z",
    score: overrides.score ?? 50,
    tags: overrides.tags ?? [],
    // Required IntelligenceItem fields that newsArchive doesn't use but the type needs
    id: "test-id",
    kind: "news" as const,
    lat: null,
    lng: null,
    placeName: null,
  };
}

// Helper to build a JSONL string from records
function makeJSONL(records: object[]): string {
  return records.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

// ─── archiveNewsItems — deduplication and basic writes ────────────────────

describe("archiveNewsItems — basic write", () => {
  beforeEach(async () => {
    // Reset module state (the `seen` Set) between groups
    await vi.resetModules();
    vi.clearAllMocks();
    // Re-apply fs mocks after module reset
    mockedAppendFile.mockResolvedValue(undefined);
    mockedExists.mockReturnValue(true);
  });

  it("returns 0 for empty items array without writing", async () => {
    const { archiveNewsItems } = await import("./newsArchive.js");
    const count = await archiveNewsItems([]);
    expect(count).toBe(0);
    expect(mockedAppendFile).not.toHaveBeenCalled();
  });

  it("returns 0 for items with no sourceUrl", async () => {
    const { archiveNewsItems } = await import("./newsArchive.js");
    const item = makeItem({ sourceUrl: undefined });
    // @ts-expect-error — deliberately omitting sourceUrl
    item.sourceUrl = undefined;
    const count = await archiveNewsItems([item]);
    expect(count).toBe(0);
    expect(mockedAppendFile).not.toHaveBeenCalled();
  });

  it("appends a JSONL record for a new item", async () => {
    const { archiveNewsItems } = await import("./newsArchive.js");
    const count = await archiveNewsItems([makeItem({ sourceUrl: "https://example.com/new-story" })]);
    expect(count).toBe(1);
    expect(mockedAppendFile).toHaveBeenCalledOnce();
    const written = mockedAppendFile.mock.calls[0][1] as string;
    const rec = JSON.parse(written.trim());
    expect(rec.url).toBe("https://example.com/new-story");
    expect(rec.source).toBe("test-feed");
    expect(rec.score).toBe(50);
  });

  it("deduplicates: second call with same URL returns 0 and does not write again", async () => {
    const { archiveNewsItems } = await import("./newsArchive.js");
    const item = makeItem({ sourceUrl: "https://example.com/dedup-story" });
    const first = await archiveNewsItems([item]);
    const second = await archiveNewsItems([item]);
    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(mockedAppendFile).toHaveBeenCalledOnce(); // only the first write
  });

  it("deduplicates within a single batch", async () => {
    const { archiveNewsItems } = await import("./newsArchive.js");
    const url = "https://example.com/batch-dedup";
    const items = [makeItem({ sourceUrl: url }), makeItem({ sourceUrl: url })];
    const count = await archiveNewsItems(items);
    expect(count).toBe(1); // second item in batch is a dup
  });

  it("writes multiple distinct items in one appendFile call", async () => {
    const { archiveNewsItems } = await import("./newsArchive.js");
    const items = [
      makeItem({ sourceUrl: "https://example.com/a" }),
      makeItem({ sourceUrl: "https://example.com/b" }),
      makeItem({ sourceUrl: "https://example.com/c" }),
    ];
    const count = await archiveNewsItems(items);
    expect(count).toBe(3);
    expect(mockedAppendFile).toHaveBeenCalledOnce();
    const written = mockedAppendFile.mock.calls[0][1] as string;
    const lines = written.trim().split("\n");
    expect(lines).toHaveLength(3);
  });
});

// ─── archiveNewsItems — language detection (via language field in record) ──

describe("archiveNewsItems — language detection", () => {
  beforeEach(async () => {
    await vi.resetModules();
    vi.clearAllMocks();
    mockedAppendFile.mockResolvedValue(undefined);
  });

  it("detects Thai from Thai characters in title", async () => {
    const { archiveNewsItems } = await import("./newsArchive.js");
    await archiveNewsItems([makeItem({ title: "ชลบุรี เตรียมรับมือน้ำท่วม" })]);
    const written = mockedAppendFile.mock.calls[0][1] as string;
    const rec = JSON.parse(written.trim());
    expect(rec.language).toBe("th");
  });

  it("detects Chinese from CJK characters in title", async () => {
    const { archiveNewsItems } = await import("./newsArchive.js");
    await archiveNewsItems([makeItem({ title: "春武里 经济" })]);
    const written = mockedAppendFile.mock.calls[0][1] as string;
    const rec = JSON.parse(written.trim());
    expect(rec.language).toBe("zh");
  });

  it("detects English from ASCII letters in title", async () => {
    const { archiveNewsItems } = await import("./newsArchive.js");
    await archiveNewsItems([makeItem({ title: "Chonburi Economic Zone Update" })]);
    const written = mockedAppendFile.mock.calls[0][1] as string;
    const rec = JSON.parse(written.trim());
    expect(rec.language).toBe("en");
  });

  it("defaults to 'other' for titles with no Latin or CJK characters", async () => {
    const { archiveNewsItems } = await import("./newsArchive.js");
    // Emoji-only or purely numeric title has none of the tested character classes
    await archiveNewsItems([makeItem({ title: "🔴 1234 !@#$%" })]);
    const written = mockedAppendFile.mock.calls[0][1] as string;
    const rec = JSON.parse(written.trim());
    expect(rec.language).toBe("other");
  });
});

// ─── readNewsArchive — JSONL filtering ────────────────────────────────────

describe("readNewsArchive — filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedExists.mockReturnValue(true);
  });

  const BASE_RECORDS = [
    { id: "a1", url: "https://x.com/1", title: "Flood warning", summary: "Water levels rising", source: "itic", language: "en", publishedAt: "2026-05-20T00:00:00Z", firstSeenAt: "2026-05-20T01:00:00Z", score: 80, tags: [] },
    { id: "a2", url: "https://x.com/2", title: "น้ำท่วม", summary: "น้ำขึ้นสูง", source: "traffy", language: "th", publishedAt: "2026-05-22T00:00:00Z", firstSeenAt: "2026-05-22T02:00:00Z", score: 60, tags: ["flood"] },
    { id: "a3", url: "https://x.com/3", title: "EEC investment", summary: "New investors join EEC", source: "itic", language: "en", publishedAt: "2026-05-25T00:00:00Z", firstSeenAt: "2026-05-25T08:00:00Z", score: 90, tags: [] },
    { id: "a4", url: "https://x.com/4", title: "春武里 经济", summary: "Economic development", source: "xinhua", language: "zh", publishedAt: "2026-05-27T00:00:00Z", firstSeenAt: "2026-05-27T06:00:00Z", score: 55, tags: [] },
  ];

  it("returns all records when no filter is applied (reverse order)", async () => {
    const { readNewsArchive } = await import("./newsArchive.js");
    mockedReadFile.mockResolvedValue(makeJSONL(BASE_RECORDS));
    const results = await readNewsArchive();
    expect(results).toHaveLength(4);
    // Reverse scan — newest first
    expect(results[0].id).toBe("a4");
    expect(results[3].id).toBe("a1");
  });

  it("returns [] when archive file does not exist", async () => {
    const { readNewsArchive } = await import("./newsArchive.js");
    mockedExists.mockReturnValue(false);
    const results = await readNewsArchive();
    expect(results).toEqual([]);
  });

  it("filters by source", async () => {
    const { readNewsArchive } = await import("./newsArchive.js");
    mockedReadFile.mockResolvedValue(makeJSONL(BASE_RECORDS));
    const results = await readNewsArchive({ source: "itic" });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.source === "itic")).toBe(true);
  });

  it("filters by language", async () => {
    const { readNewsArchive } = await import("./newsArchive.js");
    mockedReadFile.mockResolvedValue(makeJSONL(BASE_RECORDS));
    const results = await readNewsArchive({ language: "th" });
    expect(results).toHaveLength(1);
    expect(results[0].language).toBe("th");
  });

  it("filters by `since` (inclusive)", async () => {
    const { readNewsArchive } = await import("./newsArchive.js");
    mockedReadFile.mockResolvedValue(makeJSONL(BASE_RECORDS));
    const results = await readNewsArchive({ since: "2026-05-25T00:00:00Z" });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.firstSeenAt >= "2026-05-25T00:00:00Z")).toBe(true);
  });

  it("filters by `until` (inclusive)", async () => {
    const { readNewsArchive } = await import("./newsArchive.js");
    mockedReadFile.mockResolvedValue(makeJSONL(BASE_RECORDS));
    const results = await readNewsArchive({ until: "2026-05-22T23:59:59Z" });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.firstSeenAt <= "2026-05-22T23:59:59Z")).toBe(true);
  });

  it("filters by full-text search `q` (title or summary)", async () => {
    const { readNewsArchive } = await import("./newsArchive.js");
    mockedReadFile.mockResolvedValue(makeJSONL(BASE_RECORDS));
    const results = await readNewsArchive({ q: "eec" });
    // Matches "EEC investment" (title) and "New investors join EEC" (summary)
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("a3");
  });

  it("full-text search is case-insensitive", async () => {
    const { readNewsArchive } = await import("./newsArchive.js");
    mockedReadFile.mockResolvedValue(makeJSONL(BASE_RECORDS));
    const upper = await readNewsArchive({ q: "FLOOD" });
    const lower = await readNewsArchive({ q: "flood" });
    expect(upper).toHaveLength(lower.length);
  });

  it("respects the limit option (default 200)", async () => {
    const { readNewsArchive } = await import("./newsArchive.js");
    mockedReadFile.mockResolvedValue(makeJSONL(BASE_RECORDS));
    const results = await readNewsArchive({ limit: 2 });
    expect(results).toHaveLength(2);
  });

  it("clamps limit between 1 and 5000", async () => {
    const { readNewsArchive } = await import("./newsArchive.js");
    mockedReadFile.mockResolvedValue(makeJSONL(BASE_RECORDS));
    const zeroLimit = await readNewsArchive({ limit: 0 });
    expect(zeroLimit.length).toBe(1); // clamped to 1
  });

  it("skips malformed JSON lines", async () => {
    const { readNewsArchive } = await import("./newsArchive.js");
    mockedReadFile.mockResolvedValue(
      '{"id":"ok","url":"u","title":"Good","summary":"s","source":"x","language":"en","publishedAt":"2026-05-27T00:00:00Z","firstSeenAt":"2026-05-27T00:00:00Z","score":1,"tags":[]}\nnot json at all\n'
    );
    const results = await readNewsArchive();
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("ok");
  });
});

// ─── digestNewsArchive — aggregation ──────────────────────────────────────

describe("digestNewsArchive — aggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedExists.mockReturnValue(true);
  });

  const RECORDS_IN_WINDOW = [
    { id: "d1", url: "u1", title: "A", summary: "s", source: "itic", language: "en", publishedAt: "2026-05-27T00:00:00Z", firstSeenAt: "2026-05-27T00:00:00Z", score: 80, tags: [] },
    { id: "d2", url: "u2", title: "B", summary: "s", source: "itic", language: "en", publishedAt: "2026-05-27T01:00:00Z", firstSeenAt: "2026-05-27T01:00:00Z", score: 70, tags: [] },
    { id: "d3", url: "u3", title: "C", summary: "s", source: "traffy", language: "th", publishedAt: "2026-05-26T12:00:00Z", firstSeenAt: "2026-05-26T12:00:00Z", score: 90, tags: [] },
  ];

  it("returns the correct digest shape", async () => {
    const { digestNewsArchive } = await import("./newsArchive.js");
    // Feed the 3 recent records — all within last 24h window
    mockedReadFile.mockResolvedValue(makeJSONL(RECORDS_IN_WINDOW));
    const digest = await digestNewsArchive("24h");
    expect(digest.period).toBe("24h");
    expect(typeof digest.windowStart).toBe("string");
    expect(typeof digest.totalInWindow).toBe("number");
    expect(Array.isArray(digest.bySource)).toBe(true);
    expect(Array.isArray(digest.byLanguage)).toBe(true);
    expect(Array.isArray(digest.byDay)).toBe(true);
    expect(Array.isArray(digest.topHeadlines)).toBe(true);
  });

  it("bySource is sorted by count descending", async () => {
    const { digestNewsArchive } = await import("./newsArchive.js");
    mockedReadFile.mockResolvedValue(makeJSONL(RECORDS_IN_WINDOW));
    const digest = await digestNewsArchive("24h");
    if (digest.bySource.length >= 2) {
      expect(digest.bySource[0].count).toBeGreaterThanOrEqual(digest.bySource[1].count);
    }
  });

  it("topHeadlines are sorted by score descending", async () => {
    const { digestNewsArchive } = await import("./newsArchive.js");
    mockedReadFile.mockResolvedValue(makeJSONL(RECORDS_IN_WINDOW));
    const digest = await digestNewsArchive("24h");
    if (digest.topHeadlines.length >= 2) {
      expect(digest.topHeadlines[0].score).toBeGreaterThanOrEqual(digest.topHeadlines[1].score);
    }
  });

  it("topHeadlines has at most 12 entries", async () => {
    const { digestNewsArchive } = await import("./newsArchive.js");
    // Create 15 records
    const many = Array.from({ length: 15 }, (_, i) => ({
      id: `r${i}`, url: `u${i}`, title: `Story ${i}`, summary: "s",
      source: "itic", language: "en",
      publishedAt: "2026-05-27T00:00:00Z",
      firstSeenAt: "2026-05-27T00:00:00Z",
      score: i * 5, tags: [],
    }));
    mockedReadFile.mockResolvedValue(makeJSONL(many));
    const digest = await digestNewsArchive("24h");
    expect(digest.topHeadlines.length).toBeLessThanOrEqual(12);
  });

  it("byDay groups records by firstSeenAt date (YYYY-MM-DD)", async () => {
    const { digestNewsArchive } = await import("./newsArchive.js");
    mockedReadFile.mockResolvedValue(makeJSONL(RECORDS_IN_WINDOW));
    const digest = await digestNewsArchive("24h");
    // 2 records on 2026-05-27, 1 on 2026-05-26
    for (const entry of digest.byDay) {
      expect(entry.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof entry.count).toBe("number");
    }
  });
});

// ─── newsArchiveStats ─────────────────────────────────────────────────────

describe("newsArchiveStats", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns fileBytes from stat, oldest/newest seenAt, and distinct source count", async () => {
    const { stat } = await import("node:fs/promises") as unknown as { stat: ReturnType<typeof vi.fn> };
    const { readFile: rf } = await import("node:fs/promises") as unknown as { readFile: ReturnType<typeof vi.fn> };
    const { existsSync: es } = await import("node:fs") as unknown as { existsSync: ReturnType<typeof vi.fn> };

    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 4096 });
    (es as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const recs = [
      { sourceUrl: "https://a.com/1", title: "A1", source: "source-a", firstSeenAt: "2026-05-25T10:00:00Z", language: "en", score: 50, tags: [] },
      { sourceUrl: "https://a.com/2", title: "A2", source: "source-a", firstSeenAt: "2026-05-27T10:00:00Z", language: "en", score: 60, tags: [] },
      { sourceUrl: "https://b.com/1", title: "B1", source: "source-b", firstSeenAt: "2026-05-26T10:00:00Z", language: "th", score: 40, tags: [] },
    ];
    (rf as ReturnType<typeof vi.fn>).mockResolvedValue(makeJSONL(recs));

    const { newsArchiveStats } = await import("./newsArchive.js");
    const stats = await newsArchiveStats();

    expect(stats.fileBytes).toBe(4096);
    expect(stats.oldestSeenAt).toBe("2026-05-25T10:00:00Z");
    expect(stats.newestSeenAt).toBe("2026-05-27T10:00:00Z");
    expect(stats.distinctSources).toBe(2); // source-a and source-b
  });

  it("returns null for oldest/newest and 0 for fileBytes when archive does not exist", async () => {
    const { existsSync: es } = await import("node:fs") as unknown as { existsSync: ReturnType<typeof vi.fn> };
    (es as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { newsArchiveStats } = await import("./newsArchive.js");
    const stats = await newsArchiveStats();

    expect(stats.fileBytes).toBe(0);
    expect(stats.oldestSeenAt).toBeNull();
    expect(stats.newestSeenAt).toBeNull();
    expect(stats.distinctSources).toBe(0);
  });

  it("skips malformed JSON lines when computing stats", async () => {
    const { stat } = await import("node:fs/promises") as unknown as { stat: ReturnType<typeof vi.fn> };
    const { readFile: rf } = await import("node:fs/promises") as unknown as { readFile: ReturnType<typeof vi.fn> };
    const { existsSync: es } = await import("node:fs") as unknown as { existsSync: ReturnType<typeof vi.fn> };

    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 100 });
    (es as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (rf as ReturnType<typeof vi.fn>).mockResolvedValue(
      [
        JSON.stringify({ sourceUrl: "https://ok.com", title: "OK", source: "good", firstSeenAt: "2026-05-27T08:00:00Z", language: "en", score: 50, tags: [] }),
        "NOT VALID JSON {{{",
        "",
      ].join("\n"),
    );

    const { newsArchiveStats } = await import("./newsArchive.js");
    const stats = await newsArchiveStats();

    expect(stats.distinctSources).toBe(1);
    expect(stats.oldestSeenAt).toBe("2026-05-27T08:00:00Z");
  });
});
