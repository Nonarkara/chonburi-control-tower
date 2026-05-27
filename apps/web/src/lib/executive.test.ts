import { describe, it, expect } from "vitest";
import { execAqiBand, execAqiColor, fmt1, fmtInt, avgCapacityPct } from "./executive";

/**
 * executive.ts display-helper contract tests.
 *
 * These helpers drive the ExecutiveBriefing mayor's panel. Getting
 * thresholds wrong silently shows wrong AQI category or reservoir
 * average to the mayor during a council briefing.
 *
 * NOTE: execAqiBand/execAqiColor use ABBREVIATED labels and different
 * colour tokens than coastal.ts — they are intentionally distinct.
 *
 * Covered:
 *   - execAqiBand: all 5 executive AQI categories at boundaries
 *   - execAqiColor: threshold edges → correct CSS token
 *   - fmt1: null/undefined → "—", 1dp precision
 *   - fmtInt: null/undefined → "—", rounding, locale formatting
 *   - avgCapacityPct: empty array, null filtering, averaging
 */

// ─── execAqiBand ─────────────────────────────────────────────────────────────

describe("execAqiBand", () => {
  it("returns GOOD for AQI ≤ 50", () => {
    expect(execAqiBand(0)).toBe("GOOD");
    expect(execAqiBand(50)).toBe("GOOD");
  });

  it("returns MOD for AQI 51–100", () => {
    expect(execAqiBand(51)).toBe("MOD");
    expect(execAqiBand(100)).toBe("MOD");
  });

  it("returns USG for AQI 101–150", () => {
    expect(execAqiBand(101)).toBe("USG");
    expect(execAqiBand(150)).toBe("USG");
  });

  it("returns UNHEALTHY for AQI 151–200", () => {
    expect(execAqiBand(151)).toBe("UNHEALTHY");
    expect(execAqiBand(200)).toBe("UNHEALTHY");
  });

  it("returns VERY UNHEALTHY for AQI > 200", () => {
    expect(execAqiBand(201)).toBe("VERY UNHEALTHY");
    expect(execAqiBand(500)).toBe("VERY UNHEALTHY");
  });
});

// ─── execAqiColor ─────────────────────────────────────────────────────────────

describe("execAqiColor", () => {
  it("returns --good for AQI ≤ 50", () => {
    expect(execAqiColor(50)).toBe("var(--good)");
  });

  it("returns --data for AQI 51–100 (executive uses data tier, not warn)", () => {
    expect(execAqiColor(51)).toBe("var(--data)");
    expect(execAqiColor(100)).toBe("var(--data)");
  });

  it("returns --warn for AQI 101–150", () => {
    expect(execAqiColor(101)).toBe("var(--warn)");
    expect(execAqiColor(150)).toBe("var(--warn)");
  });

  it("returns --bad for AQI > 150", () => {
    expect(execAqiColor(151)).toBe("var(--bad)");
    expect(execAqiColor(500)).toBe("var(--bad)");
  });
});

// ─── fmt1 ─────────────────────────────────────────────────────────────────────

describe("fmt1", () => {
  it("returns '—' for null", () => {
    expect(fmt1(null)).toBe("—");
  });

  it("returns '—' for undefined", () => {
    expect(fmt1(undefined)).toBe("—");
  });

  it("formats to 1 decimal place", () => {
    expect(fmt1(3.14159)).toBe("3.1");
    expect(fmt1(0)).toBe("0.0");
    expect(fmt1(28)).toBe("28.0");
  });
});

// ─── fmtInt ───────────────────────────────────────────────────────────────────

describe("fmtInt", () => {
  it("returns '—' for null", () => {
    expect(fmtInt(null)).toBe("—");
  });

  it("returns '—' for undefined", () => {
    expect(fmtInt(undefined)).toBe("—");
  });

  it("rounds to the nearest integer", () => {
    expect(fmtInt(3.6)).toBe("4");
    expect(fmtInt(3.4)).toBe("3");
  });

  it("formats large numbers with locale-appropriate separators", () => {
    // en-US locale: commas as thousand separators
    expect(fmtInt(1234567)).toBe("1,234,567");
  });
});

// ─── avgCapacityPct ───────────────────────────────────────────────────────────

describe("avgCapacityPct", () => {
  it("returns null for an empty array", () => {
    expect(avgCapacityPct([])).toBeNull();
  });

  it("returns null when all values are null", () => {
    expect(avgCapacityPct([{ capacityPct: null }, { capacityPct: null }])).toBeNull();
  });

  it("filters out null values before averaging", () => {
    // 60 + 80 = 140 / 2 = 70
    expect(avgCapacityPct([
      { capacityPct: 60 },
      { capacityPct: null },
      { capacityPct: 80 },
    ])).toBe(70);
  });

  it("computes the mean of all provided values", () => {
    expect(avgCapacityPct([
      { capacityPct: 40 },
      { capacityPct: 60 },
      { capacityPct: 80 },
    ])).toBeCloseTo(60);
  });

  it("filters out non-finite values (Infinity, NaN)", () => {
    expect(avgCapacityPct([
      { capacityPct: 50 },
      { capacityPct: Infinity },
      { capacityPct: NaN },
    ])).toBe(50);
  });

  it("returns a single value when only one reservoir has data", () => {
    expect(avgCapacityPct([{ capacityPct: 73 }, { capacityPct: null }])).toBe(73);
  });
});
