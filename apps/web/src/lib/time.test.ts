import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ago, formatDate } from "./time";

/**
 * time.ts contract tests — verifies the unified `ago()` relative-time
 * formatter used by FacebookPanel and NewsTicker.
 *
 * Tests use fake timers so results don't depend on the real clock.
 *
 * Covered:
 *   - null / undefined / invalid ISO → "—"
 *   - sub-minute → "now"
 *   - minutes (1–59) → "Nm"
 *   - hours (1–23) → "Nh"
 *   - days (≥24h) → "Nd"
 *   - exact boundary values
 */

const BASE_ISO = "2026-05-27T12:00:00.000Z";
const BASE_MS  = new Date(BASE_ISO).getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(BASE_MS);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ago — invalid input", () => {
  it("returns '—' for null", () => {
    expect(ago(null)).toBe("—");
  });

  it("returns '—' for undefined", () => {
    expect(ago(undefined)).toBe("—");
  });

  it("returns '—' for a non-date string", () => {
    expect(ago("not-a-date")).toBe("—");
  });

  it("returns '—' for empty string", () => {
    expect(ago("")).toBe("—");
  });
});

describe("ago — sub-minute", () => {
  it("returns 'now' when the timestamp is exactly now", () => {
    expect(ago(BASE_ISO)).toBe("now");
  });

  it("returns 'now' for 20 seconds ago", () => {
    const iso = new Date(BASE_MS - 20_000).toISOString(); // 20s → 0.33m → rounds to 0
    expect(ago(iso)).toBe("now");
  });

  it("returns '1m' for 30 seconds ago (Math.round(0.5) = 1)", () => {
    // 30s / 60000ms = 0.5 → Math.round(0.5) = 1 in JS
    const iso = new Date(BASE_MS - 30_000).toISOString();
    expect(ago(iso)).toBe("1m");
  });
});

describe("ago — minutes", () => {
  it("returns '1m' for exactly 1 minute ago", () => {
    const iso = new Date(BASE_MS - 60_000).toISOString();
    expect(ago(iso)).toBe("1m");
  });

  it("returns '30m' for 30 minutes ago", () => {
    const iso = new Date(BASE_MS - 30 * 60_000).toISOString();
    expect(ago(iso)).toBe("30m");
  });

  it("returns '59m' for 59 minutes ago", () => {
    const iso = new Date(BASE_MS - 59 * 60_000).toISOString();
    expect(ago(iso)).toBe("59m");
  });
});

describe("ago — hours", () => {
  it("returns '1h' for exactly 60 minutes ago", () => {
    const iso = new Date(BASE_MS - 60 * 60_000).toISOString();
    expect(ago(iso)).toBe("1h");
  });

  it("returns '6h' for 6 hours ago", () => {
    const iso = new Date(BASE_MS - 6 * 3600_000).toISOString();
    expect(ago(iso)).toBe("6h");
  });

  it("returns '23h' for 23 hours ago", () => {
    const iso = new Date(BASE_MS - 23 * 3600_000).toISOString();
    expect(ago(iso)).toBe("23h");
  });
});

describe("ago — days", () => {
  it("returns '1d' for exactly 24 hours ago", () => {
    const iso = new Date(BASE_MS - 24 * 3600_000).toISOString();
    expect(ago(iso)).toBe("1d");
  });

  it("returns '7d' for one week ago", () => {
    const iso = new Date(BASE_MS - 7 * 24 * 3600_000).toISOString();
    expect(ago(iso)).toBe("7d");
  });
});

// ─── formatDate ───────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("formats a known date as uppercase 'DD MON YYYY'", () => {
    // 2025-01-15 in en-GB: "15 Jan 2025" → uppercased "15 JAN 2025"
    const d = new Date("2025-01-15T12:00:00Z");
    const result = formatDate(d);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/JAN/);
    expect(result).toMatch(/2025/);
    expect(result).toBe(result.toUpperCase());
  });

  it("formats a June date correctly", () => {
    const d = new Date("2025-06-01T00:00:00Z");
    const result = formatDate(d);
    expect(result).toMatch(/JUN/);
    expect(result).toMatch(/2025/);
  });

  it("always returns an uppercase string", () => {
    // Run across a few months to check the toUpperCase contract holds
    const dates = [
      new Date("2025-03-15"),
      new Date("2025-08-20"),
      new Date("2025-12-31"),
    ];
    for (const d of dates) {
      const result = formatDate(d);
      expect(result).toBe(result.toUpperCase());
      expect(result.length).toBeGreaterThan(6);
    }
  });
});
