import { describe, it, expect } from "vitest";
import { maxAqiNext8h, fmtHour } from "./aqi";

/**
 * aqi.ts contract tests.
 *
 * maxAqiNext8h drives the PEAK 8H display in AqiBadge — operators and
 * the mayor use the forecast peak to decide whether to issue health
 * advisories. Getting it wrong silently shows a lower peak than reality.
 *
 * fmtHour drives the sparkline x-axis and foot timestamp.
 *
 * Covered:
 *   - maxAqiNext8h: all null next8h → current, null current → 0,
 *     all null → 0, mixed null/values, multiple max candidates
 *   - fmtHour: midnight, noon, single-digit hours (zero-padded)
 */

// ─── maxAqiNext8h ─────────────────────────────────────────────────────────────

describe("maxAqiNext8h", () => {
  it("returns current AQI when all next8h points are null", () => {
    expect(maxAqiNext8h({
      current: { aqi: 75 },
      next8h: [{ at: "t1", aqi: null }, { at: "t2", aqi: null }],
    })).toBe(75);
  });

  it("returns 0 when current and all next8h are null", () => {
    expect(maxAqiNext8h({
      current: { aqi: null },
      next8h: [{ at: "t1", aqi: null }],
    })).toBe(0);
  });

  it("returns 0 for empty next8h and null current", () => {
    expect(maxAqiNext8h({ current: { aqi: null }, next8h: [] })).toBe(0);
  });

  it("returns current when next8h is empty", () => {
    expect(maxAqiNext8h({ current: { aqi: 42 }, next8h: [] })).toBe(42);
  });

  it("returns the max of current + next8h", () => {
    expect(maxAqiNext8h({
      current: { aqi: 50 },
      next8h: [
        { at: "t1", aqi: 80 },
        { at: "t2", aqi: 120 },
        { at: "t3", aqi: 90 },
      ],
    })).toBe(120);
  });

  it("returns current when it exceeds all forecast points", () => {
    expect(maxAqiNext8h({
      current: { aqi: 200 },
      next8h: [{ at: "t1", aqi: 100 }, { at: "t2", aqi: 150 }],
    })).toBe(200);
  });

  it("filters out null forecast points before taking max", () => {
    expect(maxAqiNext8h({
      current: { aqi: 50 },
      next8h: [
        { at: "t1", aqi: null },
        { at: "t2", aqi: 130 },
        { at: "t3", aqi: null },
      ],
    })).toBe(130);
  });
});

// ─── fmtHour ─────────────────────────────────────────────────────────────────

describe("fmtHour", () => {
  it("formats midnight as '00h'", () => {
    // Use a fixed date string to avoid TZ issues (local midnight)
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    expect(fmtHour(midnight.toISOString())).toBe("00h");
  });

  it("formats noon as '12h'", () => {
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    expect(fmtHour(noon.toISOString())).toBe("12h");
  });

  it("zero-pads single-digit hours", () => {
    const morning = new Date();
    morning.setHours(8, 0, 0, 0);
    expect(fmtHour(morning.toISOString())).toBe("08h");
  });

  it("formats 23:xx as '23h'", () => {
    const late = new Date();
    late.setHours(23, 30, 0, 0);
    expect(fmtHour(late.toISOString())).toBe("23h");
  });
});
