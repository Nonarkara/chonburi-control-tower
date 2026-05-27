import { describe, it, expect, vi, beforeEach } from "vitest";
import twinApp from "./twin.js";

/**
 * twin.ts route integration tests.
 *
 * Uses Hono's built-in app.request() to call each route handler in-process —
 * no HTTP server needed. twinStore is mocked so tests are fast and isolated.
 *
 * Covered:
 *   - Objects CRUD (list, get, create, delete)
 *   - Relations API (list, create, related objects)
 *   - State time-series (query, latest, write)
 *   - Predictions aggregation (returns metric structure)
 *   - Snapshot diagnostics
 *   - Input validation (missing required fields → 400)
 */

vi.mock("../lib/twinStore.js", () => ({
  findTwinObjects:    vi.fn().mockResolvedValue([]),
  getTwinObject:      vi.fn().mockResolvedValue(null),
  upsertTwinObject:   vi.fn().mockImplementation(async (o) => o),
  deleteTwinObject:   vi.fn().mockResolvedValue(true),
  addTwinRelation:    vi.fn().mockImplementation(async (r) => r),
  getTwinRelations:   vi.fn().mockResolvedValue([]),
  getRelatedObjects:  vi.fn().mockResolvedValue([]),
  writeTwinState:     vi.fn().mockImplementation(async (p) => p),
  getTwinState:       vi.fn().mockResolvedValue([]),
  getTwinStateLatest: vi.fn().mockResolvedValue(null),
  twinSnapshot:       vi.fn().mockResolvedValue({ objects: 0, relations: 0, statePoints: 0 }),
}));

async function req(method: string, path: string, body?: unknown) {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return twinApp.request(path, init);
}

// ─── Objects ──────────────────────────────────────────────────────────────────

describe("GET /objects", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with items array and count", async () => {
    const res = await req("GET", "/objects");
    expect(res.status).toBe(200);
    const json = await res.json() as { items: unknown[]; count: number };
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.count).toBe(0);
  });

  it("passes kind query param to findTwinObjects", async () => {
    const { findTwinObjects } = await import("../lib/twinStore.js") as unknown as
      { findTwinObjects: ReturnType<typeof vi.fn> };
    await req("GET", "/objects?kind=building");
    const call = findTwinObjects.mock.calls[0][0];
    expect(call.kind).toBe("building");
  });

  it("parses bbox query param into a 4-element tuple", async () => {
    const { findTwinObjects } = await import("../lib/twinStore.js") as unknown as
      { findTwinObjects: ReturnType<typeof vi.fn> };
    await req("GET", "/objects?bbox=100.90,13.20,101.10,13.50");
    const call = findTwinObjects.mock.calls[0][0];
    expect(call.bbox).toEqual([100.90, 13.20, 101.10, 13.50]);
  });

  it("caps limit at 1000", async () => {
    const { findTwinObjects } = await import("../lib/twinStore.js") as unknown as
      { findTwinObjects: ReturnType<typeof vi.fn> };
    await req("GET", "/objects?limit=9999");
    const call = findTwinObjects.mock.calls[0][0];
    expect(call.limit).toBe(1000);
  });
});

