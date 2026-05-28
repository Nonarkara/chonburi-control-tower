import { describe, it, expect } from "vitest";
import { translate, fmtAge, tierLabel, LOCALES, LOCALE_LABEL } from "./locale";
import type { TrilingualText } from "./locale";

describe("translate", () => {
  const text: TrilingualText = { en: "Hello", th: "สวัสดี", zh: "你好" };

  it("returns the right language for each locale", () => {
    expect(translate("en", text)).toBe("Hello");
    expect(translate("th", text)).toBe("สวัสดี");
    expect(translate("zh", text)).toBe("你好");
  });

  it("returns empty string (not fallback) when locale field is empty string", () => {
    // ?? only short-circuits on null/undefined — empty string passes through
    const incomplete = { en: "Hello", th: "", zh: "" } as TrilingualText;
    expect(translate("th", incomplete)).toBe("");
    expect(translate("en", incomplete)).toBe("Hello");
  });

  it("falls back to English when locale field is null/undefined at runtime", () => {
    // Runtime callers without TypeScript types may pass null/undefined fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partial = { en: "Fallback", th: null, zh: undefined } as any as TrilingualText;
    expect(translate("th", partial)).toBe("Fallback");
    expect(translate("zh", partial)).toBe("Fallback");
    expect(translate("en", partial)).toBe("Fallback");
  });
});

describe("fmtAge", () => {
  it("returns em-dash for nullish / negative input", () => {
    expect(fmtAge(null)).toBe("—");
    expect(fmtAge(undefined)).toBe("—");
    expect(fmtAge(-5)).toBe("—");
  });

  it("returns LIVE for sub-minute ages", () => {
    expect(fmtAge(0)).toBe("LIVE");
    expect(fmtAge(0.5)).toBe("LIVE");
  });

  it("formats minutes under an hour", () => {
    expect(fmtAge(1)).toBe("1m");
    expect(fmtAge(30)).toBe("30m");
    expect(fmtAge(59)).toBe("59m");
  });

  it("formats hours under a day", () => {
    expect(fmtAge(60)).toBe("1h");
    expect(fmtAge(120)).toBe("2h");
    expect(fmtAge(1439)).toBe("24h");
  });

  it("formats days for >= 1440 minutes", () => {
    expect(fmtAge(1440)).toBe("1d");
    expect(fmtAge(2880)).toBe("2d");
  });

  it("float near sub-minute boundary: 0.999 → LIVE, 1.0 → '1m'", () => {
    expect(fmtAge(0.999)).toBe("LIVE");
    expect(fmtAge(1.0)).toBe("1m");
  });

  it("float rounding: 59.9 rounds to '60m' (still < 60 branch, Math.round)", () => {
    // 59.9 < 60, so we're in the minutes branch: Math.round(59.9) = 60
    expect(fmtAge(59.9)).toBe("60m");
  });

  it("float rounding: 1.4 → '1m', 1.6 → '2m'", () => {
    expect(fmtAge(1.4)).toBe("1m");
    expect(fmtAge(1.6)).toBe("2m");
  });

  it("very large value (1 year) renders as days", () => {
    const oneYearMinutes = 365 * 1440;
    expect(fmtAge(oneYearMinutes)).toBe("365d");
  });
});

describe("tierLabel", () => {
  it("returns empty string for live tier (no label needed)", () => {
    expect(tierLabel("live")).toBe("");
  });

  it("returns expected labels for non-live tiers", () => {
    expect(tierLabel("database")).toBe("DB");
    expect(tierLabel("cache")).toBe("CACHE");
    expect(tierLabel("scenario")).toBe("SCENARIO");
    expect(tierLabel("reference")).toBe("REF");
    expect(tierLabel("unavailable")).toBe("OFFLINE");
  });
});

describe("LOCALES + LOCALE_LABEL invariants", () => {
  it("LOCALES has en, th, zh and only those", () => {
    expect(LOCALES).toEqual(["en", "th", "zh"]);
  });

  it("LOCALE_LABEL has a label for every locale", () => {
    for (const l of LOCALES) {
      expect(LOCALE_LABEL[l]).toBeTruthy();
      expect(typeof LOCALE_LABEL[l]).toBe("string");
    }
  });
});
