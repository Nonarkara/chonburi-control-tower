import { describe, it, expect } from "vitest";
import { windDirLabel, uvBand } from "./worldStrip";

/**
 * worldStrip.ts contract tests.
 *
 * windDirLabel and uvBand drive the WorldStrip weather bar shown to
 * operators at the top of every lens. Getting a direction or UV category
 * wrong silently misleads situational awareness.
 *
 * Covered:
 *   - windDirLabel: null, all 8 compass points, 360° wrap
 *   - uvBand: null, all 5 WHO severity levels at boundaries
 */

// ─── windDirLabel ────────────────────────────────────────────────────────────

describe("windDirLabel", () => {
  it("returns '—' for null", () => {
    expect(windDirLabel(null)).toBe("—");
  });

  it("N: 0°", () => {
    expect(windDirLabel(0)).toBe("N");
  });

  it("NE: 45°", () => {
    expect(windDirLabel(45)).toBe("NE");
  });

  it("E: 90°", () => {
    expect(windDirLabel(90)).toBe("E");
  });

  it("SE: 135°", () => {
    expect(windDirLabel(135)).toBe("SE");
  });

  it("S: 180°", () => {
    expect(windDirLabel(180)).toBe("S");
  });

  it("SW: 225°", () => {
    expect(windDirLabel(225)).toBe("SW");
  });

  it("W: 270°", () => {
    expect(windDirLabel(270)).toBe("W");
  });

  it("NW: 315°", () => {
    expect(windDirLabel(315)).toBe("NW");
  });

  it("360° wraps back to N", () => {
    expect(windDirLabel(360)).toBe("N");
  });

  it("337.5° rounds to N (boundary between NW and N)", () => {
    // Math.round(337.5 / 45) = Math.round(7.5) = 8, 8 % 8 = 0 = N
    expect(windDirLabel(337.5)).toBe("N");
  });
});

// ─── uvBand ──────────────────────────────────────────────────────────────────

describe("uvBand", () => {
  it("returns neutral dash for null", () => {
    const band = uvBand(null);
    expect(band.label).toBe("—");
    expect(band.color).toBe("var(--text-3)");
  });

  it("returns 'low' for uv < 3", () => {
    expect(uvBand(0).label).toBe("low");
    expect(uvBand(2).label).toBe("low");
    expect(uvBand(2.9).label).toBe("low");
    expect(uvBand(0).color).toBe("var(--good)");
  });

  it("returns 'moderate' for uv in [3, 6)", () => {
    expect(uvBand(3).label).toBe("moderate");
    expect(uvBand(5).label).toBe("moderate");
    expect(uvBand(5.9).label).toBe("moderate");
    expect(uvBand(3).color).toBe("var(--warn)");
  });

  it("returns 'high' for uv in [6, 8)", () => {
    expect(uvBand(6).label).toBe("high");
    expect(uvBand(7).label).toBe("high");
    expect(uvBand(7.9).label).toBe("high");
    expect(uvBand(6).color).toBe("var(--bad)");
  });

  it("returns 'very high' for uv in [8, 11)", () => {
    expect(uvBand(8).label).toBe("very high");
    expect(uvBand(10).label).toBe("very high");
    expect(uvBand(10.9).label).toBe("very high");
    expect(uvBand(8).color).toBe("var(--bad)");
  });

  it("returns 'extreme' for uv ≥ 11", () => {
    expect(uvBand(11).label).toBe("extreme");
    expect(uvBand(15).label).toBe("extreme");
    expect(uvBand(11).color).toBe("var(--crit)");
  });
});
