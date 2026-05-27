import { describe, it, expect } from "vitest";
import { zoneStatus, ZONES } from "./fishery";
import type { MarineSnapshot, TideSnapshot, FisheryZone } from "./fishery";

/**
 * fishery.ts zoneStatus contract tests.
 *
 * The zone assessment drives per-zone traffic lights in FisheryPanel. Getting
 * a threshold wrong could mean operators send boats out in unsafe conditions
 * or close zones unnecessarily during good weather.
 *
 * Covered:
 *   - null marine → caution "No marine data"
 *   - All conditions good → go "All clear"
 *   - Wave, SST, runoff, spring-tide triggers individually
 *   - Escalation: wave > 1.5× threshold or SST > limit+1 → hold
 *   - Offshore zone is immune to runoff and spring-tide triggers
 *   - Multiple reasons join with " · "
 *   - ZONES data contract (5 zones, all have required fields)
 */

function marine(overrides: Partial<MarineSnapshot> = {}): MarineSnapshot {
  return {
    waveHeightM:  0.3,
    windKmh:      10,
    sstC:         28,
    swellHeightM: 0.2,
    thermalStress: false,
    smallBoatSafe: true,
    ...overrides,
  };
}

function tide(springTide = false): TideSnapshot {
  return { springTide, heightM: 1.0 };
}

// Use the Ang Sila oyster zone for most tests (waveThreshold=0.8, sstLimit=31)
const ANGSILA = ZONES.find(z => z.id === "angsila")!;
const OFFSHORE = ZONES.find(z => z.id === "offshore")!;
const BANGSAEN = ZONES.find(z => z.id === "bangsaen")!;

// ─── null marine ──────────────────────────────────────────────────────────

describe("zoneStatus — null marine", () => {
  it("returns caution with 'No marine data' when marine is null", () => {
    const { level, reason } = zoneStatus(ANGSILA, null, tide(), 0);
    expect(level).toBe("caution");
    expect(reason).toBe("No marine data");
  });

  it("still returns caution for null marine even if precip is high", () => {
    const { level } = zoneStatus(ANGSILA, null, tide(true), 50);
    expect(level).toBe("caution");
  });
});

// ─── All clear ────────────────────────────────────────────────────────────

describe("zoneStatus — all clear (go)", () => {
  it("returns go when all conditions are within limits", () => {
    const { level, reason } = zoneStatus(ANGSILA, marine(), tide(), 0);
    expect(level).toBe("go");
    expect(reason).toBe("All clear");
  });

  it("nulls in marine snapshot default to safe values (wave=0, sst=28)", () => {
    const { level } = zoneStatus(ANGSILA, marine({ waveHeightM: null, sstC: null }), tide(), null);
    expect(level).toBe("go");
  });
});

// ─── Wave trigger ─────────────────────────────────────────────────────────

describe("zoneStatus — wave threshold", () => {
  it("returns caution when wave just exceeds threshold", () => {
    // ANGSILA threshold = 0.8 m → 0.81 exceeds it
    const { level, reason } = zoneStatus(ANGSILA, marine({ waveHeightM: 0.81 }), tide(), 0);
    expect(level).toBe("caution");
    expect(reason).toContain("wave 0.8m");
  });

  it("escalates to hold when wave > 1.5 × threshold", () => {
    // 0.8 × 1.5 = 1.2 → 1.21 should trigger hold
    const { level } = zoneStatus(ANGSILA, marine({ waveHeightM: 1.21 }), tide(), 0);
    expect(level).toBe("hold");
  });

  it("does not trigger when wave is exactly at threshold", () => {
    // 0.8 m exactly is NOT > 0.8 → no trigger
    const { level } = zoneStatus(ANGSILA, marine({ waveHeightM: 0.8 }), tide(), 0);
    expect(level).toBe("go");
  });
});

// ─── SST trigger ──────────────────────────────────────────────────────────

describe("zoneStatus — SST threshold", () => {
  it("returns caution when SST just exceeds sstLimit", () => {
    // ANGSILA sstLimit = 31 → 31.1 triggers
    const { level, reason } = zoneStatus(ANGSILA, marine({ sstC: 31.1 }), tide(), 0);
    expect(level).toBe("caution");
    expect(reason).toContain("SST 31.1°C");
  });

  it("escalates to hold when SST > sstLimit + 1", () => {
    // sstLimit = 31 → 32.1 triggers hold
    const { level } = zoneStatus(ANGSILA, marine({ sstC: 32.1 }), tide(), 0);
    expect(level).toBe("hold");
  });

  it("does not trigger when SST is exactly at sstLimit", () => {
    const { level } = zoneStatus(ANGSILA, marine({ sstC: 31 }), tide(), 0);
    expect(level).toBe("go");
  });
});

