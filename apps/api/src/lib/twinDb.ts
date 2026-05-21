// PostgreSQL/PostGIS twin persistence layer.
// Falls back to in-memory store when no DATABASE_URL is configured
// (e.g. Cloudflare Workers runtime).

import type { TwinObject, TwinRelation, TwinStatePoint } from "./twinStore.js";

let pgModule: typeof import("pg") | null = null;

// Lazy-load pg only on Node runtime
async function getPg() {
  if (pgModule) return pgModule;
  if (typeof process === "undefined" || !process.versions?.node) return null;
  try {
    pgModule = await import("pg");
    return pgModule;
  } catch {
    return null;
  }
}

let pool: import("pg").Pool | null = null;

function getPool(): import("pg").Pool | null {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const pg = pgModule;
  if (!pg) return null;
  pool = new pg.Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  pool.on("error", (err) => {
    console.error("[twinDb] unexpected pool error", err);
    pool = null;
  });
  return pool;
}

export async function initTwinDb(): Promise<boolean> {
  await getPg();
  const p = getPool();
  if (!p) return false;
  try {
    await p.query("SELECT 1");
    console.log("[twinDb] PostgreSQL connected");
    return true;
  } catch (err) {
    console.error("[twinDb] connection failed:", (err as Error).message);
    pool = null;
    return false;
  }
}

export function isTwinDbEnabled(): boolean {
  return !!process.env.DATABASE_URL && !!pgModule;
}

// ── Object CRUD ─────────────────────────────────────────────────────────

/** Always returns a GeoJSON string usable by ST_GeomFromGeoJSON. */
function geomJson(obj: { geom?: unknown; lng: number; lat: number }): string {
  return obj.geom
    ? JSON.stringify(obj.geom)
    : JSON.stringify({ type: "Point", coordinates: [obj.lng, obj.lat] });
}

export async function dbUpsertObject(obj: TwinObject): Promise<void> {
  const p = getPool();
  if (!p) return;
  const geom = geomJson(obj);
  await p.query(
    `INSERT INTO twin_objects (id, kind, name, name_th, name_en, lat, lng, geom, properties, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, ST_GeomFromGeoJSON($8), $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       kind = EXCLUDED.kind,
       name = EXCLUDED.name,
       name_th = EXCLUDED.name_th,
       name_en = EXCLUDED.name_en,
       lat = EXCLUDED.lat,
       lng = EXCLUDED.lng,
       geom = EXCLUDED.geom,
       properties = EXCLUDED.properties,
       updated_at = EXCLUDED.updated_at`,
    [obj.id, obj.kind, obj.name, obj.nameTh ?? null, obj.nameEn ?? null, obj.lat, obj.lng, geom, JSON.stringify(obj.properties), obj.createdAt, obj.updatedAt],
  );
}

export async function dbGetObject(id: string): Promise<TwinObject | undefined> {
  const p = getPool();
  if (!p) return undefined;
  const { rows } = await p.query(
    `SELECT id, kind, name, name_th AS "nameTh", name_en AS "nameEn", lat, lng, ST_AsGeoJSON(geom)::json AS geom, properties, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM twin_objects WHERE id = $1`,
    [id],
  );
  if (!rows[0]) return undefined;
  return rowToObject(rows[0]);
}

export async function dbFindObjects(opts: { kind?: string; bbox?: [number, number, number, number]; limit?: number }): Promise<TwinObject[]> {
  const p = getPool();
  if (!p) return [];
  let sql = `SELECT id, kind, name, name_th AS "nameTh", name_en AS "nameEn", lat, lng, ST_AsGeoJSON(geom)::json AS geom, properties, created_at AS "createdAt", updated_at AS "updatedAt"
             FROM twin_objects WHERE 1=1`;
  const params: (string | number)[] = [];
  if (opts.kind) {
    params.push(opts.kind);
    sql += ` AND kind = $${params.length}`;
  }
  if (opts.bbox) {
    const [minLng, minLat, maxLng, maxLat] = opts.bbox;
    params.push(minLng, minLat, maxLng, maxLat);
    const base = params.length - 3;
    sql += ` AND ST_Intersects(geom, ST_MakeEnvelope($${base}, $${base+1}, $${base+2}, $${base+3}, 4326))`;
  }
  sql += ` ORDER BY updated_at DESC`;
  if (opts.limit && opts.limit > 0) {
    params.push(opts.limit);
    sql += ` LIMIT $${params.length}`;
  }
  const { rows } = await p.query(sql, params);
  return rows.map(rowToObject);
}

