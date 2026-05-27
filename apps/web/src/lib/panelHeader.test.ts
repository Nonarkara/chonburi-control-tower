import { describe, it, expect } from "vitest";
import { ageClass } from "./panelHeader";

/**
 * panelHeader.ts contract tests.
 *
 * ageClass() drives the CSS freshness chip on every panel section header.
 * Getting these thresholds wrong silently shows wrong colours in every
 * panel on the dashboard — operators can't tell fresh from stale data.
 *
 * Covered:
 *   - Tier overrides: unavailable → crit, scenario → warn (before minute check)
 *   - null/undefined minutes → empty string (no class)
 *   - Minutes thresholds: <5 → fresh, <30 → "", <120 → warn, ≥120 → stale
 *   - Exact boundary values (5, 30, 120)
 */

describe("ageClass — tier overrides", () => {
  it("returns data-age--crit for unavailable tier regardless of minutes", () => {
    expect(ageClass(undefined, "unavailable")).toBe("data-age--crit");
    expect(ageClass(null, "unavailable")).toBe("data-age--crit");
    expect(ageClass(0, "unavailable")).toBe("data-age--crit");
    expect(ageClass(1000, "unavailable")).toBe("data-age--crit");
  });

  it("returns data-age--warn for scenario tier regardless of minutes", () => {
    expect(ageClass(undefined, "scenario")).toBe("data-age--warn");
    expect(ageClass(null, "scenario")).toBe("data-age--warn");
    expect(ageClass(0, "scenario")).toBe("data-age--warn");
    expect(ageClass(1000, "scenario")).toBe("data-age--warn");
  });

  it("does NOT override for live tier — falls through to minute check", () => {
    // live with no minutes → empty string
    expect(ageClass(undefined, "live")).toBe("");
    expect(ageClass(null, "live")).toBe("");
  });

  it("does NOT override for cache tier — falls through to minute check", () => {
    expect(ageClass(4, "cache")).toBe("data-age--fresh");
    expect(ageClass(200, "cache")).toBe("data-age--stale");
  });
});

describe("ageClass — null/undefined minutes (no tier override)", () => {
  it("returns empty string when minutes is undefined", () => {
    expect(ageClass(undefined)).toBe("");
    expect(ageClass(undefined, undefined)).toBe("");
  });

  it("returns empty string when minutes is null", () => {
    expect(ageClass(null)).toBe("");
  });
});

describe("ageClass — minute thresholds", () => {
  it("returns data-age--fresh for minutes < 5", () => {
    expect(ageClass(0)).toBe("data-age--fresh");
    expect(ageClass(1)).toBe("data-age--fresh");
    expect(ageClass(4)).toBe("data-age--fresh");
    expect(ageClass(4.9)).toBe("data-age--fresh");
  });

  it("returns '' (neutral) at exactly 5 minutes", () => {
    expect(ageClass(5)).toBe("");
  });

  it("returns '' (neutral) for minutes in [5, 30)", () => {
    expect(ageClass(5)).toBe("");
    expect(ageClass(15)).toBe("");
    expect(ageClass(29)).toBe("");
    expect(ageClass(29.9)).toBe("");
  });

  it("returns data-age--warn at exactly 30 minutes", () => {
    expect(ageClass(30)).toBe("data-age--warn");
  });

  it("returns data-age--warn for minutes in [30, 120)", () => {
    expect(ageClass(30)).toBe("data-age--warn");
    expect(ageClass(60)).toBe("data-age--warn");
    expect(ageClass(119)).toBe("data-age--warn");
    expect(ageClass(119.9)).toBe("data-age--warn");
  });

  it("returns data-age--stale at exactly 120 minutes", () => {
    expect(ageClass(120)).toBe("data-age--stale");
  });

  it("returns data-age--stale for minutes ≥ 120", () => {
    expect(ageClass(120)).toBe("data-age--stale");
    expect(ageClass(180)).toBe("data-age--stale");
    expect(ageClass(1440)).toBe("data-age--stale");
  });
});
