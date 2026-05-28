import { describe, it, expect } from "vitest";
import { buildTrafficSamples, PEAK_HOURS } from "./trafficSim";
import type { FeatureCollection, LineString } from "geojson";
import type { RoadProps } from "./trafficSim";

/**
 * trafficSim contract tests — verifies the sinusoidal traffic model that
 * powers the dashboard's heatmap. The model is deliberately fake (no live
 * probe data) and is labelled "MODELLED" in the UI. These tests document
 * the expected behaviour so any accidental changes to the model are caught.
 */

/** Build a minimal GeoJSON road collection for testing. */
function makeRoads(
  features: Array<{ highway?: string; name?: string; roadClass?: string; coords: [number, number][] }>
): FeatureCollection<LineString, RoadProps> {
  return {
    type: "FeatureCollection",
    features: features.map((f) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: f.coords,
      },
      properties: {
        highway: f.highway,
        name: f.name,
        roadClass: f.roadClass as RoadProps["roadClass"],
      },
    })),
  };
}

// A short road segment (~1 km)
const SIMPLE_ROAD = makeRoads([
  {
    highway: "primary",
    name: "Sukhumvit",
    coords: [
      [100.978, 13.355],
      [100.988, 13.365],
    ],
  },
]);

describe("buildTrafficSamples — output shape", () => {
  it("returns an array of HeatPoints", () => {
    const samples = buildTrafficSamples(SIMPLE_ROAD, 8);
    expect(Array.isArray(samples)).toBe(true);
    expect(samples.length).toBeGreaterThan(0);
    const pt = samples[0];
    expect(pt).toHaveProperty("position");
    expect(pt).toHaveProperty("weight");
    expect(pt).toHaveProperty("road");
    expect(pt).toHaveProperty("roadClass");
  });

  it("position is [lng, lat] with sensible Chonburi-area coordinates", () => {
    const samples = buildTrafficSamples(SIMPLE_ROAD, 8);
    for (const pt of samples) {
      expect(pt.position[0]).toBeGreaterThan(100); // lng: Eastern Thailand
      expect(pt.position[0]).toBeLessThan(102);
      expect(pt.position[1]).toBeGreaterThan(12);  // lat: Eastern Seaboard
      expect(pt.position[1]).toBeLessThan(14);
    }
  });

  it("weight is always in [0, 1]", () => {
    // Test at peak hour and off-peak to cover both extremes
    const peakSamples = buildTrafficSamples(SIMPLE_ROAD, 8);
    const offPeakSamples = buildTrafficSamples(SIMPLE_ROAD, 3);
    for (const pt of [...peakSamples, ...offPeakSamples]) {
      expect(pt.weight).toBeGreaterThanOrEqual(0);
      expect(pt.weight).toBeLessThanOrEqual(1);
    }
  });

  it("returns empty array for empty road collection", () => {
    const empty: FeatureCollection<LineString, RoadProps> = {
      type: "FeatureCollection",
      features: [],
    };
    expect(buildTrafficSamples(empty, 8)).toHaveLength(0);
  });
});

describe("buildTrafficSamples — road class classification", () => {
  it("classifies OSM primary highway as arterial road class", () => {
    const roads = makeRoads([{ highway: "primary", coords: [[100.98, 13.36], [100.99, 13.37]] }]);
    const samples = buildTrafficSamples(roads, 8);
    expect(samples.every((s) => s.roadClass === "arterial")).toBe(true);
  });

  it("classifies OSM secondary highway as collector", () => {
    const roads = makeRoads([{ highway: "secondary", coords: [[100.98, 13.36], [100.99, 13.37]] }]);
    const samples = buildTrafficSamples(roads, 8);
    expect(samples.every((s) => s.roadClass === "collector")).toBe(true);
  });

  it("classifies OSM residential as local", () => {
    const roads = makeRoads([{ highway: "residential", coords: [[100.98, 13.36], [100.99, 13.37]] }]);
    const samples = buildTrafficSamples(roads, 8);
    expect(samples.every((s) => s.roadClass === "local")).toBe(true);
  });
});

