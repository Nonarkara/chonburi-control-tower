import { Hono } from "hono";
import {
  upsertTwinObject,
  getTwinObject,
  findTwinObjects,
  deleteTwinObject,
  addTwinRelation,
  getTwinRelations,
  getRelatedObjects,
  writeTwinState,
  getTwinState,
  getTwinStateLatest,
  twinSnapshot,
  type TwinObject,
  type TwinKind,
  type TwinRelationPredicate,
} from "../lib/twinStore.js";

const twinApp = new Hono();

// ---- Objects ----

twinApp.get("/api/twin/objects", async (c) => {
  const q = c.req.query();
  const kind = q.kind as TwinKind | undefined;
  const limit = q.limit ? Math.min(parseInt(q.limit, 10) || 100, 1000) : 100;
  let bbox: [number, number, number, number] | undefined;
  if (q.bbox) {
    const parts = q.bbox.split(",").map(Number);
    if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
      bbox = parts as [number, number, number, number];
    }
  }
  const items = await findTwinObjects({ kind, bbox, limit });
  return c.json({ items, count: items.length });
});

twinApp.get("/api/twin/objects/:id", async (c) => {
  const obj = await getTwinObject(c.req.param("id"));
  if (!obj) return c.json({ error: "Not found" }, 404);
  return c.json(obj);
});

twinApp.post("/api/twin/objects", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Partial<TwinObject>;
  if (!body.id || !body.kind || !body.name) {
    return c.json({ error: "Required: id, kind, name" }, 400);
  }
  const obj = await upsertTwinObject({
    id: body.id,
    kind: body.kind as TwinKind,
    name: body.name,
    nameTh: body.nameTh,
    nameEn: body.nameEn,
    lat: body.lat ?? 0,
    lng: body.lng ?? 0,
    geom: body.geom,
    properties: body.properties ?? {},
    createdAt: body.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return c.json(obj, 201);
});

twinApp.delete("/api/twin/objects/:id", async (c) => {
  const ok = await deleteTwinObject(c.req.param("id"));
  if (!ok) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// ---- Relations ----

twinApp.get("/api/twin/relations", async (c) => {
  const q = c.req.query();
  const items = await getTwinRelations({
    subjectId: q.subjectId,
    objectId: q.objectId,
    predicate: q.predicate as TwinRelationPredicate | undefined,
  });
  return c.json({ items, count: items.length });
});

twinApp.post("/api/twin/relations", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    subjectId: string;
    predicate: TwinRelationPredicate;
    objectId: string;
    properties?: Record<string, unknown>;
  };
  if (!body.subjectId || !body.predicate || !body.objectId) {
    return c.json({ error: "Required: subjectId, predicate, objectId" }, 400);
  }
  const rel = await addTwinRelation({
    id: `${body.subjectId}-${body.predicate}-${body.objectId}-${Date.now()}`,
    subjectId: body.subjectId,
    predicate: body.predicate,
    objectId: body.objectId,
    properties: body.properties ?? {},
    createdAt: new Date().toISOString(),
  });
  return c.json(rel, 201);
});

twinApp.get("/api/twin/objects/:id/related", async (c) => {
  const items = await getRelatedObjects(c.req.param("id"));
  return c.json({ items, count: items.length });
});

// ---- State (time series) ----

twinApp.get("/api/twin/state", async (c) => {
  const q = c.req.query();
  const objectId = q.objectId;
  if (!objectId) return c.json({ error: "Required query: objectId" }, 400);
  const items = await getTwinState({
    objectId,
    metric: q.metric,
    since: q.since,
    until: q.until,
    limit: q.limit ? parseInt(q.limit, 10) || 100 : 100,
  });
  return c.json({ items, count: items.length });
});

twinApp.get("/api/twin/state/latest", async (c) => {
  const q = c.req.query();
  const objectId = q.objectId;
  if (!objectId) return c.json({ error: "Required query: objectId" }, 400);
  const point = await getTwinStateLatest({ objectId, metric: q.metric });
  if (!point) return c.json({ error: "No state found" }, 404);
  return c.json(point);
});

twinApp.post("/api/twin/state", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    objectId: string;
    metric: string;
    value: number;
    source: string;
    properties?: Record<string, unknown>;
  };
  if (!body.objectId || !body.metric || typeof body.value !== "number" || !body.source) {
    return c.json({ error: "Required: objectId, metric, value, source" }, 400);
  }
  const point = await writeTwinState({
    time: new Date().toISOString(),
    objectId: body.objectId,
    metric: body.metric,
    value: body.value,
    source: body.source,
    properties: body.properties ?? {},
  });
  return c.json(point, 201);
});

// ---- Diagnostics ----

twinApp.get("/api/twin/snapshot", async (c) => c.json(await twinSnapshot()));

export default twinApp;
