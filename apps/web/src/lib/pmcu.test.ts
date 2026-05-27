import { describe, it, expect } from "vitest";
import { hourlyLoad, zoneOccupancy, type ParkingZone } from "./pmcu";

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

// ─── zoneOccupancy ───────────────────────────────────────────────────────────

function zone(id: string): ParkingZone {
  return { id, name: `Zone ${id}`, capacity: 300 };
}

describe("zoneOccupancy — output bounds", () => {
  it("always returns a value in [0, 0.98]", () => {
    for (let h = 0; h < 24; h++) {
      for (const id of ["P1", "P2", "P3", "P4"]) {
        const occ = zoneOccupancy(zone(id), h, false);
        expect(occ).toBeGreaterThanOrEqual(0);
        expect(occ).toBeLessThanOrEqual(0.98);
      }
    }
  });
});

describe("zoneOccupancy — peak vs overnight", () => {
  it("P1 daytime (10:00) has higher occupancy than overnight (03:00)", () => {
    expect(zoneOccupancy(zone("P1"), 10, false)).toBeGreaterThan(
      zoneOccupancy(zone("P1"), 3, false),
    );
  });

  it("overnight (02:00) uses the low overnight floor (< 0.15)", () => {
    // At 02:00 adjusted < 6, overnight = 0.05, Gaussians ~ 0 → base ≈ 0.05
    expect(zoneOccupancy(zone("P1"), 2, false)).toBeLessThan(0.15);
  });
});

describe("zoneOccupancy — weekend modifier", () => {
  it("weekend occupancy is lower than weekday at peak hours", () => {
    expect(zoneOccupancy(zone("P1"), 10, true)).toBeLessThan(
      zoneOccupancy(zone("P1"), 10, false),
    );
  });
});

describe("zoneOccupancy — zone offset stagger", () => {
  it("adjacent zones reach their peak at slightly different hours", () => {
    // P1 offset = 0, P2 offset = 0.35 — peak shifts slightly
    // At exactly the P1 morning peak time, P2 hasn't peaked yet or has shifted
    const p1At10 = zoneOccupancy(zone("P1"), 9.5, false);
    const p2At10 = zoneOccupancy(zone("P2"), 9.5 - 0.35, false); // back-shifted to P2 native peak
    expect(p1At10).toBeCloseTo(p2At10, 1); // same peak magnitude, different time
  });
});
