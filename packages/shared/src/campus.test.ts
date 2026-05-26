import { describe, it, expect } from "vitest";
import { CHONBURI } from "./campus";

describe("CHONBURI campus config", () => {
  it("has center inside Thailand's roughly-Eastern-Seaboard latitude band", () => {
    const [lng, lat] = CHONBURI.center;
    expect(lat).toBeGreaterThan(13);
    expect(lat).toBeLessThan(14);
    expect(lng).toBeGreaterThan(100);
    expect(lng).toBeLessThan(102);
  });

  it("outerBounds enclose the center point", () => {
    const [[minLng, minLat], [maxLng, maxLat]] = CHONBURI.outerBounds;
    const [lng, lat] = CHONBURI.center;
    expect(minLng).toBeLessThan(lng);
    expect(maxLng).toBeGreaterThan(lng);
    expect(minLat).toBeLessThan(lat);
    expect(maxLat).toBeGreaterThan(lat);
  });

  it("outerBounds enclose innerBounds", () => {
    const [[oMinLng, oMinLat], [oMaxLng, oMaxLat]] = CHONBURI.outerBounds;
    const [[iMinLng, iMinLat], [iMaxLng, iMaxLat]] = CHONBURI.innerBounds;
    expect(oMinLng).toBeLessThanOrEqual(iMinLng);
    expect(oMaxLng).toBeGreaterThanOrEqual(iMaxLng);
    expect(oMinLat).toBeLessThanOrEqual(iMinLat);
    expect(oMaxLat).toBeGreaterThanOrEqual(iMaxLat);
  });

  it("defaultView is inside outerBounds at a reasonable zoom", () => {
    const [[minLng, minLat], [maxLng, maxLat]] = CHONBURI.outerBounds;
    const { longitude, latitude, zoom } = CHONBURI.defaultView;
    expect(longitude).toBeGreaterThanOrEqual(minLng);
    expect(longitude).toBeLessThanOrEqual(maxLng);
    expect(latitude).toBeGreaterThanOrEqual(minLat);
    expect(latitude).toBeLessThanOrEqual(maxLat);
    expect(zoom).toBeGreaterThanOrEqual(13);
    expect(zoom).toBeLessThanOrEqual(20);
  });

  it("has trilingual name fields", () => {
    expect(CHONBURI.name.en).toBeTruthy();
    expect(CHONBURI.name.th).toBeTruthy();
    expect(CHONBURI.name.zh).toBeTruthy();
  });
});
