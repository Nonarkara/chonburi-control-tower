import { describe, it, expect } from "vitest";
import { scoreColor } from "./newsDesk";

/**
 * newsDesk.ts contract tests.
 *
 * scoreColor drives the severity tint on Traffy Fondue complaint cards.
 * Getting a threshold wrong silently shows green for a high-profile issue.
 *
 * Covered:
 *   - score ≥ 1000 → --bad
 *   - score ≥ 500  → --warn
 *   - score < 500  → --text-3
 *   - Exact boundary values (500, 1000)
 */

describe("scoreColor", () => {
  it("returns --bad for score ≥ 1000", () => {
    expect(scoreColor(1000)).toBe("var(--bad)");
    expect(scoreColor(1500)).toBe("var(--bad)");
    expect(scoreColor(9999)).toBe("var(--bad)");
  });

  it("returns --warn for score in [500, 1000)", () => {
    expect(scoreColor(500)).toBe("var(--warn)");
    expect(scoreColor(750)).toBe("var(--warn)");
    expect(scoreColor(999)).toBe("var(--warn)");
  });

  it("returns --text-3 for score < 500", () => {
    expect(scoreColor(0)).toBe("var(--text-3)");
    expect(scoreColor(100)).toBe("var(--text-3)");
    expect(scoreColor(499)).toBe("var(--text-3)");
  });

  it("returns --bad at exactly 1000 (boundary)", () => {
    expect(scoreColor(1000)).toBe("var(--bad)");
  });

  it("returns --warn at exactly 500 (boundary)", () => {
    expect(scoreColor(500)).toBe("var(--warn)");
  });
});