// ─── Runoff trigger ────────────────────────────────────────────────────────

describe("zoneStatus — runoff risk (precipMm > 20)", () => {
  it("adds runoff risk reason when precipMm > 20 for coastal zones", () => {
    const { level, reason } = zoneStatus(ANGSILA, marine(), tide(), 21);
    expect(level).toBe("caution");
    expect(reason).toContain("runoff risk");
  });

  it("does NOT add runoff risk at exactly 20 mm (strictly greater)", () => {
    const { level } = zoneStatus(ANGSILA, marine(), tide(), 20);
    expect(level).toBe("go");
  });

  it("offshore zone is immune to runoff risk trigger", () => {
    const { level, reason } = zoneStatus(OFFSHORE, marine(), tide(), 50);
    expect(level).toBe("go");
    expect(reason).not.toContain("runoff");
  });
});

// ─── Spring tide trigger ───────────────────────────────────────────────────

describe("zoneStatus — spring tide", () => {
  it("adds spring tide reason for coastal zones during spring tide", () => {
    const { reason } = zoneStatus(ANGSILA, marine(), tide(true), 0);
    expect(reason).toContain("spring tide");
  });

  it("offshore zone is immune to spring tide trigger", () => {
    const { level } = zoneStatus(OFFSHORE, marine(), tide(true), 0);
    expect(level).toBe("go"); // spring tide + offshore → no trigger
  });

  it("null tide is treated as no spring tide", () => {
    const { level } = zoneStatus(ANGSILA, marine(), null, 0);
    expect(level).toBe("go");
  });
});

// ─── Multiple reasons ──────────────────────────────────────────────────────

describe("zoneStatus — multiple simultaneous triggers", () => {
  it("joins multiple reasons with ' · '", () => {
    // Wave + SST both just over threshold → caution with two reasons
    const { level, reason } = zoneStatus(
      ANGSILA,
      marine({ waveHeightM: 0.9, sstC: 31.5 }),
      tide(),
      0,
    );
    expect(level).toBe("caution");
    expect(reason).toContain(" · ");
    expect(reason).toContain("wave");
    expect(reason).toContain("SST");
  });

  it("hold takes precedence when wave escalation is true even if other reasons are minor", () => {
    // Wave=1.5 (=1.875 > 0.8 threshold, exceeds 1.2 hold threshold), SST ok
    const { level } = zoneStatus(ANGSILA, marine({ waveHeightM: 1.5 }), tide(), 0);
    expect(level).toBe("hold");
  });
});

// ─── ZONES data contract ──────────────────────────────────────────────────

describe("ZONES configuration", () => {
  it("has exactly 5 zones", () => {
    expect(ZONES).toHaveLength(5);
  });

  it("every zone has required fields", () => {
    for (const z of ZONES) {
      expect(z.id.length).toBeGreaterThan(0);
      expect(z.nameTh.length).toBeGreaterThan(0);
      expect(z.nameEn.length).toBeGreaterThan(0);
      expect(z.waveThreshold).toBeGreaterThan(0);
      expect(z.sstLimit).toBeGreaterThan(25);
    }
  });

  it("wave thresholds increase from near-shore to offshore", () => {
    // Offshore should have highest wave threshold
    const maxThreshold = Math.max(...ZONES.map(z => z.waveThreshold));
    expect(OFFSHORE.waveThreshold).toBe(maxThreshold);
  });

  it("shrimp zone (Bang Saen) has the lowest wave threshold — most sensitive", () => {
    const minThreshold = Math.min(...ZONES.map(z => z.waveThreshold));
    expect(BANGSAEN.waveThreshold).toBe(minThreshold);
  });
});

// ─── Zone-specific thresholds ──────────────────────────────────────────────

describe("zoneStatus — zone-specific thresholds", () => {
  it("a wave safe for offshore (2.0 m) still triggers caution for Ang Sila (threshold 0.8)", () => {
    const onshore = zoneStatus(ANGSILA,  marine({ waveHeightM: 2.0 }), tide(), 0);
    const offshore = zoneStatus(OFFSHORE, marine({ waveHeightM: 2.0 }), tide(), 0);
    expect(onshore.level).not.toBe("go");   // definitely not safe for oysters
    expect(offshore.level).toBe("go");       // fine for offshore ops
  });
});
