import { describe, it, expect } from "vitest";
import { compass, fmt, aqiColor, aqiBand } from "./coastal";

/**
 * coastal.ts display-helper contract tests.
 *
 * compass, fmt, aqiColor, and aqiBand drive the CoastalBrief and KpiStrip
 * components. Getting thresholds wrong silently shows bad safety advice
 * (wrong compass direction, wrong AQI category, wrong colour).
 *
 * Covered:
 *   - compass: all 8 cardinal + intercardinal directions, null input, wrap
 *   - fmt: null/NaN guard, digit precision, unit suffix
 *   - aqiColor: threshold boundaries (50, 100, 150)
 *   - aqiBand: all 5 EPA AQI text categories
 */

// ─── compass ─────────────────────────────────────────────────────────────────

describe("compass", () => {
  it("returns '—' for null input", () => {
    expect(compass(null)).toBe("—");
  });

  it("maps 0° to N", () => {
    expect(compass(0)).toBe("N");
  });

  it("maps each 45° increment to the correct direction", () => {
    expect(compass(45)).toBe("NE");
    expect(compass(90)).toBe("E");
    expect(compass(135)).toBe("SE");
    expect(compass(180)).toBe("S");
    expect(compass(225)).toBe("SW");
    expect(compass(270)).toBe("W");
    expect(compass(315)).toBe("NW");
  });

  it("wraps 360° back to N", () => {
    expect(compass(360)).toBe("N");
  });

  it("rounds to the nearest direction (22° → NE, 22.4 → N)", () => {
    // 22.5° is the boundary: Math.round(22.5/45) = Math.round(0.5) = 1 → NE
    expect(compass(22)).toBe("N");   // 22/45 = 0.489 → rounds to 0 → N
    expect(compass(23)).toBe("NE");  // 23/45 = 0.511 → rounds to 1 → NE
  });
});

// ─── fmt ─────────────────────────────────────────────────────────────────────

describe("fmt", () => {
  it("returns '—' for null input", () => {
    expect(fmt(null)).toBe("—");
  });

  it("returns '—' for NaN input", () => {
    expect(fmt(Number.NaN)).toBe("—");
  });

  it("formats with 1 decimal place by default", () => {
    expect(fmt(3.14159)).toBe("3.1");
  });

  it("formats with the specified digit count", () => {
    expect(fmt(3.14159, 2)).toBe("3.14");
    expect(fmt(3.14159, 0)).toBe("3");
  });

  it("appends the unit suffix", () => {
    expect(fmt(15.7, 1, " km/h")).toBe("15.7 km/h");
    expect(fmt(28, 0, "°C")).toBe("28°C");
  });

  it("formats 0 correctly (not as '—')", () => {
    expect(fmt(0)).toBe("0.0");
    expect(fmt(0, 0)).toBe("0");
  });
});

// ─── aqiColor ─────────────────────────────────────────────────────────────────

describe("aqiColor", () => {
  it("returns --good for AQI ≤ 50", () => {
    expect(aqiColor(0)).toBe("var(--good)");
    expect(aqiColor(50)).toBe("var(--good)");
  });

  it("returns --warn for AQI 51–100", () => {
    expect(aqiColor(51)).toBe("var(--warn)");
    expect(aqiColor(100)).toBe("var(--warn)");
  });

  it("returns --bad for AQI 101–150", () => {
    expect(aqiColor(101)).toBe("var(--bad)");
    expect(aqiColor(150)).toBe("var(--bad)");
  });

  it("returns --crit for AQI > 150", () => {
    expect(aqiColor(151)).toBe("var(--crit)");
    expect(aqiColor(500)).toBe("var(--crit)");
  });
});

// ─── aqiBand ─────────────────────────────────────────────────────────────────

describe("aqiBand", () => {
  it("returns GOOD for AQI ≤ 50", () => {
    expect(aqiBand(0)).toBe("GOOD");
    expect(aqiBand(50)).toBe("GOOD");
  });

  it("returns MODERATE for AQI 51–100", () => {
    expect(aqiBand(51)).toBe("MODERATE");
    expect(aqiBand(100)).toBe("MODERATE");
  });

  it("returns UNHEALTHY·SG for AQI 101–150", () => {
    expect(aqiBand(101)).toBe("UNHEALTHY·SG");
    expect(aqiBand(150)).toBe("UNHEALTHY·SG");
  });

  it("returns UNHEALTHY for AQI 151–200", () => {
    expect(aqiBand(151)).toBe("UNHEALTHY");
    expect(aqiBand(200)).toBe("UNHEALTHY");
  });

  it("returns HAZARDOUS for AQI > 200", () => {
    expect(aqiBand(201)).toBe("HAZARDOUS");
    expect(aqiBand(500)).toBe("HAZARDOUS");
  });
});
