import { describe, it, expect } from "vitest";
import { fmtN } from "./provincial";

/**
 * provincial.ts contract tests.
 *
 * fmtN() formats large numbers shown in the ProvincialKPIs panel —
 * population, budget figures, permit counts, etc. Getting the M/K
 * thresholds or rounding wrong silently misrepresents provincial data.
 *
 * Covered:
 *   - null / undefined / NaN → "—"
 *   - ≥ 1,000,000 → "1.0M" (1dp)
 *   - ≥ 1,000 → "1K" (0dp)
 *   - < 1,000 → toFixed(decimals)
 *   - Exact boundary values (1000, 1000000)
 *   - Custom decimals parameter
 */

describe("fmtN", () => {
  it("returns '—' for null", () => {
    expect(fmtN(null)).toBe("—");
  });

  it("returns '—' for undefined", () => {
    expect(fmtN(undefined)).toBe("—");
  });

  it("returns '—' for NaN", () => {
    expect(fmtN(NaN)).toBe("—");
  });

  it("formats millions with 1dp and M suffix", () => {
    expect(fmtN(1_000_000)).toBe("1.0M");
    expect(fmtN(1_500_000)).toBe("1.5M");
    expect(fmtN(2_700_000)).toBe("2.7M");
    expect(fmtN(10_000_000)).toBe("10.0M");
  });

  it("formats thousands with 0dp and K suffix", () => {
    expect(fmtN(1_000)).toBe("1K");
    expect(fmtN(5_500)).toBe("6K");  // rounded
    expect(fmtN(999_999)).toBe("1000K");  // just under 1M
  });

  it("formats sub-thousand values with default 0 decimal places", () => {
    expect(fmtN(0)).toBe("0");
    expect(fmtN(42)).toBe("42");
    expect(fmtN(999)).toBe("999");
    expect(fmtN(3.7)).toBe("4");
  });

  it("respects custom decimals for sub-thousand values", () => {
    expect(fmtN(3.14159, 2)).toBe("3.14");
    expect(fmtN(42, 1)).toBe("42.0");
  });

  it("exactly 1,000,000 uses M suffix, not K", () => {
    expect(fmtN(1_000_000)).toBe("1.0M");
  });

  it("exactly 1,000 uses K suffix", () => {
    expect(fmtN(1_000)).toBe("1K");
  });
});
