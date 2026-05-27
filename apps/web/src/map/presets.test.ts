import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  LENSES,
  ALL_LAYERS,
  COMPUTED_LAYERS,
  LAYER_GROUP_LABEL,
  satelliteFreshness,
} from "./presets";
import type { LayerId, LensId, LayerGroup } from "./presets";

/**
 * presets.ts contract tests — verifies the map configuration data that
 * drives the Layer Palette, lens switching, and satellite freshness badges.
 * Tests are structural (no rendering) and pure-function.
 */

// ─── satelliteFreshness ────────────────────────────────────────────────────

describe("satelliteFreshness", () => {
  const FIXED_DATE = new Date("2026-05-27T10:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns LIVE label for Esri satellite (delay = 0)", () => {
    const result = satelliteFreshness("satellite-esri");
    expect(result).not.toBeNull();
    expect(result!.label).toBe("LIVE");
    expect(result!.date).toBe("2026-05-27");
  });

  it("returns LIVE label for Himawari (delay = 0)", () => {
    const result = satelliteFreshness("satellite-himawari");
    expect(result).not.toBeNull();
    expect(result!.label).toBe("LIVE");
  });

  it("returns Y’DAY label for MODIS true-color (delay = 1)", () => {
    const result = satelliteFreshness("satellite-true-color");
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Y’DAY");
    expect(result!.date).toBe("2026-05-26");
  });

  it("returns Y’DAY label for VIIRS (delay = 1)", () => {
    const result = satelliteFreshness("satellite-viirs-truecolor");
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Y’DAY");
  });

  it("returns '3D AGO' for flood detection (delay = 3)", () => {
    const result = satelliteFreshness("satellite-flood");
    expect(result).not.toBeNull();
    expect(result!.label).toBe("3D AGO");
    expect(result!.date).toBe("2026-05-24");
  });

  it("returns '8D AGO' for NDVI (delay = 8)", () => {
    const result = satelliteFreshness("satellite-ndvi");
    expect(result).not.toBeNull();
    expect(result!.label).toBe("8D AGO");
    expect(result!.date).toBe("2026-05-19");
  });

  it("returns null for non-satellite layer", () => {
    expect(satelliteFreshness("civic-points")).toBeNull();
    expect(satelliteFreshness("traffic-heatmap")).toBeNull();
    expect(satelliteFreshness("ais-vessels")).toBeNull();
    expect(satelliteFreshness("road-network")).toBeNull();
  });

  it("date is always ISO 8601 format (YYYY-MM-DD)", () => {
    const layers: LayerId[] = [
      "satellite-esri",
      "satellite-true-color",
      "satellite-ndvi",
      "satellite-flood",
    ];
    for (const id of layers) {
      const result = satelliteFreshness(id);
      expect(result).not.toBeNull();
      expect(result!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

// ─── LENSES structural invariants ─────────────────────────────────────────

describe("LENSES", () => {
  const VALID_LAYER_IDS: Set<string> = new Set(ALL_LAYERS.map((l) => l.id));
  const VALID_LENS_IDS: Set<string> = new Set([
    "executive", "operations", "mobility", "maritime",
    "environment", "earth", "safety", "vibes", "intelligence",
  ]);

  it("contains all 9 expected lenses", () => {
    expect(LENSES).toHaveLength(9);
  });

  it("every lens has a unique id", () => {
    const ids = LENSES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every lens id is a valid LensId", () => {
    for (const lens of LENSES) {
      expect(VALID_LENS_IDS.has(lens.id), `Unknown lens id: ${lens.id}`).toBe(true);
    }
  });

  it("every lens has a non-empty label and description", () => {
    for (const lens of LENSES) {
      expect(lens.label.length).toBeGreaterThan(0);
      expect(lens.describe.length).toBeGreaterThan(0);
    }
  });

  it("every layer referenced in a lens exists in ALL_LAYERS or is a legacy no-op", () => {
    // Some layers may be legacy (still in LayerId union but not in ALL_LAYERS).
    // We only verify that no lens references something completely unknown —
    // specifically, all lens layers should be valid LayerId strings.
    const validLayerIds = new Set<string>([
      ...ALL_LAYERS.map((l) => l.id),
      // Known legacy IDs kept for backward compat
      "municipality-boundary",
      "municipality-boundary-line",
      "municipality-boundary-fill",
      "neighborhood-buildings",
      "cu-map-2015",
      "bma-pois",
      "bma-parks",
      "bma-aq-stations",
      "cu-shuttle-routes",
      "cu-shuttle-1", "cu-shuttle-2", "cu-shuttle-3", "cu-shuttle-4", "cu-shuttle-5",
      "cu-shuttle-stops", "cu-shuttle-vehicles",
      "utility-electricity", "utility-water", "utility-drainage",
      "utility-wifi-heat", "utility-wifi-points",
      "building-roofs",
      "heritage-old-town",
      "heritage-temple-spires",
    ]);
    for (const lens of LENSES) {
      for (const layerId of lens.layers) {
        expect(validLayerIds.has(layerId), `Lens "${lens.id}" references unknown layer "${layerId}"`).toBe(true);
      }
    }
  });

  it("every lens has at least one layer", () => {
    for (const lens of LENSES) {
      expect(lens.layers.length).toBeGreaterThan(0);
    }
  });

  it("operations lens includes traffic-heatmap and incidents", () => {
    const ops = LENSES.find((l) => l.id === "operations");
    expect(ops).toBeDefined();
    expect(ops!.layers).toContain("traffic-heatmap");
    expect(ops!.layers).toContain("incidents-city-reports");
    expect(ops!.layers).toContain("incidents-itic");
  });

  it("maritime lens includes ais-vessels and distance-grid", () => {
    const mar = LENSES.find((l) => l.id === "maritime");
    expect(mar).toBeDefined();
    expect(mar!.layers).toContain("ais-vessels");
    expect(mar!.layers).toContain("distance-grid");
  });

  it("every lens references municipality-boundary-line or municipality-boundary", () => {
    for (const lens of LENSES) {
      const hasBoundary =
        lens.layers.includes("municipality-boundary-line") ||
        lens.layers.includes("municipality-boundary") ||
        lens.layers.includes("municipality-boundary-fill");
      expect(hasBoundary, `Lens "${lens.id}" has no municipal boundary layer`).toBe(true);
    }
  });
});

// ─── ALL_LAYERS structural invariants ─────────────────────────────────────

describe("ALL_LAYERS", () => {
  it("has at least 30 layer definitions", () => {
    expect(ALL_LAYERS.length).toBeGreaterThanOrEqual(30);
  });

  it("every layer has a unique id", () => {
    const ids = ALL_LAYERS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every layer has required string fields (label, swatch, group, describe)", () => {
    for (const layer of ALL_LAYERS) {
      expect(typeof layer.label).toBe("string");
      expect(layer.label.length).toBeGreaterThan(0);
      expect(typeof layer.swatch).toBe("string");
      expect(layer.swatch.length).toBeGreaterThan(0);
      expect(typeof layer.group).toBe("string");
      expect(typeof layer.describe).toBe("string");
      expect(layer.describe.length).toBeGreaterThan(0);
    }
  });

  it("every layer's group is a valid LayerGroup", () => {
    const validGroups: Set<string> = new Set(Object.keys(LAYER_GROUP_LABEL));
    for (const layer of ALL_LAYERS) {
      expect(validGroups.has(layer.group), `Layer "${layer.id}" has invalid group "${layer.group}"`).toBe(true);
    }
  });

  it("swatch is a hex colour or CSS variable reference", () => {
    for (const layer of ALL_LAYERS) {
      const isHex = /^#[0-9A-Fa-f]{3,8}$/.test(layer.swatch);
      const isCssVar = layer.swatch.startsWith("var(--");
      expect(isHex || isCssVar, `Layer "${layer.id}" has invalid swatch "${layer.swatch}"`).toBe(true);
    }
  });

  it("contains key operational layers (traffic, AIS, incidents)", () => {
    const ids = new Set(ALL_LAYERS.map((l) => l.id));
    expect(ids.has("traffic-heatmap")).toBe(true);
    expect(ids.has("ais-vessels")).toBe(true);
    expect(ids.has("incidents-city-reports")).toBe(true);
    expect(ids.has("incidents-itic")).toBe(true);
    expect(ids.has("cctv-cameras")).toBe(true);
  });
});

// ─── COMPUTED_LAYERS invariants ────────────────────────────────────────────

describe("COMPUTED_LAYERS", () => {
  it("includes distance-grid (formula-drawn geometry)", () => {
    expect(COMPUTED_LAYERS.has("distance-grid")).toBe(true);
  });

  it("includes all satellite imagery layers", () => {
    const satellites: LayerId[] = [
      "satellite-esri",
      "satellite-true-color",
      "satellite-viirs-truecolor",
      "satellite-night",
      "satellite-ndvi",
      "satellite-lst",
      "satellite-aerosol",
      "satellite-no2",
      "satellite-flood",
      "satellite-terrain",
      "satellite-himawari",
      "satellite-imerg",
    ];
    for (const id of satellites) {
      expect(COMPUTED_LAYERS.has(id), `Expected ${id} in COMPUTED_LAYERS`).toBe(true);
    }
  });

  it("includes maritime-overlay (raster tile layer)", () => {
    expect(COMPUTED_LAYERS.has("maritime-overlay")).toBe(true);
  });

  it("does NOT include live data-backed layers", () => {
    // These layers have real FeatureCollections — their count badge is meaningful.
    const dataBacked: LayerId[] = [
      "ais-vessels",
      "civic-points",
      "incidents-city-reports",
      "incidents-itic",
      "cctv-cameras",
      "traffic-heatmap",
    ];
    for (const id of dataBacked) {
      expect(COMPUTED_LAYERS.has(id), `Data-backed layer ${id} should NOT be in COMPUTED_LAYERS`).toBe(false);
    }
  });

  it("all entries are valid LayerId strings (appear in LayerId type)", () => {
    // We verify by checking each is either in ALL_LAYERS or the known legacy set
    const knownIds = new Set<string>([
      ...ALL_LAYERS.map((l) => l.id),
      "building-roofs", "cu-map-2015", "heritage-old-town", "heritage-temple-spires",
    ]);
    for (const id of COMPUTED_LAYERS) {
      expect(knownIds.has(id), `COMPUTED_LAYERS contains unknown id "${id}"`).toBe(true);
    }
  });
});

// ─── LAYER_GROUP_LABEL completeness ───────────────────────────────────────

describe("LAYER_GROUP_LABEL", () => {
  it("covers all 7 LayerGroup values", () => {
    const expectedGroups: LayerGroup[] = [
      "municipality", "maritime", "mobility", "incidents",
      "open-data", "imagery", "environment",
    ];
    for (const g of expectedGroups) {
      expect(LAYER_GROUP_LABEL[g], `Missing group label for "${g}"`).toBeDefined();
      expect(LAYER_GROUP_LABEL[g].length).toBeGreaterThan(0);
    }
  });

  it("labels are human-readable (no IDs or kebab-case)", () => {
    for (const [, label] of Object.entries(LAYER_GROUP_LABEL)) {
      expect(label).not.toContain("-");
      expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
    }
  });
});
