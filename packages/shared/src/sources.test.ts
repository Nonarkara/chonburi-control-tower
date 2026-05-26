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

describe("sourcesByStatus + sourcesByCategory", () => {
  it("sourcesByStatus filters correctly", () => {
    const live = sourcesByStatus("live");
    expect(live.length).toBeGreaterThan(0);
    expect(live.every((s) => s.status === "live")).toBe(true);
  });

  it("sourcesByCategory filters correctly", () => {
    const maritime = sourcesByCategory("maritime");
    expect(maritime.length).toBeGreaterThan(0);
    expect(maritime.every((s) => s.category === "maritime")).toBe(true);
  });
});
