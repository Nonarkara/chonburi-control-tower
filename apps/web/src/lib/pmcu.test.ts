import { describe, it, expect } from "vitest";
import { hourlyLoad } from "./pmcu";

/**
 * pmcu.ts model contract tests.
 *
 * hourlyLoad drives the PART MODELLED municipality panel used by operators
 * to assess service pressure. Getting the model wrong (e.g. peak at wrong
 * hour, weekend factor inverted) silently misleads dispatch decisions.
 *
 * Covered:
 *   - Output is always in [0.12, 1.15] (overnight floor, cap)
 *   - Morning peak (08:00) beats overnight (03:00)
 *   - Evening peak (17:30) beats midday (12:00)
 *   - Weekend load < weekday load at peak hours
 *   - Overnight hours produce the minimum base load
 */

describe("hourlyLoad — output bounds", () => {
  it("returns a value in [0.12, 1.15] for all hours", () => {
    for (let h = 0; h < 24; h++) {
      const weekday = hourlyLoad(h, false);
      const weekend = hourlyLoad(h, true);
      expect(weekday).toBeGreaterThanOrEqual(0.12);
      expect(weekday).toBeLessThanOrEqual(1.15);
      expect(weekend).toBeGreaterThanOrEqual(0.12);
      expect(weekend).toBeLessThanOrEqual(1.15);
    }
  });
});

describe("hourlyLoad — peak hours", () => {
  it("morning peak (08:00) is higher than overnight (03:00)", () => {
    expect(hourlyLoad(8, false)).toBeGreaterThan(hourlyLoad(3, false));
  });

  it("evening peak (17:30) is higher than midday (12:00)", () => {
    expect(hourlyLoad(17.5, false)).toBeGreaterThan(hourlyLoad(12, false));
  });

  it("peak weekday load is at or near the cap (≥ 0.9)", () => {
    const morningLoad = hourlyLoad(8, false);
    expect(morningLoad).toBeGreaterThanOrEqual(0.9);
  });
});

describe("hourlyLoad — overnight floor", () => {
  it("returns overnight base (≈ 0.12 + small offset) at 03:00", () => {
    const overnight = hourlyLoad(3, false);
    // Gaussian contribution at h=3 is negligible; result ≈ 0.12 + tiny
    expect(overnight).toBeLessThan(0.25);
  });

  it("returns overnight base at 23:00", () => {
    const lateNight = hourlyLoad(23, false);
    expect(lateNight).toBeLessThan(0.25);
  });
});

describe("hourlyLoad — weekend modifier", () => {
  it("weekend load is lower than weekday at morning peak", () => {
    expect(hourlyLoad(8, true)).toBeLessThan(hourlyLoad(8, false));
  });

  it("weekend load is lower than weekday at evening peak", () => {
    expect(hourlyLoad(17.5, true)).toBeLessThan(hourlyLoad(17.5, false));
  });

  it("weekend and weekday overnight are the same (no Gaussian contribution)", () => {
    // At 03:00 both weekends/weekdays should produce ≈ same overnight baseline
    expect(hourlyLoad(3, true)).toBeCloseTo(hourlyLoad(3, false), 5);
  });
});
