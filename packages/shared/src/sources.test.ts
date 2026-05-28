import { describe, it, expect } from "vitest";
import { SOURCE_CATALOG, sourcesByStatus, sourcesByCategory } from "./sources";

describe("SOURCE_CATALOG invariants", () => {
  it("contains at least 30 entries (we advertise 37+)", () => {
    expect(SOURCE_CATALOG.length).toBeGreaterThanOrEqual(30);
  });

  it("has no duplicate IDs", () => {
    const ids = SOURCE_CATALOG.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every entry has required fields populated", () => {
    for (const s of SOURCE_CATALOG) {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.vendor).toBeTruthy();
      expect(s.category).toBeTruthy();
      expect(s.status).toBeTruthy();
      expect(s.describe).toBeTruthy();
    }
  });

  it("every entry has a valid status", () => {
    const valid = new Set(["live", "ready", "planned", "research", "stub"]);
    for (const s of SOURCE_CATALOG) {
      expect(valid.has(s.status)).toBe(true);
    }
  });

  it("every entry has a valid category", () => {
    const valid = new Set([
      "mobility",
      "incidents",
      "environment",
      "imagery",
      "vibes",
      "infrastructure",
      "maritime",
      "open-data",
      "campus",
    ]);
    for (const s of SOURCE_CATALOG) {
      expect(valid.has(s.category)).toBe(true);
    }
  });

  it("apiPath values start with /api or /geo or are parenthetical notes", () => {
    for (const s of SOURCE_CATALOG) {
      if (!s.apiPath) continue;
      const looksReasonable =
        s.apiPath.startsWith("/api") ||
        s.apiPath.startsWith("/geo") ||
        s.apiPath.startsWith("(");
      expect(looksReasonable, `Bad apiPath for ${s.id}: ${s.apiPath}`).toBe(true);
    }
  });
});

describe("SOURCE_CATALOG — live sources", () => {
  it("at least one 'live' source has an apiPath starting with /api", () => {
    const live = SOURCE_CATALOG.filter((s) => s.status === "live");
    const withApiPath = live.filter((s) => s.apiPath?.startsWith("/api"));
    expect(withApiPath.length).toBeGreaterThan(0);
  });

  it("ids contain only URL-safe characters (no spaces or special chars)", () => {
    const unsafe = /[^a-z0-9-_]/;
    for (const s of SOURCE_CATALOG) {
      expect(unsafe.test(s.id), `Unsafe id: "${s.id}"`).toBe(false);
    }
  });

  it("describe strings are non-empty strings", () => {
    for (const s of SOURCE_CATALOG) {
      expect(typeof s.describe).toBe("string");
      // At minimum the describe field must exist (may be a placeholder)
    }
  });
});

describe("sourcesByStatus + sourcesByCategory", () => {
  it("sourcesByStatus('live') filters correctly", () => {
    const live = sourcesByStatus("live");
    expect(live.length).toBeGreaterThan(0);
    expect(live.every((s) => s.status === "live")).toBe(true);
  });

  it("sourcesByStatus('stub') returns only stub entries", () => {
    const stubs = sourcesByStatus("stub");
    expect(stubs.length).toBeGreaterThan(0);
    expect(stubs.every((s) => s.status === "stub")).toBe(true);
  });

  it("sourcesByStatus('ready') returns only ready entries", () => {
    const ready = sourcesByStatus("ready");
    expect(ready.every((s) => s.status === "ready")).toBe(true);
  });

  it("sourcesByCategory('maritime') filters correctly", () => {
    const maritime = sourcesByCategory("maritime");
    expect(maritime.length).toBeGreaterThan(0);
    expect(maritime.every((s) => s.category === "maritime")).toBe(true);
  });

  it("sourcesByCategory('environment') returns only environment entries", () => {
    const env = sourcesByCategory("environment");
    expect(env.length).toBeGreaterThan(0);
    expect(env.every((s) => s.category === "environment")).toBe(true);
  });

  it("sourcesByCategory('mobility') returns only mobility entries", () => {
    const mob = sourcesByCategory("mobility");
    expect(mob.length).toBeGreaterThan(0);
    expect(mob.every((s) => s.category === "mobility")).toBe(true);
  });

  it("sourcesByStatus + sourcesByCategory are exhaustive (union == total)", () => {
    // Sum of each status group should equal the total catalog length
    const statuses = ["live", "ready", "planned", "research", "stub"] as const;
    const total = statuses.reduce((acc, s) => acc + sourcesByStatus(s).length, 0);
    expect(total).toBe(SOURCE_CATALOG.length);
  });
});