describe("GET /objects/:id", () => {
  it("returns 404 when object not found", async () => {
    const res = await req("GET", "/objects/nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns 200 with the object when found", async () => {
    const { getTwinObject } = await import("../lib/twinStore.js") as unknown as
      { getTwinObject: ReturnType<typeof vi.fn> };
    const obj = { id: "b1", kind: "building", name: "City Hall", lat: 13.36, lng: 100.98, createdAt: "2026-01-01", updatedAt: "2026-01-01", properties: {} };
    getTwinObject.mockResolvedValueOnce(obj);
    const res = await req("GET", "/objects/b1");
    expect(res.status).toBe(200);
    const json = await res.json() as typeof obj;
    expect(json.id).toBe("b1");
  });
});

describe("POST /objects", () => {
  it("returns 400 when required fields are missing", async () => {
    const res = await req("POST", "/objects", { id: "x" }); // missing kind, name
    expect(res.status).toBe(400);
  });

  it("returns 201 with the created object", async () => {
    const payload = { id: "new-1", kind: "building", name: "New Building", lat: 13.36, lng: 100.98 };
    const res = await req("POST", "/objects", payload);
    expect(res.status).toBe(201);
    const json = await res.json() as { id: string };
    expect(json.id).toBe("new-1");
  });
});

describe("DELETE /objects/:id", () => {
  it("returns 200 when object exists and is deleted", async () => {
    const res = await req("DELETE", "/objects/b1");
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it("returns 404 when object not found", async () => {
    const { deleteTwinObject } = await import("../lib/twinStore.js") as unknown as
      { deleteTwinObject: ReturnType<typeof vi.fn> };
    deleteTwinObject.mockResolvedValueOnce(false);
    const res = await req("DELETE", "/objects/ghost");
    expect(res.status).toBe(404);
  });
});

// ─── Relations ────────────────────────────────────────────────────────────────

describe("GET /relations", () => {
  it("returns 200 with items and count", async () => {
    const res = await req("GET", "/relations");
    expect(res.status).toBe(200);
    const json = await res.json() as { items: unknown[]; count: number };
    expect(json.count).toBe(0);
  });
});

describe("POST /relations", () => {
  it("returns 400 when required fields are missing", async () => {
    const res = await req("POST", "/relations", { subjectId: "a" }); // missing predicate, objectId
    expect(res.status).toBe(400);
  });

  it("returns 201 with the created relation", async () => {
    const payload = { subjectId: "a", predicate: "contains", objectId: "b" };
    const res = await req("POST", "/relations", payload);
    expect(res.status).toBe(201);
    const json = await res.json() as { subjectId: string; predicate: string };
    expect(json.subjectId).toBe("a");
    expect(json.predicate).toBe("contains");
  });
});

describe("GET /objects/:id/related", () => {
  it("returns 200 with related objects list", async () => {
    const res = await req("GET", "/objects/b1/related");
    expect(res.status).toBe(200);
    const json = await res.json() as { items: unknown[]; count: number };
    expect(json.count).toBe(0);
  });
});

// ─── State ────────────────────────────────────────────────────────────────────

describe("GET /state", () => {
  it("returns 400 when objectId is missing", async () => {
    const res = await req("GET", "/state");
    expect(res.status).toBe(400);
  });

  it("returns 200 with items when objectId is provided", async () => {
    const res = await req("GET", "/state?objectId=city");
    expect(res.status).toBe(200);
    const json = await res.json() as { items: unknown[]; count: number };
    expect(Array.isArray(json.items)).toBe(true);
  });
});

describe("GET /state/latest", () => {
  it("returns 400 when objectId is missing", async () => {
    const res = await req("GET", "/state/latest");
    expect(res.status).toBe(400);
  });

  it("returns 404 when no state found for objectId", async () => {
    const res = await req("GET", "/state/latest?objectId=nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns 200 with the latest state point when found", async () => {
    const { getTwinStateLatest } = await import("../lib/twinStore.js") as unknown as
      { getTwinStateLatest: ReturnType<typeof vi.fn> };
    const point = { objectId: "city", metric: "aqi", value: 45.2, time: "2026-01-01T00:00:00Z", source: "test", properties: {} };
    getTwinStateLatest.mockResolvedValueOnce(point);
    const res = await req("GET", "/state/latest?objectId=city&metric=aqi");
    expect(res.status).toBe(200);
    const json = await res.json() as typeof point;
    expect(json.value).toBe(45.2);
  });
});

describe("POST /state", () => {
  it("returns 400 when required fields are missing", async () => {
    const res = await req("POST", "/state", { objectId: "city" }); // missing metric, value, source
    expect(res.status).toBe(400);
  });

  it("returns 400 when value is not a number", async () => {
    const res = await req("POST", "/state", { objectId: "city", metric: "aqi", value: "high", source: "test" });
    expect(res.status).toBe(400);
  });

  it("returns 201 with the written state point", async () => {
    const payload = { objectId: "city", metric: "aqi", value: 55.0, source: "aqicn" };
    const res = await req("POST", "/state", payload);
    expect(res.status).toBe(201);
    const json = await res.json() as { objectId: string; metric: string; value: number };
    expect(json.metric).toBe("aqi");
    expect(json.value).toBe(55.0);
  });
});

// ─── Predictions ──────────────────────────────────────────────────────────────

describe("GET /predictions", () => {
  it("returns 200 with a forecasts array", async () => {
    const res = await req("GET", "/predictions");
    expect(res.status).toBe(200);
    const json = await res.json() as { forecasts: unknown[]; count: number };
    expect(Array.isArray(json.forecasts)).toBe(true);
    expect(json.count).toBe(json.forecasts.length);
  });

  it("returns a forecast entry for each standard metric", async () => {
    const res = await req("GET", "/predictions");
    const json = await res.json() as { forecasts: { metric: string }[] };
    const metrics = json.forecasts.map((f) => f.metric);
    expect(metrics).toContain("precipitation.forecast");
    expect(metrics).toContain("aqi.forecast");
    expect(metrics).toContain("tideHeight.forecast");
    expect(metrics).toContain("incidentRate.forecast");
    expect(metrics).toContain("vesselCount.forecast");
  });
});

// ─── Snapshot ─────────────────────────────────────────────────────────────────

describe("GET /snapshot", () => {
  it("returns 200 with the twin store snapshot", async () => {
    const res = await req("GET", "/snapshot");
    expect(res.status).toBe(200);
    const json = await res.json() as { objects: number; relations: number };
    expect(typeof json.objects).toBe("number");
    expect(typeof json.relations).toBe("number");
  });
});
