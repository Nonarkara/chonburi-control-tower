import { describe, it, expect } from "vitest";
import { fmtValue, fmtPct, arrow, tickColor } from "./markets";

/**
 * markets.ts display-helper contract tests.
 *
 * fmtValue, fmtPct, arrow, and tickColor drive the MarketsTicker component.
 * Getting thresholds wrong silently shows wrong decimal places or wrong
 * up/down arrows to operators monitoring regional market conditions.
 *
 * Covered:
 *   - fmtValue: null → "—", forex (≥100 vs <100 precision), macro, large numbers, default
 *   - fmtPct: null → "", positive with +, negative, zero
 *   - arrow: null → "·", above dead-zone → ▲, below → ▼, in dead-zone → ·
 *   - tickColor: null → muted, positive → good, negative → bad, neutral → text-2
 */

// ─── fmtValue ────────────────────────────────────────────────────────────────

describe("fmtValue", () => {
  it("returns '—' for null", () => {
    expect(fmtValue(null, "default")).toBe("—");
  });

  it("formats forex ≥ 100 with 2 decimal places (e.g. USD/THB)", () => {
    expect(fmtValue(34.1, "forex")).toBe("34.1000");    // < 100 → 4dp
    expect(fmtValue(100, "forex")).toBe("100.00");       // ≥ 100 → 2dp
    expect(fmtValue(33.45, "forex")).toBe("33.4500");    // < 100 → 4dp, exact
  });

  it("formats forex < 100 with 4 decimal places (e.g. EUR/USD)", () => {
    expect(fmtValue(1.0876, "forex")).toBe("1.0876");   // exact 4dp
    expect(fmtValue(0.73, "forex")).toBe("0.7300");
  });

  it("formats macro group with always 2 decimal places", () => {
    expect(fmtValue(4.5678, "macro")).toBe("4.57");
    expect(fmtValue(0.1, "macro")).toBe("0.10");
  });

  it("formats values ≥ 1000 with comma separators and 0 decimal places", () => {
    expect(fmtValue(1234, "equities")).toBe("1,234");
    expect(fmtValue(42000, "index")).toBe("42,000");
  });

  it("formats values < 1000 with 2 decimal places in default group", () => {
    expect(fmtValue(99.5, "default")).toBe("99.50");
    expect(fmtValue(0.5, "other")).toBe("0.50");
  });
});

// ─── fmtPct ──────────────────────────────────────────────────────────────────

describe("fmtPct", () => {
  it("returns '' for null (no percent data)", () => {
    expect(fmtPct(null)).toBe("");
  });

  it("prepends '+' for positive changes", () => {
    expect(fmtPct(1.23)).toBe("+1.23%");
    expect(fmtPct(0.01)).toBe("+0.01%");
  });

  it("has no sign prefix for negative changes (the minus is in the number)", () => {
    expect(fmtPct(-1.23)).toBe("-1.23%");
  });

  it("formats zero as '0.00%' (no + prefix since 0 is not > 0)", () => {
    expect(fmtPct(0)).toBe("0.00%");
  });
});

// ─── arrow ───────────────────────────────────────────────────────────────────

describe("arrow", () => {
  it("returns '·' for null", () => {
    expect(arrow(null)).toBe("·");
  });

  it("returns '▲' when change > +0.05%", () => {
    expect(arrow(0.06)).toBe("▲");
    expect(arrow(5.0)).toBe("▲");
  });

  it("returns '▼' when change < -0.05%", () => {
    expect(arrow(-0.06)).toBe("▼");
    expect(arrow(-5.0)).toBe("▼");
  });

  it("returns '·' in the dead-zone (|change| ≤ 0.05%)", () => {
    expect(arrow(0)).toBe("·");
    expect(arrow(0.05)).toBe("·");
    expect(arrow(-0.05)).toBe("·");
    expect(arrow(0.04)).toBe("·");
  });
});

// ─── tickColor ───────────────────────────────────────────────────────────────

describe("tickColor", () => {
  it("returns muted text color for null", () => {
    expect(tickColor(null)).toBe("var(--text-3)");
  });

  it("returns good color for change > +0.05%", () => {
    expect(tickColor(0.1)).toBe("var(--good)");
    expect(tickColor(10)).toBe("var(--good)");
  });

  it("returns bad color for change < -0.05%", () => {
    expect(tickColor(-0.1)).toBe("var(--bad)");
    expect(tickColor(-10)).toBe("var(--bad)");
  });

  it("returns neutral text color in the dead-zone", () => {
    expect(tickColor(0)).toBe("var(--text-2)");
    expect(tickColor(0.05)).toBe("var(--text-2)");
    expect(tickColor(-0.05)).toBe("var(--text-2)");
  });
});
