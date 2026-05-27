import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TwinObject, TwinRelation, TwinStatePoint } from "./twinStore.js";

/**
 * twinStore.ts in-memory path tests.
 *
 * Strategy: mock ./twinDb.js so initTwinDb() returns false, which keeps
 * dbReady=false and forces every operation through the in-memory fallback.
 * vi.resetModules() before each test gives us a fresh empty store.
 *
 * Covered:
 *   - Object CRUD: upsert, get, find (kind/bbox/limit filters), delete, count
 *   - Relations: add, get (subjectId/objectId/predicate filters), cascade delete
 *   - State time series: write, get (metric/since/until/limit, DESC order)
 *   - hydrateBuildingsFromGeoJSON: feature count, centroid, id/height derivation
 *   - twinSnapshot: counts from memory
 */

vi.mock("./twinDb.js", () => ({
  initTwinDb: vi.fn().mockResolvedValue(false),
  isTwinDbEnabled: vi.fn().mockReturnValue(false),
  dbUpsertObject: vi.fn().mockResolvedValue(undefined),
  dbGetObject: vi.fn().mockResolvedValue(undefined),
  dbFindObjects: vi.fn().mockResolvedValue([]),
  dbDeleteObject: vi.fn().mockResolvedValue(false),
  dbCountObjects: vi.fn().mockResolvedValue({}),
  dbAddRelation: vi.fn().mockResolvedValue(undefined),
  dbGetRelations: vi.fn().mockResolvedValue([]),
  dbWriteState: vi.fn().mockResolvedValue(undefined),
  dbGetState: vi.fn().mockResolvedValue([]),
  dbGetStateLatest: vi.fn().mockResolvedValue(undefined),
  dbGetStateMetrics: vi.fn().mockResolvedValue([]),
  dbSnapshot: vi.fn().mockResolvedValue({ objects: 0, relations: 0, statePoints: 0, kindCounts: {} }),
  dbBulkInsertObjects: vi.fn().mockResolvedValue(0),
}));

