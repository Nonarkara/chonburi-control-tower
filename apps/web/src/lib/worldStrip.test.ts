import { describe, it, expect } from "vitest";
import { windDirLabel, uvBand, pulseColor, aqiBand, rainBadge, hmFromIso, timeInTz } from "./worldStrip";
import type { PrecipNowcast } from "@chonburi/shared";

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

// ─── pulseColor ───────────────────────────────────────────────────────────────

describe("pulseColor", () => {
  it("returns text (normal) when below warn threshold", () => {
    expect(pulseColor(0, 5, 10)).toBe("var(--text)");
    expect(pulseColor(4, 5, 10)).toBe("var(--text)");
  });

  it("returns warn when at or above warn but below bad", () => {
    expect(pulseColor(5, 5, 10)).toBe("var(--warn)");
    expect(pulseColor(9, 5, 10)).toBe("var(--warn)");
  });

  it("returns bad when at or above bad threshold", () => {
    expect(pulseColor(10, 5, 10)).toBe("var(--bad)");
    expect(pulseColor(100, 5, 10)).toBe("var(--bad)");
  });
});

// ─── aqiBand ──────────────────────────────────────────────────────────────────

describe("aqiBand", () => {
  it("returns dash for null", () => {
    expect(aqiBand(null).label).toBe("—");
    expect(aqiBand(null).color).toBe("var(--text-3)");
  });

  it("AQI 0–50 → good", () => {
    expect(aqiBand(0).label).toBe("good");
    expect(aqiBand(50).label).toBe("good");
    expect(aqiBand(0).color).toBe("var(--good)");
  });

  it("AQI 51–100 → moderate", () => {
    expect(aqiBand(51).label).toBe("moderate");
    expect(aqiBand(100).label).toBe("moderate");
    expect(aqiBand(51).color).toBe("var(--warn)");
  });

  it("AQI 101–150 → unhealthy SG", () => {
    expect(aqiBand(101).label).toBe("unhealthy SG");
    expect(aqiBand(150).label).toBe("unhealthy SG");
    expect(aqiBand(101).color).toBe("var(--bad)");
  });

  it("AQI 151–200 → unhealthy", () => {
    expect(aqiBand(151).label).toBe("unhealthy");
    expect(aqiBand(200).label).toBe("unhealthy");
  });

  it("AQI > 200 → hazardous", () => {
    expect(aqiBand(201).label).toBe("hazardous");
    expect(aqiBand(500).label).toBe("hazardous");
    expect(aqiBand(201).color).toBe("var(--crit)");
  });
});

// ─── rainBadge ────────────────────────────────────────────────────────────────

function nowcast(overrides: Partial<PrecipNowcast> = {}): PrecipNowcast {
  return {
    nowMm: 0,
    total2hMm: 0,
    peakMm: 0,
    peakAt: null,
    firstSignificantAt: null,
    minutesToSignificant: null,
    intensity: "dry",
    ...overrides,
  };
}

describe("rainBadge", () => {
  it("returns loading state for null", () => {
    const b = rainBadge(null);
    expect(b.label).toBe("—");
    expect(b.color).toBe("var(--text-3)");
  });

  it("dry: label DRY 2H with total forecast in sub", () => {
    const b = rainBadge(nowcast({ intensity: "dry", total2hMm: 1.3 }));
    expect(b.label).toBe("DRY 2H");
    expect(b.sub).toContain("1.3");
    expect(b.color).toBe("var(--good)");
  });

  it("heavy + minutesToSignificant present → RAIN {n}m", () => {
    const b = rainBadge(nowcast({ intensity: "heavy", minutesToSignificant: 15, peakMm: 8, total2hMm: 22.5 }));
    expect(b.label).toBe("RAIN 15m");
    expect(b.sub).toContain("8 mm");
    expect(b.sub).toContain("22.5 mm / 2h");
    expect(b.color).toBe("var(--bad)");
  });

  it("heavy + no minutesToSignificant → RAIN NOW", () => {
    const b = rainBadge(nowcast({ intensity: "heavy", minutesToSignificant: null, peakMm: 5, total2hMm: 10 }));
    expect(b.label).toBe("RAIN NOW");
  });

  it("moderate → warn colour", () => {
    const b = rainBadge(nowcast({ intensity: "moderate", minutesToSignificant: 30, peakMm: 3, total2hMm: 8 }));
    expect(b.label).toBe("RAIN 30m");
    expect(b.color).toBe("var(--warn)");
  });

  it("light (drizzle) → data colour", () => {
    const b = rainBadge(nowcast({ intensity: "light", minutesToSignificant: 45, peakMm: 0.5, total2hMm: 1.2 }));
    expect(b.label).toBe("DRIZZLE 45m");
    expect(b.color).toBe("var(--data)");
  });

  it("light + no minutesToSignificant → DRIZZLE", () => {
    const b = rainBadge(nowcast({ intensity: "light", minutesToSignificant: null, peakMm: 0.3, total2hMm: 0.8 }));
    expect(b.label).toBe("DRIZZLE");
  });
});

// ─── hmFromIso ────────────────────────────────────────────────────────────────

describe("hmFromIso", () => {
  it("returns '—' for null", () => {
    expect(hmFromIso(null)).toBe("—");
  });

  it("returns '—' for invalid ISO string", () => {
    expect(hmFromIso("not-a-date")).toBe("—");
  });

  it("formats a known UTC time correctly in Bangkok (UTC+7)", () => {
    // 2025-01-15T06:00:00Z = 13:00 Bangkok time
    expect(hmFromIso("2025-01-15T06:00:00Z", "Asia/Bangkok")).toBe("13:00");
  });

  it("formats a known UTC time correctly in UTC", () => {
    expect(hmFromIso("2025-06-01T09:30:00Z", "UTC")).toBe("09:30");
  });

  it("defaults to Asia/Bangkok timezone", () => {
    // 2025-01-15T00:00:00Z = 07:00 Bangkok
    expect(hmFromIso("2025-01-15T00:00:00Z")).toBe("07:00");
  });
});

// ─── timeInTz ─────────────────────────────────────────────────────────────────

describe("timeInTz", () => {
  // Fix a known moment: 2025-06-01T08:00:00Z = 15:00:00 Bangkok
  const KNOWN = new Date("2025-06-01T08:00:00Z");

  it("hm is HH:MM in the target timezone", () => {
    expect(timeInTz("Asia/Bangkok", KNOWN).hm).toBe("15:00");
  });

  it("hms includes seconds in HH:MM:SS format", () => {
    expect(timeInTz("Asia/Bangkok", KNOWN).hms).toBe("15:00:00");
  });

  it("offset is a non-empty string (e.g. GMT+7)", () => {
    const { offset } = timeInTz("Asia/Bangkok", KNOWN);
    expect(offset.length).toBeGreaterThan(0);
    expect(offset).toContain("7");
  });

  it("UTC timezone yields correct time", () => {
    const { hm, hms } = timeInTz("UTC", KNOWN);
    expect(hm).toBe("08:00");
    expect(hms).toBe("08:00:00");
  });

  it("London is UTC+1 in summer (BST)", () => {
    // June 1 → BST = UTC+1
    expect(timeInTz("Europe/London", KNOWN).hm).toBe("09:00");
  });
});
