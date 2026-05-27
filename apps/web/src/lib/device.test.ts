import { describe, it, expect } from "vitest";
import { fmtCoord, fmtAccuracy, networkLabel } from "./device";
import type { NetworkInfo } from "./device";

/**
 * device.ts contract tests.
 *
 * fmtCoord / fmtAccuracy / networkLabel drive the DeviceCheckIn panel
 * which operators use to verify their GPS fix before anchoring surveys.
 *
 * Covered:
 *   - fmtCoord: null → "—", default 5dp, custom digits
 *   - fmtAccuracy: null → "—", sub-metre, whole-metre rounding
 *   - networkLabel: all named types, cellular + effective combos, fallbacks
 */

// ─── fmtCoord ────────────────────────────────────────────────────────────────

describe("fmtCoord", () => {
  it("returns '—' for null", () => {
    expect(fmtCoord(null)).toBe("—");
  });

  it("formats to 5 decimal places by default", () => {
    expect(fmtCoord(13.36447)).toBe("13.36447");
    expect(fmtCoord(100.98765)).toBe("100.98765");
  });

  it("respects custom digit count", () => {
    expect(fmtCoord(13.36447, 2)).toBe("13.36");
    expect(fmtCoord(100.9, 0)).toBe("101");
  });

  it("zero is not treated as null", () => {
    expect(fmtCoord(0)).toBe("0.00000");
  });
});

// ─── fmtAccuracy ─────────────────────────────────────────────────────────────

describe("fmtAccuracy", () => {
  it("returns '—' for null", () => {
    expect(fmtAccuracy(null)).toBe("—");
  });

  it("returns '< 1 m' for sub-metre accuracy", () => {
    expect(fmtAccuracy(0)).toBe("< 1 m");
    expect(fmtAccuracy(0.5)).toBe("< 1 m");
    expect(fmtAccuracy(0.99)).toBe("< 1 m");
  });

  it("returns '±N m' for metre-scale accuracy, rounded", () => {
    expect(fmtAccuracy(1)).toBe("±1 m");
    expect(fmtAccuracy(5.4)).toBe("±5 m");
    expect(fmtAccuracy(5.6)).toBe("±6 m");
    expect(fmtAccuracy(50)).toBe("±50 m");
  });
});

// ─── networkLabel ─────────────────────────────────────────────────────────────

describe("networkLabel — named types", () => {
  const net = (type: string | null, effective: string | null = null): NetworkInfo =>
    ({ type, effective });

  it("returns 'Wi-Fi' for wifi type", () => {
    expect(networkLabel(net("wifi"))).toBe("Wi-Fi");
  });

  it("returns 'Ethernet' for ethernet type", () => {
    expect(networkLabel(net("ethernet"))).toBe("Ethernet");
  });

  it("returns 'Offline' for none type", () => {
    expect(networkLabel(net("none"))).toBe("Offline");
  });
});

describe("networkLabel — cellular", () => {
  const net = (type: string | null, effective: string | null): NetworkInfo =>
    ({ type, effective });

  it("returns 'Cellular · 4G' when type is cellular with effective", () => {
    expect(networkLabel(net("cellular", "4g"))).toBe("Cellular · 4G");
  });

  it("returns 'Cellular · 3G' with effective 3g", () => {
    expect(networkLabel(net("cellular", "3g"))).toBe("Cellular · 3G");
  });

  it("returns 'Cellular' when type is cellular but no effective", () => {
    expect(networkLabel(net("cellular", null))).toBe("Cellular");
  });

  it("returns 'Cellular · 4G' when type is unknown but effective is present", () => {
    // type not one of the named ones, but effective is set → cellular path
    expect(networkLabel(net("unknown", "4g"))).toBe("Cellular · 4G");
  });
});

describe("networkLabel — fallbacks", () => {
  const net = (type: string | null, effective: string | null): NetworkInfo =>
    ({ type, effective });

  it("returns 'Unknown' when type and effective are both null", () => {
    expect(networkLabel(net(null, null))).toBe("Unknown");
  });

  it("returns effective uppercased when type is null but effective is set", () => {
    expect(networkLabel(net(null, "2g"))).toBe("Cellular · 2G");
  });
});
