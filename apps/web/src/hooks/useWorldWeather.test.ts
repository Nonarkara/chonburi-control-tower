import { describe, it, expect } from "vitest";
import { PARTNER_CITIES } from "./useWorldWeather";

/**
 * useWorldWeather / PARTNER_CITIES data contract tests — verifies the static
 * partner-city configuration that drives the WorldStrip component. Getting
 * a city's timezone or coordinates wrong silently shows the wrong clock time
 * or fetches weather for the wrong location.
 */

describe("PARTNER_CITIES invariants", () => {
  it("has at least 6 cities", () => {
    expect(PARTNER_CITIES.length).toBeGreaterThanOrEqual(6);
  });

  it("Chonburi is always first (host city)", () => {
    expect(PARTNER_CITIES[0].id).toBe("cbo");
    expect(PARTNER_CITIES[0].city).toBe("Chonburi");
    expect(PARTNER_CITIES[0].tz).toBe("Asia/Bangkok");
  });

  it("Chonburi coordinates are in the Eastern Seaboard region", () => {
    const cbo = PARTNER_CITIES[0];
    expect(cbo.lat).toBeGreaterThan(13);
    expect(cbo.lat).toBeLessThan(14);
    expect(cbo.lng).toBeGreaterThan(100);
    expect(cbo.lng).toBeLessThan(102);
  });

  it("every city has a unique id", () => {
    const ids = PARTNER_CITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every city has non-empty required string fields", () => {
    for (const c of PARTNER_CITIES) {
      expect(c.id.length).toBeGreaterThan(0);
      expect(c.city.length).toBeGreaterThan(0);
      expect(c.countryShort.length).toBeGreaterThan(0);
      expect(c.tz.length).toBeGreaterThan(0);
    }
  });

  it("every city has a valid IANA timezone format", () => {
    // IANA zones follow the pattern Region/City (e.g. "Asia/Bangkok", "America/New_York")
    // or simple "UTC". We accept both.
    for (const c of PARTNER_CITIES) {
      const hasSlash = c.tz.includes("/");
      const isUtc = c.tz === "UTC";
      expect(hasSlash || isUtc, `Invalid IANA tz for ${c.city}: ${c.tz}`).toBe(true);
    }
  });

  it("every city has valid latitude and longitude", () => {
    for (const c of PARTNER_CITIES) {
      expect(c.lat).toBeGreaterThan(-90);
      expect(c.lat).toBeLessThan(90);
      expect(c.lng).toBeGreaterThan(-180);
      expect(c.lng).toBeLessThan(180);
    }
  });

  it("countryShort is 2-letter ISO 3166-1 alpha-2 code", () => {
    for (const c of PARTNER_CITIES) {
      expect(c.countryShort).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("includes at least one ASEAN city (Singapore)", () => {
    const sng = PARTNER_CITIES.find((c) => c.id === "sgp");
    expect(sng).toBeDefined();
    expect(sng!.countryShort).toBe("SG");
    expect(sng!.tz).toBe("Asia/Singapore");
  });

  it("includes at least one European city", () => {
    const hasEu = PARTNER_CITIES.some((c) =>
      c.tz.startsWith("Europe/")
    );
    expect(hasEu).toBe(true);
  });

  it("includes at least one US city", () => {
    const hasUs = PARTNER_CITIES.some((c) =>
      c.tz.startsWith("America/")
    );
    expect(hasUs).toBe(true);
  });

  it("no two cities have identical coordinates", () => {
    const coords = PARTNER_CITIES.map((c) => `${c.lat},${c.lng}`);
    expect(new Set(coords).size).toBe(coords.length);
  });
});
