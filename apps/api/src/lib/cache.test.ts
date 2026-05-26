import { describe, it, expect } from "vitest";
import { cached, cachedWithStale, setCache, cacheAgeMinutes, snapshotCache } from "./cache";

function nextKey(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

describe("cache: basic cached()", () => {
  it("returns the computed value on first call and caches it", async () => {
    const key = nextKey("basic");
    let calls = 0;
    const compute = async () => {
      calls++;
      return { value: 42 };
    };
    const a = await cached(key, 60, compute);
    const b = await cached(key, 60, compute);
    expect(a).toEqual({ value: 42 });
    expect(b).toEqual({ value: 42 });
    expect(calls).toBe(1);
  });

  it("deduplicates concurrent in-flight requests", async () => {
    const key = nextKey("dedup");
    let calls = 0;
    const compute = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 30));
      return { value: calls };
    };
    const [a, b, c] = await Promise.all([
      cached(key, 60, compute),
      cached(key, 60, compute),
      cached(key, 60, compute),
    ]);
    expect(calls).toBe(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("re-fetches after the TTL expires", async () => {
    const key = nextKey("ttl");
    let calls = 0;
    await cached(key, 0, async () => { calls++; return calls; });
    // TTL = 0 → entry is "expired" the moment we try to read it again
    await new Promise((r) => setTimeout(r, 5));
    await cached(key, 0, async () => { calls++; return calls; });
    expect(calls).toBe(2);
  });
});

describe("cache: cachedWithStale()", () => {
  it("returns stale value when compute throws", async () => {
    const key = nextKey("stale");
    // Seed a fresh value
    await cachedWithStale(key, 0, async () => ({ value: "fresh" }));
    await new Promise((r) => setTimeout(r, 5));
    // Now compute fails → should return the stale value
    const result = await cachedWithStale(key, 0, async () => {
      throw new Error("upstream down");
    });
    expect(result).toEqual({ value: "fresh" });
  });

  it("dedups concurrent calls — burst at expiry triggers ONE upstream call", async () => {
    const key = nextKey("stale-dedup");
    let upstream = 0;
    const compute = async () => {
      upstream++;
      await new Promise((r) => setTimeout(r, 20));
      return { value: upstream };
    };
    const [a, b, c] = await Promise.all([
      cachedWithStale(key, 60, compute),
      cachedWithStale(key, 60, compute),
      cachedWithStale(key, 60, compute),
    ]);
    expect(upstream).toBe(1);
    expect(a).toEqual({ value: 1 });
    expect(b).toEqual({ value: 1 });
    expect(c).toEqual({ value: 1 });
  });

  it("throws if no stale value AND compute throws", async () => {
    const key = nextKey("stale-fail");
    await expect(
      cachedWithStale(key, 60, async () => { throw new Error("first call failed"); }),
    ).rejects.toThrow();
  });
});

describe("cache: cacheAgeMinutes", () => {
  it("returns 0 for the current moment", () => {
    expect(cacheAgeMinutes(new Date().toISOString())).toBe(0);
  });

  it("returns roughly N minutes for an N-min-old timestamp", () => {
    const ten = new Date(Date.now() - 10 * 60_000).toISOString();
    expect(cacheAgeMinutes(ten)).toBe(10);
  });

  it("returns 0 for an invalid timestamp", () => {
    expect(cacheAgeMinutes("not-a-date")).toBe(0);
  });
});

describe("cache: setCache + snapshotCache", () => {
  it("setCache → snapshotCache round-trips a value", () => {
    const key = nextKey("snap");
    setCache(key, { hello: "world" }, 60);
    const snap = snapshotCache();
    expect(snap[key]?.data).toEqual({ hello: "world" });
    expect(snap[key]?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("snapshotCache excludes already-expired entries", () => {
    const key = nextKey("expired");
    setCache(key, "old", 0);
    // Wait one tick so Date.now() exceeds expiresAt
    return new Promise<void>((resolve) => setTimeout(() => {
      const snap = snapshotCache();
      expect(snap[key]).toBeUndefined();
      resolve();
    }, 5));
  });
});
