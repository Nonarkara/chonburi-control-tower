import { describe, it, expect } from "vitest";
import { adapterNameFor, API_PATH_TO_ADAPTER, CATEGORY_LABEL, STATUS_COLOR } from "./sourceCatalog";
import type { SourceCategory, SourceStatus } from "@chonburi/shared";

/**
 * sourceCatalog helpers contract tests.
 *
 * adapterNameFor() drives which health-endpoint adapter record is used to
 * show the warning chip for each source row in the SOURCES modal.
 * Getting it wrong means a degraded adapter's error is never surfaced.
 *
 * CATEGORY_LABEL and STATUS_COLOR are display constants used in the catalog UI.
 */

// ─── adapterNameFor ───────────────────────────────────────────────────────────

describe("adapterNameFor — known routes", () => {
  it("maps city-reports path correctly", () => {
    expect(adapterNameFor("/api/incidents/city-reports")).toBe("city-reports");
  });

  it("maps weather path correctly", () => {
    expect(adapterNameFor("/api/weather")).toBe("weather");
  });

  it("maps air-quality paths (base + trend + aqicn) correctly", () => {
    expect(adapterNameFor("/api/air-quality")).toBe("air-quality");
    expect(adapterNameFor("/api/air-quality/trend")).toBe("air-quality-trend");
    expect(adapterNameFor("/api/air-quality/aqicn")).toBe("aqicn");
  });

  it("maps marine path correctly", () => {
    expect(adapterNameFor("/api/marine")).toBe("marine");
  });

  it("maps tides path correctly", () => {
    expect(adapterNameFor("/api/tides")).toBe("tides");
  });

  it("maps GISTDA sub-paths correctly", () => {
    expect(adapterNameFor("/api/gistda/poi")).toBe("gistda-poi");
    expect(adapterNameFor("/api/gistda/solar")).toBe("gistda-solar");
    expect(adapterNameFor("/api/gistda/landuse")).toBe("gistda-landuse");
  });

  it("maps datago sub-paths correctly", () => {
    expect(adapterNameFor("/api/datago/datasets")).toBe("datago-datasets");
    expect(adapterNameFor("/api/datago/reservoirs")).toBe("reservoirs");
    expect(adapterNameFor("/api/datago/disasters")).toBe("disasters");
    expect(adapterNameFor("/api/datago/fahfon")).toBe("fahfon");
  });

  it("maps nasa earth-readings path correctly", () => {
    expect(adapterNameFor("/api/nasa/earth-readings")).toBe("nasa-power");
  });

  it("maps markets path correctly", () => {
    expect(adapterNameFor("/api/markets")).toBe("markets");
  });

  it("maps AIS path correctly", () => {
    expect(adapterNameFor("/api/maritime/ais")).toBe("ais");
  });

  it("maps facebook path correctly", () => {
    expect(adapterNameFor("/api/social/facebook")).toBe("facebook");
  });

  it("maps news path correctly", () => {
    expect(adapterNameFor("/api/news")).toBe("news");
  });

  it("maps itic path correctly", () => {
    expect(adapterNameFor("/api/incidents/itic")).toBe("itic");
  });

  it("maps cctv path correctly", () => {
    expect(adapterNameFor("/api/cctv/longdo")).toBe("cctv");
  });

  it("maps precip-nowcast path correctly", () => {
    expect(adapterNameFor("/api/precip-nowcast")).toBe("precip-nowcast");
  });

  it("maps trends path correctly", () => {
    expect(adapterNameFor("/api/trends")).toBe("trends");
  });
});

describe("adapterNameFor — non-matching paths", () => {
  it("returns null for undefined", () => {
    expect(adapterNameFor(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(adapterNameFor("")).toBeNull();
  });

  it("returns null for unknown routes", () => {
    expect(adapterNameFor("/api/unknown")).toBeNull();
    expect(adapterNameFor("/api/v2/weather")).toBeNull();
    // Note: full URL https://...api/weather DOES match because the regex
    // uses a suffix anchor ($) not a start anchor — this is consistent with
    // the production usage where only the path portion is passed.
  });

  it("does not match partial paths (requires end anchor)", () => {
    // /api/weather$ must not match /api/weather/extended
    expect(adapterNameFor("/api/weather/extended")).toBeNull();
    // /api/marine$ must not match /api/maritime/ais
    expect(adapterNameFor("/api/marine/forecast")).toBeNull();
  });

  it("does not match /api/trends when path has extra segment", () => {
    expect(adapterNameFor("/api/trends/more")).toBeNull();
  });
});

// ─── API_PATH_TO_ADAPTER — invariants ─────────────────────────────────────────

describe("API_PATH_TO_ADAPTER — invariants", () => {
  it("has at least 15 entries (no silent truncation)", () => {
    expect(API_PATH_TO_ADAPTER.length).toBeGreaterThanOrEqual(15);
  });

  it("every adapter name is a non-empty lowercase string", () => {
    for (const [, name] of API_PATH_TO_ADAPTER) {
      expect(name.length).toBeGreaterThan(0);
      expect(name).toBe(name.toLowerCase());
    }
  });

  it("every pattern is a RegExp", () => {
    for (const [re] of API_PATH_TO_ADAPTER) {
      expect(re).toBeInstanceOf(RegExp);
    }
  });

  it("no duplicate adapter names (each route maps to a unique adapter)", () => {
    const names = API_PATH_TO_ADAPTER.map(([, n]) => n);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ─── CATEGORY_LABEL — all SourceCategory values covered ─────────────────────

describe("CATEGORY_LABEL — all categories have labels", () => {
  const EXPECTED_CATEGORIES: SourceCategory[] = [
    "mobility", "incidents", "environment", "imagery",
    "vibes", "infrastructure", "maritime", "open-data", "campus",
  ];

  it("covers every SourceCategory", () => {
    for (const cat of EXPECTED_CATEGORIES) {
      expect(CATEGORY_LABEL[cat]).toBeTruthy();
      // Labels are short uppercase abbreviations (2–5 chars)
      expect(CATEGORY_LABEL[cat].length).toBeGreaterThanOrEqual(2);
      expect(CATEGORY_LABEL[cat].length).toBeLessThanOrEqual(5);
    }
  });

  it("maritime label is 'MAR'", () => {
    expect(CATEGORY_LABEL["maritime"]).toBe("MAR");
  });

  it("environment label is 'ENV'", () => {
    expect(CATEGORY_LABEL["environment"]).toBe("ENV");
  });
});

// ─── STATUS_COLOR — all SourceStatus values have colors ──────────────────────

describe("STATUS_COLOR — all statuses have CSS variable colors", () => {
  const EXPECTED_STATUSES: SourceStatus[] = ["live", "ready", "planned", "research", "stub"];

  it("covers every SourceStatus", () => {
    for (const status of EXPECTED_STATUSES) {
      const color = STATUS_COLOR[status];
      expect(color).toBeTruthy();
      expect(color.startsWith("var(--")).toBe(true);
    }
  });

  it("live status uses the 'good' color token", () => {
    expect(STATUS_COLOR["live"]).toBe("var(--good)");
  });

  it("planned status uses the 'warn' color token", () => {
    expect(STATUS_COLOR["planned"]).toBe("var(--warn)");
  });
});