// Helper factories
function makeObj(id: string, kind: TwinObject["kind"] = "building", lat = 13.36, lng = 100.98): TwinObject {
  return {
    id, kind, name: `obj-${id}`,
    lat, lng,
    properties: {},
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

function makeRel(
  id: string,
  subjectId: string,
  predicate: TwinRelation["predicate"],
  objectId: string,
): TwinRelation {
  return { id, subjectId, predicate, objectId, createdAt: "2025-01-01T00:00:00Z" };
}

function makeState(objectId: string, metric: string, value: number, time: string): TwinStatePoint {
  return { time, objectId, metric, value, source: "test" };
}

// Reset module state before each test
beforeEach(() => {
  vi.resetModules();
});

// ─── Object CRUD ──────────────────────────────────────────────────────────

describe("in-memory object CRUD", () => {
  it("upsertTwinObject stores an object retrievable by getTwinObject", async () => {
    const { upsertTwinObject, getTwinObject } = await import("./twinStore.js");
    const obj = makeObj("bldg-1");
    await upsertTwinObject(obj);
    const retrieved = await getTwinObject("bldg-1");
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe("bldg-1");
    expect(retrieved!.kind).toBe("building");
  });

  it("getTwinObject returns undefined for unknown id", async () => {
    const { getTwinObject } = await import("./twinStore.js");
    const result = await getTwinObject("does-not-exist");
    expect(result).toBeUndefined();
  });

  it("findTwinObjects returns all objects when no filter applied", async () => {
    const { upsertTwinObject, findTwinObjects } = await import("./twinStore.js");
    await upsertTwinObject(makeObj("a", "building"));
    await upsertTwinObject(makeObj("b", "sensor"));
    const all = await findTwinObjects({});
    expect(all).toHaveLength(2);
  });

  it("findTwinObjects filters by kind", async () => {
    const { upsertTwinObject, findTwinObjects } = await import("./twinStore.js");
    await upsertTwinObject(makeObj("bldg", "building"));
    await upsertTwinObject(makeObj("sen", "sensor"));
    await upsertTwinObject(makeObj("poi", "poi"));
    const buildings = await findTwinObjects({ kind: "building" });
    expect(buildings).toHaveLength(1);
    expect(buildings[0].id).toBe("bldg");
  });

  it("findTwinObjects filters by bbox", async () => {
    const { upsertTwinObject, findTwinObjects } = await import("./twinStore.js");
    // Inside Chonburi municipality
    await upsertTwinObject(makeObj("inside", "poi", 13.36, 100.98));
    // Outside (Bangkok)
    await upsertTwinObject(makeObj("outside", "poi", 13.75, 100.52));
    const bbox: [number, number, number, number] = [100.90, 13.20, 101.10, 13.50];
    const result = await findTwinObjects({ bbox });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("inside");
  });

  it("findTwinObjects respects limit", async () => {
    const { upsertTwinObject, findTwinObjects } = await import("./twinStore.js");
    for (let i = 0; i < 10; i++) {
      await upsertTwinObject(makeObj(`obj-${i}`, "building", 13.36 + i * 0.001, 100.98));
    }
    const result = await findTwinObjects({ limit: 3 });
    expect(result).toHaveLength(3);
  });

  it("deleteTwinObject removes the object", async () => {
    const { upsertTwinObject, deleteTwinObject, getTwinObject } = await import("./twinStore.js");
    await upsertTwinObject(makeObj("to-delete"));
    await deleteTwinObject("to-delete");
    const retrieved = await getTwinObject("to-delete");
    expect(retrieved).toBeUndefined();
  });

  it("countTwinObjects returns correct kind breakdown", async () => {
    const { upsertTwinObject, countTwinObjects } = await import("./twinStore.js");
    await upsertTwinObject(makeObj("b1", "building"));
    await upsertTwinObject(makeObj("b2", "building"));
    await upsertTwinObject(makeObj("s1", "sensor"));
    const counts = await countTwinObjects();
    expect(counts["building"]).toBe(2);
    expect(counts["sensor"]).toBe(1);
  });
});

// ─── Relations ────────────────────────────────────────────────────────────

describe("in-memory relations", () => {
  it("addTwinRelation stores and getTwinRelations retrieves it", async () => {
    const { addTwinRelation, getTwinRelations } = await import("./twinStore.js");
    const rel = makeRel("rel-1", "zone-a", "contains", "bldg-1");
    await addTwinRelation(rel);
    const all = await getTwinRelations({});
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("rel-1");
  });

  it("getTwinRelations filters by subjectId", async () => {
    const { addTwinRelation, getTwinRelations } = await import("./twinStore.js");
    await addTwinRelation(makeRel("r1", "zone-a", "contains", "bldg-1"));
    await addTwinRelation(makeRel("r2", "zone-b", "contains", "bldg-2"));
    const result = await getTwinRelations({ subjectId: "zone-a" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("r1");
  });

  it("getTwinRelations filters by objectId", async () => {
    const { addTwinRelation, getTwinRelations } = await import("./twinStore.js");
    await addTwinRelation(makeRel("r1", "zone-a", "contains", "bldg-1"));
    await addTwinRelation(makeRel("r2", "zone-a", "contains", "bldg-2"));
    const result = await getTwinRelations({ objectId: "bldg-1" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("r1");
  });

  it("getTwinRelations filters by predicate", async () => {
    const { addTwinRelation, getTwinRelations } = await import("./twinStore.js");
    await addTwinRelation(makeRel("r1", "zone-a", "contains", "bldg-1"));
    await addTwinRelation(makeRel("r2", "sen-1", "monitors", "bldg-1"));
    const result = await getTwinRelations({ predicate: "monitors" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("r2");
  });

  it("deleteTwinObject cascades and removes its relations from memory", async () => {
    const { upsertTwinObject, addTwinRelation, deleteTwinObject, getTwinRelations } = await import("./twinStore.js");
    await upsertTwinObject(makeObj("zone-a", "zone"));
    await upsertTwinObject(makeObj("bldg-1", "building"));
    await addTwinRelation(makeRel("r1", "zone-a", "contains", "bldg-1"));
    await addTwinRelation(makeRel("r2", "zone-a", "contains", "bldg-99")); // bldg-99 not in store, but relation exists
    // Delete the subject
    await deleteTwinObject("zone-a");
    const remaining = await getTwinRelations({ subjectId: "zone-a" });
    expect(remaining).toHaveLength(0);
  });
});

// ─── State time series ────────────────────────────────────────────────────

describe("in-memory state time series", () => {
  it("writeTwinState stores points retrievable by getTwinState", async () => {
    const { writeTwinState, getTwinState } = await import("./twinStore.js");
    await writeTwinState(makeState("bldg-1", "tempC", 28.5, "2025-01-01T12:00:00Z"));
    const result = await getTwinState({ objectId: "bldg-1" });
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(28.5);
  });

  it("getTwinState filters by metric", async () => {
    const { writeTwinState, getTwinState } = await import("./twinStore.js");
    await writeTwinState(makeState("sen-1", "tempC", 30, "2025-01-01T12:00:00Z"));
    await writeTwinState(makeState("sen-1", "co2Ppm", 450, "2025-01-01T12:00:01Z"));
    const result = await getTwinState({ objectId: "sen-1", metric: "tempC" });
    expect(result).toHaveLength(1);
    expect(result[0].metric).toBe("tempC");
  });

  it("getTwinState filters by since (inclusive)", async () => {
    const { writeTwinState, getTwinState } = await import("./twinStore.js");
    await writeTwinState(makeState("sen-1", "pm25", 10, "2025-01-01T10:00:00Z"));
    await writeTwinState(makeState("sen-1", "pm25", 20, "2025-01-01T12:00:00Z"));
    await writeTwinState(makeState("sen-1", "pm25", 30, "2025-01-01T14:00:00Z"));
    const result = await getTwinState({ objectId: "sen-1", since: "2025-01-01T12:00:00Z" });
    expect(result).toHaveLength(2);
    const values = result.map((r) => r.value).sort();
    expect(values).toEqual([20, 30]);
  });

  it("getTwinState filters by until (inclusive)", async () => {
    const { writeTwinState, getTwinState } = await import("./twinStore.js");
    await writeTwinState(makeState("sen-1", "pm25", 10, "2025-01-01T10:00:00Z"));
    await writeTwinState(makeState("sen-1", "pm25", 20, "2025-01-01T12:00:00Z"));
    await writeTwinState(makeState("sen-1", "pm25", 30, "2025-01-01T14:00:00Z"));
    const result = await getTwinState({ objectId: "sen-1", until: "2025-01-01T12:00:00Z" });
    expect(result).toHaveLength(2);
  });

  it("getTwinState returns results in descending time order", async () => {
    const { writeTwinState, getTwinState } = await import("./twinStore.js");
    await writeTwinState(makeState("sen-1", "tempC", 25, "2025-01-01T09:00:00Z"));
    await writeTwinState(makeState("sen-1", "tempC", 28, "2025-01-01T11:00:00Z"));
    await writeTwinState(makeState("sen-1", "tempC", 31, "2025-01-01T13:00:00Z"));
    const result = await getTwinState({ objectId: "sen-1" });
    expect(result[0].value).toBe(31); // newest first
    expect(result[2].value).toBe(25); // oldest last
  });

  it("getTwinState respects limit", async () => {
    const { writeTwinState, getTwinState } = await import("./twinStore.js");
    for (let i = 0; i < 10; i++) {
      await writeTwinState(makeState("sen-1", "pm25", i, `2025-01-01T${String(i).padStart(2, "0")}:00:00Z`));
    }
    const result = await getTwinState({ objectId: "sen-1", limit: 4 });
    expect(result).toHaveLength(4);
  });

  it("getTwinState returns empty for unknown objectId", async () => {
    const { getTwinState } = await import("./twinStore.js");
    const result = await getTwinState({ objectId: "ghost" });
    expect(result).toHaveLength(0);
  });
});

// ─── hydrateBuildingsFromGeoJSON ──────────────────────────────────────────

describe("hydrateBuildingsFromGeoJSON", () => {
  it("returns 0 for empty feature collection", async () => {
    const { hydrateBuildingsFromGeoJSON } = await import("./twinStore.js");
    const count = hydrateBuildingsFromGeoJSON({ features: [] });
    expect(count).toBe(0);
  });

  it("returns the number of features hydrated", async () => {
    const { hydrateBuildingsFromGeoJSON } = await import("./twinStore.js");
    const fc = {
      features: [
        { id: "f1", properties: {}, geometry: undefined },
        { id: "f2", properties: {}, geometry: undefined },
      ],
    };
    const count = hydrateBuildingsFromGeoJSON(fc);
    expect(count).toBe(2);
  });

  it("computes centroid of a polygon ring", async () => {
    const { hydrateBuildingsFromGeoJSON, findTwinObjects } = await import("./twinStore.js");
    // Simple 4-corner rectangle:
    // [100,13], [102,13], [102,15], [100,15], [100,13] (closing = 5 pts)
    // lng mean = (100+102+102+100+100)/5 = 100.8, lat mean = (13+13+15+15+13)/5 = 13.8
    const fc = {
      features: [{
        id: "poly-1",
        properties: { "name:en": "Test Building" },
        geometry: {
          type: "Polygon",
          coordinates: [[[100, 13], [102, 13], [102, 15], [100, 15], [100, 13]]],
        },
      }],
    };
    hydrateBuildingsFromGeoJSON(fc);
    const objs = await findTwinObjects({ kind: "building" });
    expect(objs).toHaveLength(1);
    expect(objs[0].lng).toBeCloseTo(100.8, 5);
    expect(objs[0].lat).toBeCloseTo(13.8, 5);
  });

  it("uses id from feature properties when present", async () => {
    const { hydrateBuildingsFromGeoJSON, getTwinObject } = await import("./twinStore.js");
    const fc = {
      features: [{
        id: "ignored",
        properties: { id: "prop-id-wins" },
        geometry: undefined,
      }],
    };
    hydrateBuildingsFromGeoJSON(fc);
    const obj = await getTwinObject("prop-id-wins");
    expect(obj).toBeDefined();
  });

  it("falls back to feature.id when properties.id is absent", async () => {
    const { hydrateBuildingsFromGeoJSON, getTwinObject } = await import("./twinStore.js");
    const fc = {
      features: [{
        id: "feat-id-used",
        properties: {},
        geometry: undefined,
      }],
    };
    hydrateBuildingsFromGeoJSON(fc);
    const obj = await getTwinObject("feat-id-used");
    expect(obj).toBeDefined();
  });

  it("computes computedHeightM as levels * 3.5", async () => {
    const { hydrateBuildingsFromGeoJSON, findTwinObjects } = await import("./twinStore.js");
    const fc = {
      features: [{
        id: "hi-rise",
        properties: { "building:levels": 10 },
        geometry: undefined,
      }],
    };
    hydrateBuildingsFromGeoJSON(fc);
    const objs = await findTwinObjects({});
    expect(objs[0].properties["computedHeightM"]).toBe(35); // 10 * 3.5
  });

  it("defaults to 1 level when building:levels is absent", async () => {
    const { hydrateBuildingsFromGeoJSON, findTwinObjects } = await import("./twinStore.js");
    const fc = {
      features: [{ id: "flat", properties: {}, geometry: undefined }],
    };
    hydrateBuildingsFromGeoJSON(fc);
    const objs = await findTwinObjects({});
    expect(objs[0].properties["computedLevels"]).toBe(1);
    expect(objs[0].properties["computedHeightM"]).toBe(3.5);
  });
});

// ─── twinSnapshot ─────────────────────────────────────────────────────────

describe("twinSnapshot (in-memory)", () => {
  it("counts objects, relations, and state points accurately", async () => {
    const { upsertTwinObject, addTwinRelation, writeTwinState, twinSnapshot } = await import("./twinStore.js");
    await upsertTwinObject(makeObj("b1", "building"));
    await upsertTwinObject(makeObj("b2", "building"));
    await addTwinRelation(makeRel("r1", "b1", "adjacent_to", "b2"));
    await writeTwinState(makeState("b1", "tempC", 25, "2025-01-01T12:00:00Z"));
    const snap = await twinSnapshot();
    expect(snap.objects).toBe(2);
    expect(snap.relations).toBe(1);
    expect(snap.statePoints).toBe(1);
    expect(snap.kindCounts["building"]).toBe(2);
  });
});
