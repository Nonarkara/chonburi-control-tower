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

twinApp.get("/objects", async (c) => {
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

twinApp.get("/objects/:id", async (c) => {
  const obj = await getTwinObject(c.req.param("id"));
  if (!obj) return c.json({ error: "Not found" }, 404);
  return c.json(obj);
});

twinApp.post("/objects", async (c) => {
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

twinApp.delete("/objects/:id", async (c) => {
  const ok = await deleteTwinObject(c.req.param("id"));
  if (!ok) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// ---- Relations ----

twinApp.get("/relations", async (c) => {
  const q = c.req.query();
  const items = await getTwinRelations({
    subjectId: q.subjectId,
    objectId: q.objectId,
    predicate: q.predicate as TwinRelationPredicate | undefined,
  });
  return c.json({ items, count: items.length });
});

twinApp.post("/relations", async (c) => {
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

twinApp.get("/objects/:id/related", async (c) => {
  const items = await getRelatedObjects(c.req.param("id"));
  return c.json({ items, count: items.length });
});

// ---- State (time series) ----

twinApp.get("/state", async (c) => {
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

twinApp.get("/state/latest", async (c) => {
  const q = c.req.query();
  const objectId = q.objectId;
  if (!objectId) return c.json({ error: "Required query: objectId" }, 400);
  const point = await getTwinStateLatest({ objectId, metric: q.metric });
  if (!point) return c.json({ error: "No state found" }, 404);
  return c.json(point);
});

twinApp.post("/state", async (c) => {
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

// ---- Predictions (TimesFM zero-shot forecasts persisted by the Python service) ----

const FORECAST_METRICS = [
  { key: "precipitation.forecast", label: "Rain",      unit: "mm",  alertThreshold: 50  },
  { key: "tideHeight.forecast",    label: "Tide",      unit: "m",   alertThreshold: 2.5 },
  { key: "incidentRate.forecast",  label: "Incidents", unit: "/h",  alertThreshold: 5   },
  { key: "aqi.forecast",           label: "AQI",       unit: "",    alertThreshold: 100 },
  { key: "vesselCount.forecast",   label: "Vessels",   unit: "",    alertThreshold: 50  },
] as const;

twinApp.get("/predictions", async (c) => {
  // Only return forecasts generated in the last 2 hours (stale = Python service down)
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const horizon = Math.min(parseInt(c.req.query("horizon") ?? "24", 10) || 24, 48);

  const forecasts = await Promise.all(
    FORECAST_METRICS.map(async (fm) => {
      const items = await getTwinState({
        objectId: "city",
        metric: fm.key,
        since,
        limit: horizon,
      });
      const props0 = items[0]?.properties as Record<string, unknown> | null;
      return {
        metric: fm.key,
        label:  fm.label,
        unit:   fm.unit,
        alertThreshold: fm.alertThreshold,
        generatedAt: props0?.generated_at ?? null,
        horizon: items.map((pt) => {
          const p = pt.properties as Record<string, number> | null;
          return { time: pt.time, p50: pt.value, p10: p?.p10 ?? null, p90: p?.p90 ?? null };
        }),
      };
    })
  );

  return c.json({ forecasts, count: forecasts.length });
});

// ---- Diagnostics ----

twinApp.get("/snapshot", async (c) => c.json(await twinSnapshot()));

export default twinApp;
