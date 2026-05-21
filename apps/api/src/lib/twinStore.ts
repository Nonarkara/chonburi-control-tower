// Hybrid semantic twin store: PostgreSQL/PostGIS when available,
// in-memory fallback for Cloudflare Workers or when DATABASE_URL is unset.

export type TwinKind =
  | "building"
  | "sensor"
  | "road"
  | "reservoir"
  | "vessel"
  | "zone"
  | "poi"
  | "bridge"
  | "ferry"
  | "port";

export type TwinRelationPredicate =
  | "contains"
  | "monitors"
  | "adjacent_to"
  | "connected_to"
  | "serves"
  | "located_in"
  | "part_of";

export interface TwinObject {
  id: string;
  kind: TwinKind;
  name: string;
  nameTh?: string;
  nameEn?: string;
  lat: number;
  lng: number;
  geom?: unknown;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TwinRelation {
  id: string;
  subjectId: string;
  predicate: TwinRelationPredicate;
  objectId: string;
  properties?: Record<string, unknown>;
  createdAt: string;
}

export interface TwinStatePoint {
  time: string;
  objectId: string;
  metric: string;
  value: number;
  source: string;
  properties?: Record<string, unknown>;
}

// ── Lazy DB import ──────────────────────────────────────────────────────

let dbMod: typeof import("./twinDb.js") | null = null;
let dbReady = false;

async function getDb() {
  if (dbMod) return dbMod;
  try {
    dbMod = await import("./twinDb.js");
    dbReady = await dbMod.initTwinDb();
    return dbMod;
  } catch {
    dbReady = false;
    return null;
  }
}

export function isDbEnabled(): boolean {
  return dbReady;
}

// ── In-memory stores (fallback / cache) ─────────────────────────────────

const objects = new Map<string, TwinObject>();
const relations = new Map<string, TwinRelation>();
const stateSeries: TwinStatePoint[] = [];
const MAX_STATE_POINTS = 50_000;

// ── Object CRUD ─────────────────────────────────────────────────────────

export async function upsertTwinObject(obj: TwinObject): Promise<TwinObject> {
  obj.updatedAt = new Date().toISOString();
  objects.set(obj.id, obj);
  const db = await getDb();
  if (db) await db.dbUpsertObject(obj);
  return obj;
}

export async function getTwinObject(id: string): Promise<TwinObject | undefined> {
  // Check memory first
  const mem = objects.get(id);
  if (mem) return mem;
  // Fallback to DB
  const db = await getDb();
  if (db) {
    const row = await db.dbGetObject(id);
    if (row) {
      objects.set(id, row); // cache
      return row;
    }
  }
  return undefined;
}

export async function findTwinObjects(opts: {
  kind?: TwinKind;
  bbox?: [number, number, number, number];
  limit?: number;
}): Promise<TwinObject[]> {
  const db = await getDb();
  if (db && dbReady) {
    return db.dbFindObjects({ kind: opts.kind, bbox: opts.bbox, limit: opts.limit });
  }
  // In-memory fallback
  let result = Array.from(objects.values());
  if (opts.kind) result = result.filter((o) => o.kind === opts.kind);
  if (opts.bbox) {
    const [minLng, minLat, maxLng, maxLat] = opts.bbox;
    result = result.filter((o) => o.lng >= minLng && o.lng <= maxLng && o.lat >= minLat && o.lat <= maxLat);
  }
  if (opts.limit && opts.limit > 0) result = result.slice(0, opts.limit);
  return result;
}

export async function deleteTwinObject(id: string): Promise<boolean> {
  // Clean up relations from memory
  for (const [relId, rel] of relations) {
    if (rel.subjectId === id || rel.objectId === id) relations.delete(relId);
  }
  objects.delete(id);
  const db = await getDb();
  if (db) return db.dbDeleteObject(id);
  return true;
}

export async function countTwinObjects(): Promise<Record<TwinKind, number>> {
  const db = await getDb();
  if (db && dbReady) {
    const counts = await db.dbCountObjects();
    return counts as Record<TwinKind, number>;
  }
  const counts: Partial<Record<TwinKind, number>> = {};
  for (const o of objects.values()) {
    counts[o.kind] = (counts[o.kind] ?? 0) + 1;
  }
  return counts as Record<TwinKind, number>;
}

// ── Relations ───────────────────────────────────────────────────────────

export async function addTwinRelation(rel: TwinRelation): Promise<TwinRelation> {
  relations.set(rel.id, rel);
  const db = await getDb();
  if (db) await db.dbAddRelation(rel);
  return rel;
}

export async function getTwinRelations(opts: { subjectId?: string; objectId?: string; predicate?: TwinRelationPredicate }): Promise<TwinRelation[]> {
  const db = await getDb();
  if (db && dbReady) {
    return db.dbGetRelations({ subjectId: opts.subjectId, objectId: opts.objectId, predicate: opts.predicate });
  }
  let result = Array.from(relations.values());
  if (opts.subjectId) result = result.filter((r) => r.subjectId === opts.subjectId);
  if (opts.objectId) result = result.filter((r) => r.objectId === opts.objectId);
  if (opts.predicate) result = result.filter((r) => r.predicate === opts.predicate);
  return result;
}

export async function getRelatedObjects(objectId: string): Promise<Array<{ relation: TwinRelation; object: TwinObject; direction: "out" | "in" }>> {
  const db = await getDb();
  if (db && dbReady) {
    const rels = await db.dbGetRelations({ subjectId: objectId });
    const inn = await db.dbGetRelations({ objectId: objectId });
    const results: Array<{ relation: TwinRelation; object: TwinObject; direction: "out" | "in" }> = [];
    for (const rel of rels) {
      const obj = await getTwinObject(rel.objectId);
      if (obj) results.push({ relation: rel, object: obj, direction: "out" });
    }
    for (const rel of inn) {
      const obj = await getTwinObject(rel.subjectId);
      if (obj) results.push({ relation: rel, object: obj, direction: "in" });
    }
    return results;
  }

  const out = await getTwinRelations({ subjectId: objectId });
  const inn = await getTwinRelations({ objectId: objectId });
  const results: Array<{ relation: TwinRelation; object: TwinObject; direction: "out" | "in" }> = [];
  for (const rel of out) {
    const obj = objects.get(rel.objectId);
    if (obj) results.push({ relation: rel, object: obj, direction: "out" });
  }
  for (const rel of inn) {
    const obj = objects.get(rel.subjectId);
    if (obj) results.push({ relation: rel, object: obj, direction: "in" });
  }
  return results;
}

// ── State (time series) ─────────────────────────────────────────────────

export async function writeTwinState(point: TwinStatePoint): Promise<TwinStatePoint> {
  stateSeries.push(point);
  if (stateSeries.length > MAX_STATE_POINTS) {
    stateSeries.splice(0, stateSeries.length - MAX_STATE_POINTS);
  }
  const db = await getDb();
  if (db) await db.dbWriteState(point);
  return point;
}

export async function getTwinState(opts: {
  objectId: string;
  metric?: string;
  since?: string;
  until?: string;
  limit?: number;
}): Promise<TwinStatePoint[]> {
  const db = await getDb();
  if (db && dbReady) {
    return db.dbGetState({ objectId: opts.objectId, metric: opts.metric, since: opts.since, until: opts.until, limit: opts.limit });
  }
  let result = stateSeries.filter((s) => s.objectId === opts.objectId);
  if (opts.metric) result = result.filter((s) => s.metric === opts.metric);
  if (opts.since) {
    const t = new Date(opts.since).getTime();
    result = result.filter((s) => new Date(s.time).getTime() >= t);
  }
  if (opts.until) {
    const t = new Date(opts.until).getTime();
    result = result.filter((s) => new Date(s.time).getTime() <= t);
  }
  result.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  if (opts.limit && opts.limit > 0) result = result.slice(0, opts.limit);
  return result;
}

export async function getTwinStateLatest(opts: { objectId: string; metric?: string }): Promise<TwinStatePoint | undefined> {
  const db = await getDb();
  if (db && dbReady) {
    return db.dbGetStateLatest({ objectId: opts.objectId, metric: opts.metric });
  }
  const all = await getTwinState({ objectId: opts.objectId, metric: opts.metric });
  return all[0];
}

export async function getStateMetricsForObject(objectId: string): Promise<string[]> {
  const db = await getDb();
  if (db && dbReady) return db.dbGetStateMetrics(objectId);
  const metrics = new Set<string>();
  for (const s of stateSeries) {
    if (s.objectId === objectId) metrics.add(s.metric);
  }
  return Array.from(metrics);
}

// ── Snapshot ────────────────────────────────────────────────────────────

export async function twinSnapshot(): Promise<{
  objects: number;
  relations: number;
  statePoints: number;
  kindCounts: Record<string, number>;
}> {
  const db = await getDb();
  if (db && dbReady) return db.dbSnapshot();
  return {
    objects: objects.size,
    relations: relations.size,
    statePoints: stateSeries.length,
    kindCounts: await countTwinObjects(),
  };
}

// ── Hydration from GeoJSON / existing feeds ─────────────────────────────

export function hydrateBuildingsFromGeoJSON(fc: { features?: Array<{ properties?: Record<string, unknown>; geometry?: { type: string; coordinates: unknown }; id?: string | number }> }): number {
  let count = 0;
  for (const f of fc.features ?? []) {
    const props = f.properties ?? {};
    const id = String(props["id"] ?? f.id ?? `building-${count}`);
    const name = String(props["name:en"] ?? props["name"] ?? "Unknown Building");
    const nameTh = props["name:th"] ? String(props["name:th"]) : undefined;
    const levels = Number(props["building:levels"] ?? props["levels"] ?? 1);

    const geom = f.geometry as { type?: string; coordinates?: unknown } | undefined;
    let lat = 0;
    let lng = 0;
    if (geom && geom.type === "Polygon" && Array.isArray(geom.coordinates)) {
      const rings = geom.coordinates as Array<unknown>;
      if (Array.isArray(rings[0])) {
        const ring = rings[0] as Array<[number, number]>;
        let sumLng = 0;
        let sumLat = 0;
        for (const [x, y] of ring) {
          sumLng += x;
          sumLat += y;
        }
        lng = sumLng / ring.length;
        lat = sumLat / ring.length;
      }
    }

    const obj: TwinObject = {
      id,
      kind: "building",
      name,
      nameTh,
      nameEn: name,
      lat,
      lng,
      geom,
      properties: { ...props, computedLevels: levels, computedHeightM: levels * 3.5 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // Use synchronous memory insert; async DB insert can follow
    objects.set(id, obj);
    count++;
  }
  return count;
}

/** Async flush of in-memory objects to DB (call after hydrate). */
export async function flushMemoryToDb(): Promise<number> {
  const db = await getDb();
  if (!db || !dbReady) return 0;
  const all = Array.from(objects.values());
  const inserted = await db.dbBulkInsertObjects(all);
  console.log(`[twinStore] flushed ${inserted}/${all.length} objects to PostgreSQL`);
  return inserted;
}

export function hydrateSensorFromFahfon(reading: {
  station: string;
  lat?: number;
  lng?: number;
  tempC?: number;
  co2Ppm?: number;
  pm1?: number;
  pm25?: number;
  pm10?: number;
}): TwinObject {
  const id = `sensor-fahfon-${reading.station}`;
  const obj: TwinObject = {
    id,
    kind: "sensor",
    name: `FAHFON ${reading.station}`,
    lat: reading.lat ?? 13.36,
    lng: reading.lng ?? 100.98,
    properties: { sensorType: "fahfon", stationId: reading.station },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  objects.set(id, obj);

  const now = new Date().toISOString();
  if (typeof reading.tempC === "number") stateSeries.push({ time: now, objectId: id, metric: "tempC", value: reading.tempC, source: "fahfon" });
  if (typeof reading.co2Ppm === "number") stateSeries.push({ time: now, objectId: id, metric: "co2Ppm", value: reading.co2Ppm, source: "fahfon" });
  if (typeof reading.pm25 === "number") stateSeries.push({ time: now, objectId: id, metric: "pm25", value: reading.pm25, source: "fahfon" });
  if (typeof reading.pm10 === "number") stateSeries.push({ time: now, objectId: id, metric: "pm10", value: reading.pm10, source: "fahfon" });

  return obj;
}
