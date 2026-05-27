import { describe, it, expect } from "vitest";
import { classifyBuilding, buildingHeightMeters, finitePositive, hexToRgb, heightColor } from "./building";
import type { BuildingProperties } from "./building";

/**
 * building.ts contract tests.
 *
 * classifyBuilding() drives the colour of every building in the 3D cityscape:
 * hospital→red, temple→gold, government→blue, etc. Getting a branch wrong
 * silently shows the wrong colour for that building type — misleading operators
 * reading the spatial layout during a briefing.
 *
 * buildingHeightMeters() drives extrusion height in the 3D layer.
 * finitePositive() is the shared parsing helper.
 *
 * Covered:
 *   - finitePositive: numbers, numeric strings, zero, negative, Infinity, NaN
 *   - classifyBuilding: all major amenity/tourism/building/name branches
 *   - classifyBuilding: religion sub-branches (church/mosque/temple)
 *   - classifyBuilding: name-keyword detection (Thai + English)
 *   - classifyBuilding: tall-building height threshold
 *   - buildingHeightMeters: explicit height, levels, and landmark minimums
 */

// ─── Helper ────────────────────────────────────────────────────────────────

function b(overrides: Partial<BuildingProperties> = {}): BuildingProperties {
  return {
    id: "test", name: null, nameEn: null, nameTh: null,
    building: "", levels: null, height: null, operator: null,
    amenity: null, tourism: null, religion: null, office: null,
    healthcare: null, shop: null, source: null,
    ...overrides,
  };
}

// ─── finitePositive ────────────────────────────────────────────────────────

describe("finitePositive", () => {
  it("returns the value for positive finite numbers", () => {
    expect(finitePositive(3.5)).toBe(3.5);
    expect(finitePositive(1)).toBe(1);
    expect(finitePositive(100)).toBe(100);
  });

  it("returns null for zero", () => {
    expect(finitePositive(0)).toBeNull();
  });

  it("returns null for negative numbers", () => {
    expect(finitePositive(-5)).toBeNull();
  });

  it("returns null for Infinity", () => {
    expect(finitePositive(Infinity)).toBeNull();
  });

  it("returns null for NaN", () => {
    expect(finitePositive(NaN)).toBeNull();
  });

  it("parses numeric strings (strips non-digit chars)", () => {
    expect(finitePositive("3.5m")).toBe(3.5);
    expect(finitePositive("12")).toBe(12);
    expect(finitePositive("3 floors")).toBe(3);
  });

  it("returns null for non-parseable strings", () => {
    expect(finitePositive("")).toBeNull();
    expect(finitePositive("abc")).toBeNull();
    expect(finitePositive(null)).toBeNull();
    expect(finitePositive(undefined)).toBeNull();
  });
});

// ─── classifyBuilding — amenity tag ───────────────────────────────────────

describe("classifyBuilding — amenity tags", () => {
  it("hospital amenity → 'hospital'", () => {
    expect(classifyBuilding(b({ amenity: "hospital" }))).toBe("hospital");
  });

  it("clinic amenity → 'clinic'", () => {
    expect(classifyBuilding(b({ amenity: "clinic" }))).toBe("clinic");
  });

  it("police amenity → 'police'", () => {
    expect(classifyBuilding(b({ amenity: "police" }))).toBe("police");
  });

  it("fire_station amenity → 'fire'", () => {
    expect(classifyBuilding(b({ amenity: "fire_station" }))).toBe("fire");
  });

  it("school amenity → 'school'", () => {
    expect(classifyBuilding(b({ amenity: "school" }))).toBe("school");
  });

  it("kindergarten amenity → 'school'", () => {
    expect(classifyBuilding(b({ amenity: "kindergarten" }))).toBe("school");
  });

  it("university amenity → 'university'", () => {
    expect(classifyBuilding(b({ amenity: "university" }))).toBe("university");
  });

  it("college amenity → 'university'", () => {
    expect(classifyBuilding(b({ amenity: "college" }))).toBe("university");
  });

  it("townhall amenity → 'government'", () => {
    expect(classifyBuilding(b({ amenity: "townhall" }))).toBe("government");
  });

  it("courthouse amenity → 'government'", () => {
    expect(classifyBuilding(b({ amenity: "courthouse" }))).toBe("government");
  });

  it("bank amenity → 'office'", () => {
    expect(classifyBuilding(b({ amenity: "bank" }))).toBe("office");
  });

  it("restaurant amenity → 'commercial'", () => {
    expect(classifyBuilding(b({ amenity: "restaurant" }))).toBe("commercial");
  });

  it("cafe amenity → 'commercial'", () => {
    expect(classifyBuilding(b({ amenity: "cafe" }))).toBe("commercial");
  });
});

// ─── classifyBuilding — place_of_worship + religion ──────────────────────