export async function dbDeleteObject(id: string): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  const { rowCount } = await p.query(`DELETE FROM twin_objects WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

export async function dbCountObjects(): Promise<Record<string, number>> {
  const p = getPool();
  if (!p) return {};
  const { rows } = await p.query(`SELECT kind, COUNT(*) AS n FROM twin_objects GROUP BY kind`);
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.kind] = Number(r.n);
  return counts;
}

// ── Relations ───────────────────────────────────────────────────────────

export async function dbAddRelation(rel: TwinRelation): Promise<void> {
  const p = getPool();
  if (!p) return;
  await p.query(
    `INSERT INTO twin_relations (id, subject_id, predicate, object_id, properties, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (subject_id, predicate, object_id) DO UPDATE SET
       properties = EXCLUDED.properties,
       created_at = EXCLUDED.created_at`,
    [rel.id, rel.subjectId, rel.predicate, rel.objectId, JSON.stringify(rel.properties ?? {}), rel.createdAt],
  );
}

export async function dbGetRelations(opts: { subjectId?: string; objectId?: string; predicate?: string }): Promise<TwinRelation[]> {
  const p = getPool();
  if (!p) return [];
  let sql = `SELECT id, subject_id AS "subjectId", predicate, object_id AS "objectId", properties, created_at AS "createdAt"
             FROM twin_relations WHERE 1=1`;
  const params: string[] = [];
  if (opts.subjectId) { params.push(opts.subjectId); sql += ` AND subject_id = $${params.length}`; }
  if (opts.objectId) { params.push(opts.objectId); sql += ` AND object_id = $${params.length}`; }
  if (opts.predicate) { params.push(opts.predicate); sql += ` AND predicate = $${params.length}`; }
  const { rows } = await p.query(sql, params);
  return rows.map((r) => ({
    id: r.id,
    subjectId: r.subjectId,
    predicate: r.predicate,
    objectId: r.objectId,
    properties: typeof r.properties === "string" ? JSON.parse(r.properties) : r.properties,
    createdAt: r.createdAt,
  }));
}

// ── State ───────────────────────────────────────────────────────────────

export async function dbWriteState(point: TwinStatePoint): Promise<void> {
  const p = getPool();
  if (!p) return;
  await p.query(
    `INSERT INTO twin_state (time, object_id, metric, value, source, properties)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [point.time, point.objectId, point.metric, point.value, point.source, JSON.stringify(point.properties ?? {})],
  );
}

export async function dbGetState(opts: { objectId: string; metric?: string; since?: string; until?: string; limit?: number }): Promise<TwinStatePoint[]> {
  const p = getPool();
  if (!p) return [];
  let sql = `SELECT time, object_id AS "objectId", metric, value, source, properties
             FROM twin_state WHERE object_id = $1`;
  const params: (string | number)[] = [opts.objectId];
  if (opts.metric) { params.push(opts.metric); sql += ` AND metric = $${params.length}`; }
  if (opts.since) { params.push(opts.since); sql += ` AND time >= $${params.length}`; }
  if (opts.until) { params.push(opts.until); sql += ` AND time <= $${params.length}`; }
  sql += ` ORDER BY time DESC`;
  if (opts.limit && opts.limit > 0) { params.push(opts.limit); sql += ` LIMIT $${params.length}`; }
  const { rows } = await p.query(sql, params);
  return rows.map((r) => ({
    time: r.time,
    objectId: r.objectId,
    metric: r.metric,
    value: Number(r.value),
    source: r.source,
    properties: typeof r.properties === "string" ? JSON.parse(r.properties) : r.properties,
  }));
}

export async function dbGetStateLatest(opts: { objectId: string; metric?: string }): Promise<TwinStatePoint | undefined> {
  const results = await dbGetState({ ...opts, limit: 1 });
  return results[0];
}

export async function dbGetStateMetrics(objectId: string): Promise<string[]> {
  const p = getPool();
  if (!p) return [];
  const { rows } = await p.query(
    `SELECT DISTINCT metric FROM twin_state WHERE object_id = $1`,
    [objectId],
  );
  return rows.map((r) => r.metric);
}

export async function dbSnapshot(): Promise<{ objects: number; relations: number; statePoints: number; kindCounts: Record<string, number> }> {
  const p = getPool();
  if (!p) return { objects: 0, relations: 0, statePoints: 0, kindCounts: {} };
  const { rows } = await p.query(`SELECT * FROM twin_counts()`);
  const r = rows[0];
  const kindCounts = await dbCountObjects();
  return {
    objects: Number(r.objects),
    relations: Number(r.relations),
    statePoints: Number(r.state_points),
    kindCounts,
  };
}

// ── Migration helpers ───────────────────────────────────────────────────

export async function dbBulkInsertObjects(objects: TwinObject[]): Promise<number> {
  const p = getPool();
  if (!p) return 0;
  let inserted = 0;
  const CHUNK = 500; // ~11 params each → well within Postgres 65535 param limit
  for (let i = 0; i < objects.length; i += CHUNK) {
    const chunk = objects.slice(i, i + CHUNK);
    const values: (string | number | null)[] = [];
    const placeholders = chunk.map((obj, j) => {
      const base = j * 11;
      values.push(
        obj.id, obj.kind, obj.name,
        obj.nameTh ?? null, obj.nameEn ?? null,
        obj.lat, obj.lng, geomJson(obj),
        JSON.stringify(obj.properties), obj.createdAt, obj.updatedAt,
      );
      return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},ST_GeomFromGeoJSON($${base+8}),$${base+9},$${base+10},$${base+11})`;
    });
    await p.query(
      `INSERT INTO twin_objects (id,kind,name,name_th,name_en,lat,lng,geom,properties,created_at,updated_at)
       VALUES ${placeholders.join(",")}
       ON CONFLICT (id) DO NOTHING`,
      values,
    );
    inserted += chunk.length;
  }
  return inserted;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function rowToObject(r: Record<string, unknown>): TwinObject {
  return {
    id: String(r.id),
    kind: String(r.kind) as TwinObject["kind"],
    name: String(r.name),
    nameTh: r.nameTh ? String(r.nameTh) : undefined,
    nameEn: r.nameEn ? String(r.nameEn) : undefined,
    lat: Number(r.lat),
    lng: Number(r.lng),
    geom: r.geom ?? undefined,
    properties: typeof r.properties === "string" ? JSON.parse(r.properties) : (r.properties ?? {}),
    createdAt: String(r.createdAt),
    updatedAt: String(r.updatedAt),
  };
}