describe("buildTrafficSamples — hour model (morning / evening peaks)", () => {
  it("produces higher weights at peak hour (8:00) than overnight (3:00)", () => {
    const peak = buildTrafficSamples(SIMPLE_ROAD, 8);
    const overnight = buildTrafficSamples(SIMPLE_ROAD, 3);
    const avgPeak = peak.reduce((s, p) => s + p.weight, 0) / peak.length;
    const avgOvernight = overnight.reduce((s, p) => s + p.weight, 0) / overnight.length;
    expect(avgPeak).toBeGreaterThan(avgOvernight);
  });

  it("produces higher weights at evening peak (18:00) than midday (12:00)", () => {
    const evening = buildTrafficSamples(SIMPLE_ROAD, 18);
    const midday = buildTrafficSamples(SIMPLE_ROAD, 12);
    const avgEvening = evening.reduce((s, p) => s + p.weight, 0) / evening.length;
    const avgMidday = midday.reduce((s, p) => s + p.weight, 0) / midday.length;
    expect(avgEvening).toBeGreaterThan(avgMidday);
  });
});

describe("buildTrafficSamples — weekend modifier", () => {
  it("weekday weights are higher than weekend weights at peak hour", () => {
    const weekday = buildTrafficSamples(SIMPLE_ROAD, 8, { isWeekend: false });
    const weekend = buildTrafficSamples(SIMPLE_ROAD, 8, { isWeekend: true });
    const avgWeekday = weekday.reduce((s, p) => s + p.weight, 0) / weekday.length;
    const avgWeekend = weekend.reduce((s, p) => s + p.weight, 0) / weekend.length;
    expect(avgWeekday).toBeGreaterThan(avgWeekend);
  });
});

describe("PEAK_HOURS constant", () => {
  it("includes morning rush hours (7, 8, 9)", () => {
    expect(PEAK_HOURS.has(7)).toBe(true);
    expect(PEAK_HOURS.has(8)).toBe(true);
    expect(PEAK_HOURS.has(9)).toBe(true);
  });

  it("includes evening rush hours (17, 18, 19)", () => {
    expect(PEAK_HOURS.has(17)).toBe(true);
    expect(PEAK_HOURS.has(18)).toBe(true);
    expect(PEAK_HOURS.has(19)).toBe(true);
  });

  it("does not include off-peak hours (3, 12)", () => {
    expect(PEAK_HOURS.has(3)).toBe(false);
    expect(PEAK_HOURS.has(12)).toBe(false);
  });
});

