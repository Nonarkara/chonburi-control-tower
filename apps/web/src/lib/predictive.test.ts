import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatAge, peakLabel } from "./predictive";

/**
 * predictive.ts contract tests.
 *
 * formatAge and peakLabel drive the PredictivePanel TimesFM forecast strips.
 * Getting these wrong silently shows stale-age badges or wrong peak values
 * to operators assessing upcoming AQI, tide, or incident spikes.
 *
 * Covered:
 *   - formatAge: null → "", sub-hour → "Nm ago", ≥1h → "Nh ago"
 *   - peakLabel: empty → "—", with unit, without unit, correct max
 */

// ─── formatAge ───────────────────────────────────────────────────────────────

describe("formatAge", () => {
  const BASE_MS = 1_700_000_000_000; // fixed reference epoch

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns '' for null", () => {
    expect(formatAge(null)).toBe("");
  });

  it("returns '0m ago' for a just-generated forecast (< 1 min)", () => {
    const iso = new Date(BASE_MS - 10_000).toISOString(); // 10 seconds ago
    expect(formatAge(iso)).toBe("0m ago");
  });

  it("returns 'Nm ago' for sub-hour age", () => {
    const iso30 = new Date(BASE_MS - 30 * 60_000).toISOString(); // 30 min ago
    expect(formatAge(iso30)).toBe("30m ago");

    const iso59 = new Date(BASE_MS - 59 * 60_000).toISOString();
    expect(formatAge(iso59)).toBe("59m ago");
  });

  it("returns 'Nh ago' for age ≥ 60 min", () => {
    const iso1h = new Date(BASE_MS - 60 * 60_000).toISOString(); // exactly 1h
    expect(formatAge(iso1h)).toBe("1h ago");

    const iso3h = new Date(BASE_MS - 3 * 60 * 60_000).toISOString();
    expect(formatAge(iso3h)).toBe("3h ago");
  });
});

// ─── peakLabel ───────────────────────────────────────────────────────────────

describe("peakLabel", () => {
  it("returns '—' for empty points array", () => {
    expect(peakLabel([], "mm")).toBe("—");
  });

  it("returns 'N.N unit peak' when unit is provided", () => {
    const points = [
      { time: "t1", p50: 2.5, p10: null, p90: null },
      { time: "t2", p50: 5.0, p10: null, p90: null },
      { time: "t3", p50: 3.1, p10: null, p90: null },
    ];
    expect(peakLabel(points, "mm")).toBe("5.0 mm peak");
  });

  it("returns 'N.N peak' when unit is empty string", () => {
    const points = [
      { time: "t1", p50: 42, p10: null, p90: null },
    ];
    expect(peakLabel(points, "")).toBe("42.0 peak");
  });

  it("picks the correct maximum across all p50 values", () => {
    const points = [
      { time: "t1", p50: 10, p10: null, p90: null },
      { time: "t2", p50: 99, p10: null, p90: null },
      { time: "t3", p50: 50, p10: null, p90: null },
    ];
    expect(peakLabel(points, "AQI")).toBe("99.0 AQI peak");
  });

  it("formats the peak to exactly 1 decimal place", () => {
    const points = [{ time: "t1", p50: 7, p10: null, p90: null }];
    expect(peakLabel(points, "m")).toBe("7.0 m peak");
  });
});
