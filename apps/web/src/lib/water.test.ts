import { describe, it, expect } from "vitest";
import { alertLevel } from "./water";

/**
 * water.ts contract tests.
 *
 * alertLevel() drives the visual severity indicator in the WaterPanel
 * reservoir list. Operators rely on this to identify critically low
 * water supply at a glance.
 *
 * Covered:
 *   - null days → "ok" (unknown, don't alarm)
 *   - < 10 → "critical"
 *   - < 30 → "low"
 *   - < 120 → "watch"
 *   - ≥ 120 → "ok"
 *   - Exact boundary values (10, 30, 120)
 */

describe("alertLevel", () => {
  it("returns 'ok' for null (unknown supply)", () => {
    expect(alertLevel(null)).toBe("ok");
  });

  it("returns 'critical' for days < 10", () => {
    expect(alertLevel(0)).toBe("critical");
    expect(alertLevel(1)).toBe("critical");
    expect(alertLevel(9)).toBe("critical");
    expect(alertLevel(9.9)).toBe("critical");
  });

  it("returns 'low' at exactly 10 days", () => {
    expect(alertLevel(10)).toBe("low");
  });

  it("returns 'low' for days in [10, 30)", () => {
    expect(alertLevel(10)).toBe("low");
    expect(alertLevel(20)).toBe("low");
    expect(alertLevel(29)).toBe("low");
    expect(alertLevel(29.9)).toBe("low");
  });

  it("returns 'watch' at exactly 30 days", () => {
    expect(alertLevel(30)).toBe("watch");
  });

  it("returns 'watch' for days in [30, 120)", () => {
    expect(alertLevel(30)).toBe("watch");
    expect(alertLevel(60)).toBe("watch");
    expect(alertLevel(119)).toBe("watch");
    expect(alertLevel(119.9)).toBe("watch");
  });

  it("returns 'ok' at exactly 120 days", () => {
    expect(alertLevel(120)).toBe("ok");
  });

  it("returns 'ok' for days ≥ 120", () => {
    expect(alertLevel(120)).toBe("ok");
    expect(alertLevel(365)).toBe("ok");
    expect(alertLevel(1000)).toBe("ok");
  });
});