describe("buildTrafficSamples — OSM highway type mapping (full table)", () => {
  it("motorway → arterial", () => {
    const roads = makeRoads([{ highway: "motorway", coords: [[100.98, 13.36], [100.99, 13.37]] }]);
    expect(buildTrafficSamples(roads, 8).every((s) => s.roadClass === "arterial")).toBe(true);
  });

  it("trunk → arterial", () => {
    const roads = makeRoads([{ highway: "trunk", coords: [[100.98, 13.36], [100.99, 13.37]] }]);
    expect(buildTrafficSamples(roads, 8).every((s) => s.roadClass === "arterial")).toBe(true);
  });

  it("tertiary → collector", () => {
    const roads = makeRoads([{ highway: "tertiary", coords: [[100.98, 13.36], [100.99, 13.37]] }]);
    expect(buildTrafficSamples(roads, 8).every((s) => s.roadClass === "collector")).toBe(true);
  });

  it("service → campus-internal", () => {
    const roads = makeRoads([{ highway: "service", coords: [[100.98, 13.36], [100.99, 13.37]] }]);
    expect(buildTrafficSamples(roads, 8).every((s) => s.roadClass === "campus-internal")).toBe(true);
  });

  it("unclassified → local", () => {
    const roads = makeRoads([{ highway: "unclassified", coords: [[100.98, 13.36], [100.99, 13.37]] }]);
    expect(buildTrafficSamples(roads, 8).every((s) => s.roadClass === "local")).toBe(true);
  });

  it("living_street → local", () => {
    const roads = makeRoads([{ highway: "living_street", coords: [[100.98, 13.36], [100.99, 13.37]] }]);
    expect(buildTrafficSamples(roads, 8).every((s) => s.roadClass === "local")).toBe(true);
  });

  it("unknown highway type → local (fallback)", () => {
    const roads = makeRoads([{ highway: "footway", coords: [[100.98, 13.36], [100.99, 13.37]] }]);
    expect(buildTrafficSamples(roads, 8).every((s) => s.roadClass === "local")).toBe(true);
  });

  it("missing highway tag → local", () => {
    const roads = makeRoads([{ coords: [[100.98, 13.36], [100.99, 13.37]] }]);
    expect(buildTrafficSamples(roads, 8).every((s) => s.roadClass === "local")).toBe(true);
  });

  it("Soi Chula residential road → campus-internal", () => {
    // classifyOsm: name matches /Soi Chula/i + highway=residential → campus-internal
    const roads = makeRoads([{
      highway: "residential",
      name: "Soi Chulalongkorn",
      coords: [[100.98, 13.36], [100.99, 13.37]],
    }]);
    expect(buildTrafficSamples(roads, 8).every((s) => s.roadClass === "campus-internal")).toBe(true);
  });
});

describe("buildTrafficSamples — overnight floor and campus class-hour boost", () => {
  it("overnight weights (hour=2) are lower than peak morning (hour=8)", () => {
    const overnight = buildTrafficSamples(SIMPLE_ROAD, 2);
    const peak = buildTrafficSamples(SIMPLE_ROAD, 8);
    const avgOvernight = overnight.reduce((s, p) => s + p.weight, 0) / overnight.length;
    const avgPeak = peak.reduce((s, p) => s + p.weight, 0) / peak.length;
    expect(avgOvernight).toBeLessThan(avgPeak);
  });

  it("late night weights (hour=23) are lower than evening peak (hour=18)", () => {
    const lateNight = buildTrafficSamples(SIMPLE_ROAD, 23);
    const evening = buildTrafficSamples(SIMPLE_ROAD, 18);
    const avgLate = lateNight.reduce((s, p) => s + p.weight, 0) / lateNight.length;
    const avgEvening = evening.reduce((s, p) => s + p.weight, 0) / evening.length;
    expect(avgLate).toBeLessThan(avgEvening);
  });

  it("campus-internal road class has higher weight at class hour (9:00) than overnight (3:00)", () => {
    const campusRoad = makeRoads([{ highway: "service", coords: [[100.98, 13.36], [100.99, 13.37]] }]);
    const classHour = buildTrafficSamples(campusRoad, 9);
    const overnight = buildTrafficSamples(campusRoad, 3);
    const avgClass = classHour.reduce((s, p) => s + p.weight, 0) / classHour.length;
    const avgOvernight = overnight.reduce((s, p) => s + p.weight, 0) / overnight.length;
    expect(avgClass).toBeGreaterThan(avgOvernight);
  });

  it("campus-internal base weight (0.15) is lower than arterial (0.55) at same hour", () => {
    const campus = makeRoads([{ highway: "service", coords: [[100.98, 13.36], [100.99, 13.37]] }]);
    const arterial = makeRoads([{ highway: "primary", coords: [[100.98, 13.36], [100.99, 13.37]] }]);
    const campusSamples = buildTrafficSamples(campus, 3);
    const arterialSamples = buildTrafficSamples(arterial, 3);
    const avgCampus = campusSamples.reduce((s, p) => s + p.weight, 0) / campusSamples.length;
    const avgArterial = arterialSamples.reduce((s, p) => s + p.weight, 0) / arterialSamples.length;
    expect(avgCampus).toBeLessThan(avgArterial);
  });
});