describe("classifyBuilding — place_of_worship + religion", () => {
  it("place_of_worship + christian → 'church'", () => {
    expect(classifyBuilding(b({ amenity: "place_of_worship", religion: "christian" }))).toBe("church");
  });

  it("place_of_worship + muslim → 'mosque'", () => {
    expect(classifyBuilding(b({ amenity: "place_of_worship", religion: "muslim" }))).toBe("mosque");
  });

  it("place_of_worship + buddhist → 'temple' (default)", () => {
    expect(classifyBuilding(b({ amenity: "place_of_worship", religion: "buddhist" }))).toBe("temple");
  });

  it("place_of_worship + no religion → 'temple' (default)", () => {
    expect(classifyBuilding(b({ amenity: "place_of_worship" }))).toBe("temple");
  });
});

// ─── classifyBuilding — healthcare tag ───────────────────────────────────

describe("classifyBuilding — healthcare tag", () => {
  it("healthcare=hospital → 'hospital'", () => {
    expect(classifyBuilding(b({ healthcare: "hospital" }))).toBe("hospital");
  });

  it("healthcare=clinic → 'clinic'", () => {
    expect(classifyBuilding(b({ healthcare: "clinic" }))).toBe("clinic");
  });

  it("healthcare=doctor → 'clinic'", () => {
    expect(classifyBuilding(b({ healthcare: "doctor" }))).toBe("clinic");
  });
});

// ─── classifyBuilding — tourism / building tags ────────────────────────────

describe("classifyBuilding — tourism + building tags", () => {
  it("tourism=hotel → 'hotel'", () => {
    expect(classifyBuilding(b({ tourism: "hotel" }))).toBe("hotel");
  });

  it("building=hotel → 'hotel'", () => {
    expect(classifyBuilding(b({ building: "hotel" }))).toBe("hotel");
  });

  it("building=commercial → 'commercial'", () => {
    expect(classifyBuilding(b({ building: "commercial" }))).toBe("commercial");
  });

  it("building=warehouse → 'industrial'", () => {
    expect(classifyBuilding(b({ building: "warehouse" }))).toBe("industrial");
  });

  it("building=factory → 'industrial'", () => {
    expect(classifyBuilding(b({ building: "factory" }))).toBe("industrial");
  });

  it("building=office → 'office'", () => {
    expect(classifyBuilding(b({ building: "office" }))).toBe("office");
  });

  it("building=apartments → 'residential'", () => {
    expect(classifyBuilding(b({ building: "apartments" }))).toBe("residential");
  });

  it("building=house → 'residential'", () => {
    expect(classifyBuilding(b({ building: "house" }))).toBe("residential");
  });
});

// ─── classifyBuilding — name keyword detection ────────────────────────────

describe("classifyBuilding — name keywords", () => {
  it("name contains 'โรงพยาบาล' → 'hospital'", () => {
    expect(classifyBuilding(b({ name: "โรงพยาบาลชลบุรี" }))).toBe("hospital");
  });

  it("name contains 'hospital' → 'hospital'", () => {
    expect(classifyBuilding(b({ nameEn: "Chonburi Hospital" }))).toBe("hospital");
  });

  it("name contains 'hotel' → 'hotel'", () => {
    expect(classifyBuilding(b({ nameEn: "Grand Hotel Chonburi" }))).toBe("hotel");
  });

  it("name contains 'โรงแรม' → 'hotel'", () => {
    expect(classifyBuilding(b({ name: "โรงแรมสิรินทร" }))).toBe("hotel");
  });

  it("name contains 'วัด' → 'temple'", () => {
    expect(classifyBuilding(b({ name: "วัดอนัมนิกายาราม" }))).toBe("temple");
  });

  it("name contains 'wat ' → 'temple'", () => {
    expect(classifyBuilding(b({ nameEn: "Wat Tai Chonburi" }))).toBe("temple");
  });

  it("name contains 'สถานีตำรวจ' → 'police'", () => {
    expect(classifyBuilding(b({ name: "สถานีตำรวจภูธรเมืองชลบุรี" }))).toBe("police");
  });

  it("operator contains 'egat' → 'power'", () => {
    expect(classifyBuilding(b({ operator: "EGAT Substation East" }))).toBe("power");
  });

  it("name contains 'การไฟฟ้า' → 'power'", () => {
    expect(classifyBuilding(b({ name: "การไฟฟ้าส่วนภูมิภาค" }))).toBe("power");
  });
});

// ─── classifyBuilding — office tag + source ────────────────────────────────

describe("classifyBuilding — office + source tags", () => {
  it("office=government → 'government'", () => {
    expect(classifyBuilding(b({ office: "government" }))).toBe("government");
  });

  it("office=company → 'office'", () => {
    expect(classifyBuilding(b({ office: "company" }))).toBe("office");
  });

  it("source=ms-footprints → 'ms-generic'", () => {
    expect(classifyBuilding(b({ source: "ms-footprints" }))).toBe("ms-generic");
  });

  it("no matching tags → null", () => {
    expect(classifyBuilding(b())).toBeNull();
  });
});

// ─── classifyBuilding — tall building threshold ────────────────────────────

