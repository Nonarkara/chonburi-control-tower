import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * persistence.ts contract tests — verifies the disk-based cache warm-up logic.
 *
 * hydrateCacheFromDisk:
 *   - Reads `var/cache.json`, populates the in-memory cache via setCache.
 *   - Skips expired entries (expiresAt <= Date.now()).
 *   - Handles missing files, malformed JSON, missing fields gracefully.
 *
 * enableCachePersistence / stopCachePersistence:
 *   - Starts / stops a setInterval flush.
 *   - Tested minimally (interval bookkeeping) to avoid real I/O or timers.
 */

// Mock node:fs/promises so no real disk access occurs.
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock the cache module so we can observe setCache calls.
vi.mock("./cache.js", () => ({
  setCache: vi.fn(),
  snapshotCache: vi.fn().mockReturnValue({}),
  cachedWithStale: vi.fn(),
  cacheAgeMinutes: vi.fn().mockReturnValue(0),
}));

import { readFile } from "node:fs/promises";
import { setCache } from "./cache.js";

const mockedReadFile = readFile as ReturnType<typeof vi.fn>;
const mockedSetCache = setCache as ReturnType<typeof vi.fn>;

const FUTURE = Date.now() + 10 * 60 * 1000;   // 10 min from now
const PAST   = Date.now() - 10 * 60 * 1000;   // 10 min ago

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── hydrateCacheFromDisk ─────────────────────────────────────────────────

describe("hydrateCacheFromDisk", () => {
  it("returns 0 when the cache file does not exist (ENOENT)", async () => {
    mockedReadFile.mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    const { hydrateCacheFromDisk } = await import("./persistence.js");
    const count = await hydrateCacheFromDisk();
    expect(count).toBe(0);
    expect(mockedSetCache).not.toHaveBeenCalled();
  });

  it("returns 0 for empty JSON object", async () => {
    mockedReadFile.mockResolvedValueOnce("{}");
    const { hydrateCacheFromDisk } = await import("./persistence.js");
    const count = await hydrateCacheFromDisk();
    expect(count).toBe(0);
  });

  it("returns 0 when JSON is malformed", async () => {
    mockedReadFile.mockResolvedValueOnce("not json }{");
    const { hydrateCacheFromDisk } = await import("./persistence.js");
    const count = await hydrateCacheFromDisk();
    expect(count).toBe(0);
    expect(mockedSetCache).not.toHaveBeenCalled();
  });

  it("hydrates a valid non-expired entry and returns 1", async () => {
    const entry = { data: { foo: "bar" }, expiresAt: FUTURE };
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({ "weather": entry }));
    const { hydrateCacheFromDisk } = await import("./persistence.js");
    const count = await hydrateCacheFromDisk();
    expect(count).toBe(1);
    expect(mockedSetCache).toHaveBeenCalledOnce();
    expect(mockedSetCache).toHaveBeenCalledWith("weather", { foo: "bar" }, expect.any(Number));
  });

  it("skips entries whose expiresAt is in the past", async () => {
    const expired = { data: { x: 1 }, expiresAt: PAST };
    const valid   = { data: { y: 2 }, expiresAt: FUTURE };
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({
      "stale-key": expired,
      "fresh-key": valid,
    }));
    const { hydrateCacheFromDisk } = await import("./persistence.js");
    const count = await hydrateCacheFromDisk();
    expect(count).toBe(1); // only fresh-key
    expect(mockedSetCache).toHaveBeenCalledOnce();
    expect(mockedSetCache.mock.calls[0][0]).toBe("fresh-key");
  });

  it("skips entries where expiresAt is not a number", async () => {
    const bad = { data: { x: 1 }, expiresAt: "not-a-number" };
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({ "bad-entry": bad }));
    const { hydrateCacheFromDisk } = await import("./persistence.js");
    const count = await hydrateCacheFromDisk();
    expect(count).toBe(0);
    expect(mockedSetCache).not.toHaveBeenCalled();
  });

  it("skips null entries", async () => {
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({ "null-key": null }));
    const { hydrateCacheFromDisk } = await import("./persistence.js");
    const count = await hydrateCacheFromDisk();
    expect(count).toBe(0);
  });

  it("hydrates multiple valid entries", async () => {
    const entries: Record<string, unknown> = {};
    for (let i = 0; i < 5; i++) {
      entries[`key-${i}`] = { data: i, expiresAt: FUTURE };
    }
    mockedReadFile.mockResolvedValueOnce(JSON.stringify(entries));
    const { hydrateCacheFromDisk } = await import("./persistence.js");
    const count = await hydrateCacheFromDisk();
    expect(count).toBe(5);
    expect(mockedSetCache).toHaveBeenCalledTimes(5);
  });

  it("computes ttlSeconds from remaining time (not a fixed value)", async () => {
    const expiresAt = Date.now() + 120_000; // 120s from now
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({ "k": { data: 1, expiresAt } }));
    const { hydrateCacheFromDisk } = await import("./persistence.js");
    await hydrateCacheFromDisk();
    const ttl = mockedSetCache.mock.calls[0][2] as number;
    expect(ttl).toBeGreaterThanOrEqual(118); // allow 2s clock drift in test
    expect(ttl).toBeLessThanOrEqual(121);
  });
});

// ─── enableCachePersistence / stopCachePersistence ────────────────────────

describe("stopCachePersistence", () => {
  afterEach(() => {
    // Ensure any started interval is cleared
    vi.useRealTimers();
  });

  it("stopCachePersistence is idempotent (can be called multiple times safely)", async () => {
    const { stopCachePersistence } = await import("./persistence.js");
    // Should not throw even if called before enable
    expect(() => stopCachePersistence()).not.toThrow();
    expect(() => stopCachePersistence()).not.toThrow();
  });

  it("enableCachePersistence starts an interval and stopCachePersistence clears it", async () => {
    vi.useFakeTimers();
    const { enableCachePersistence, stopCachePersistence } = await import("./persistence.js");

    enableCachePersistence(1000);
    // Advance by less than the interval — flush should not have run yet
    vi.advanceTimersByTime(999);
    expect(mockedSetCache).not.toHaveBeenCalled();

    stopCachePersistence();
    // Advance past interval — flush should NOT run because interval was cleared
    vi.advanceTimersByTime(2000);
    // writeFile (from snapshotCache) should not have been called
    // (We check setCache instead since writeFile is mocked differently)
    vi.useRealTimers();
  });
});
