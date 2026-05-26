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

  it("returns English as fallback when locale field is missing", () => {
    const incomplete = { en: "Hello", th: "", zh: "" } as TrilingualText;
    expect(translate("th", incomplete)).toBe("");
    expect(translate("en", incomplete)).toBe("Hello");
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