describe("classifyBuilding — tall building (≥ 50 m)", () => {
  it("explicit height ≥ 50 → 'tall'", () => {
    expect(classifyBuilding(b({ height: 50 }))).toBe("tall");
    expect(classifyBuilding(b({ height: 80 }))).toBe("tall");
  });

  it("levels × 4.2 ≥ 50 → 'tall'", () => {
    // 12 levels × 4.2 = 50.4 → 'tall'
    expect(classifyBuilding(b({ levels: 12 }))).toBe("tall");
  });

  it("height = 49 → NOT tall (null for untagged building)", () => {
    expect(classifyBuilding(b({ height: 49 }))).toBeNull();
  });
});

// ─── buildingHeightMeters ─────────────────────────────────────────────────

describe("buildingHeightMeters", () => {
  it("uses explicit height (≥ 8 minimum)", () => {
    expect(buildingHeightMeters(b({ height: 20 }))).toBe(20);
    expect(buildingHeightMeters(b({ height: 3 }))).toBe(8); // floor at 8m
  });

  it("derives height from levels × 4.2m (≥ 10 minimum)", () => {
    expect(buildingHeightMeters(b({ levels: 5 }))).toBe(21); // 5 × 4.2
    expect(buildingHeightMeters(b({ levels: 1 }))).toBe(10); // floor at 10m
  });

  it("explicit height takes priority over levels", () => {
    expect(buildingHeightMeters(b({ height: 30, levels: 2 }))).toBe(30);
  });

  it("temple landmark minimum is 28m", () => {
    expect(buildingHeightMeters(b({ amenity: "place_of_worship" }))).toBe(28);
  });

  it("hospital landmark minimum is 18m", () => {
    expect(buildingHeightMeters(b({ amenity: "hospital" }))).toBe(18);
  });

  it("hotel landmark minimum is 20m", () => {
    expect(buildingHeightMeters(b({ tourism: "hotel" }))).toBe(20);
  });

  it("unclassified building defaults to 10m", () => {
    expect(buildingHeightMeters(b())).toBe(10);
  });
});

// ─── hexToRgb ─────────────────────────────────────────────────────────────────

describe("hexToRgb", () => {
  it("parses 6-digit hex with # prefix", () => {
    expect(hexToRgb("#ff0000")).toEqual([255, 0, 0]);
    expect(hexToRgb("#0000ff")).toEqual([0, 0, 255]);
    expect(hexToRgb("#ffffff")).toEqual([255, 255, 255]);
  });

  it("parses 6-digit hex without # prefix", () => {
    expect(hexToRgb("00ff00")).toEqual([0, 255, 0]);
    expect(hexToRgb("123456")).toEqual([18, 52, 86]);
  });

  it("is case-insensitive", () => {
    expect(hexToRgb("#FF8800")).toEqual(hexToRgb("#ff8800"));
    expect(hexToRgb("AABBCC")).toEqual([170, 187, 204]);
  });

  it("returns neutral grey [200,200,200] for invalid inputs", () => {
    expect(hexToRgb("")).toEqual([200, 200, 200]);
    expect(hexToRgb("#fff")).toEqual([200, 200, 200]);       // 3-digit short form
    expect(hexToRgb("#gggggg")).toEqual([200, 200, 200]);    // non-hex digits
    expect(hexToRgb("not-a-color")).toEqual([200, 200, 200]);
  });

  it("known shuttle line color parses correctly", () => {
    // #7c3aed = violet — used for shuttle route colour
    expect(hexToRgb("#7c3aed")).toEqual([124, 58, 237]);
  });
});

// ─── heightColor ──────────────────────────────────────────────────────────────

describe("heightColor", () => {
  it("≥50 m → sky-300 (high-rise)", () => {
    expect(heightColor(50)).toEqual([125, 211, 252]);
    expect(heightColor(100)).toEqual([125, 211, 252]);
  });

  it("≥30 m, <50 m → sky-400 (mid-high)", () => {
    expect(heightColor(30)).toEqual([56, 189, 248]);
    expect(heightColor(49)).toEqual([56, 189, 248]);
  });

  it("≥20 m, <30 m → sky-500 (mid-rise)", () => {
    expect(heightColor(20)).toEqual([14, 165, 233]);
    expect(heightColor(29)).toEqual([14, 165, 233]);
  });

  it("≥12 m, <20 m → blue-500 (3–4 floors)", () => {
    expect(heightColor(12)).toEqual([59, 130, 246]);
    expect(heightColor(19)).toEqual([59, 130, 246]);
  });

  it("≥7 m, <12 m → indigo (2 floors)", () => {
    expect(heightColor(7)).toEqual([99, 102, 241]);
    expect(heightColor(11)).toEqual([99, 102, 241]);
  });

  it("<7 m → warm clay (1 floor / unknown)", () => {
    expect(heightColor(0)).toEqual([148, 103, 89]);
    expect(heightColor(6)).toEqual([148, 103, 89]);
    expect(heightColor(6.99)).toEqual([148, 103, 89]);
  });

  it("boundary values are assigned to the correct band", () => {
    // 50 is high-rise, 49 is mid-high
    expect(heightColor(50)[0]).toBe(125);
    expect(heightColor(49)[0]).toBe(56);
    // 7 is indigo, 6.99 is warm clay
    expect(heightColor(7)[0]).toBe(99);
    expect(heightColor(6.99)[0]).toBe(148);
  });
});
