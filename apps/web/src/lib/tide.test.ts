import { describe, it, expect } from "vitest";
import { fmtCountdown, moonEmoji } from "./tide";

/**
 * tide.ts display-helper contract tests.
 *
 * fmtCountdown and moonEmoji drive the TidePanel UI — getting them wrong
 * means operators see wrong countdown times or wrong moon-phase glyphs
 * next to spring/neap tide warnings.
 *
 * Covered:
 *   - fmtCountdown: past, sub-hour, whole hours, fractional hours
 *   - moonEmoji: boundary values for all 8 lunar phases
 */

// ─── fmtCountdown ─────────────────────────────────────────────────────────────

describe("fmtCountdown", () => {
  it("returns '—' for negative hours (already past)", () => {
    expect(fmtCountdown(-0.01)).toBe("—");
    expect(fmtCountdown(-5)).toBe("—");
  });

  it("returns minutes only when less than 1 hour", () => {
    expect(fmtCountdown(0)).toBe("0m");
    expect(fmtCountdown(0.5)).toBe("30m");
    expect(fmtCountdown(0.25)).toBe("15m");
    expect(fmtCountdown(0.999)).toBe("60m"); // rounds up to 60m, not 1h 0m
  });

  it("returns hours + minutes for whole hours", () => {
    expect(fmtCountdown(1)).toBe("1h 0m");
    expect(fmtCountdown(2)).toBe("2h 0m");
    expect(fmtCountdown(12)).toBe("12h 0m");
  });

  it("returns hours + rounded minutes for fractional hours", () => {
    expect(fmtCountdown(1.5)).toBe("1h 30m");
    expect(fmtCountdown(2.25)).toBe("2h 15m");
    expect(fmtCountdown(3.75)).toBe("3h 45m");
  });

  it("rounds minutes correctly at the boundary", () => {
    // 1 + 1/60 hours → 0.01666... * 60 = 0.9999... → rounds to 1m
    expect(fmtCountdown(1 + 1 / 60)).toBe("1h 1m");
  });
});

// ─── moonEmoji ────────────────────────────────────────────────────────────────

describe("moonEmoji", () => {
  it("returns 🌑 for new moon (phase ≈ 0)", () => {
    expect(moonEmoji(0)).toBe("🌑");
    expect(moonEmoji(0.01)).toBe("🌑");
    expect(moonEmoji(0.03)).toBe("🌑");
  });

  it("returns 🌑 for phase near 1 (waning back to new)", () => {
    expect(moonEmoji(0.97)).toBe("🌑");
    expect(moonEmoji(1.0)).toBe("🌑"); // treated as 0 (mod 1)
  });

  it("returns 🌒 for waxing crescent (phase 0.04–0.20)", () => {
    expect(moonEmoji(0.04)).toBe("🌒");
    expect(moonEmoji(0.12)).toBe("🌒");
    expect(moonEmoji(0.20)).toBe("🌒");
  });

  it("returns 🌓 for first quarter (phase 0.21–0.28)", () => {
    expect(moonEmoji(0.21)).toBe("🌓");
    expect(moonEmoji(0.25)).toBe("🌓");
    expect(moonEmoji(0.28)).toBe("🌓");
  });

  it("returns 🌔 for waxing gibbous (phase 0.29–0.45)", () => {
    expect(moonEmoji(0.29)).toBe("🌔");
    expect(moonEmoji(0.38)).toBe("🌔");
    expect(moonEmoji(0.45)).toBe("🌔");
  });

  it("returns 🌕 for full moon (phase 0.46–0.53)", () => {
    expect(moonEmoji(0.46)).toBe("🌕");
    expect(moonEmoji(0.5)).toBe("🌕");
    expect(moonEmoji(0.53)).toBe("🌕");
  });

  it("returns 🌖 for waning gibbous (phase 0.54–0.70)", () => {
    expect(moonEmoji(0.54)).toBe("🌖");
    expect(moonEmoji(0.62)).toBe("🌖");
    expect(moonEmoji(0.70)).toBe("🌖");
  });

  it("returns 🌗 for last quarter (phase 0.71–0.78)", () => {
    expect(moonEmoji(0.71)).toBe("🌗");
    expect(moonEmoji(0.75)).toBe("🌗");
    expect(moonEmoji(0.78)).toBe("🌗");
  });

  it("returns 🌘 for waning crescent (phase 0.79–0.95)", () => {
    expect(moonEmoji(0.79)).toBe("🌘");
    expect(moonEmoji(0.87)).toBe("🌘");
    expect(moonEmoji(0.95)).toBe("🌘");
  });
});
