// In-memory semantic twin store (Phase 1).
// Graph of city objects + time-series state. Designed to migrate to
// PostgreSQL/PostGIS + TimescaleDB when persistence is needed.

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
  /** GeoJSON geometry as serializable object (Polygon, Point, etc.) */
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

// ---- In-memory stores ----

const objects = new Map<string, TwinObject>();
const relations = new Map<string, TwinRelation>();
const stateSeries: TwinStatePoint[] = [];
const MAX_STATE_POINTS = 50_000; // in-memory cap before rotation

// ---- Object CRUD ----

export function upsertTwinObject(obj: TwinObject): TwinObject {
  obj.updatedAt = new Date().toISOString();
  objects.set(obj.id, obj);
  return obj;
}

export function getTwinObject(id: string): TwinObject | undefined {
  return objects.get(id);
}

export function findTwinObjects(opts: {
  kind?: TwinKind;
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  limit?: number;
}): TwinObject[] {
  let result = Array.from(objects.values());
  if (opts.kind) {
    result = result.filter((o) => o.kind === opts.kind);
  }
  if (opts.bbox) {
    const [minLng, minLat, maxLng, maxLat] = opts.bbox;
    result = result.filter((o) => o.lng >= minLng && o.lng <= maxLng && o.lat >= minLat && o.lat <= maxLat);
  }
  if (opts.limit && opts.limit > 0) {
    result = result.slice(0, opts.limit);
  }
  return result;
}

export function deleteTwinObject(id: string): boolean {
  // Clean up relations
  for (const [relId, rel] of relations) {
    if (rel.subjectId === id || rel.objectId === id) {
      relations.delete(relId);
    }
  }
  return objects.delete(id);
}

export function countTwinObjects(): Record<TwinKind, number> {
  const counts: Partial<Record<TwinKind, number>> = {};
  for (const o of objects.values()) {
    counts[o.kind] = (counts[o.kind] ?? 0) + 1;
  }
  return counts as Record<TwinKind, number>;
}

// ---- Relations ----

export function addTwinRelation(rel: TwinRelation): TwinRelation {
  relations.set(rel.id, rel);
  return rel;
}

export function getTwinRelations(opts: { subjectId?: string; objectId?: string; predicate?: TwinRelationPredicate }): TwinRelation[] {
  let result = Array.from(relations.values());
  if (opts.subjectId) result = result.filter((r) => r.subjectId === opts.subjectId);
  if (opts.objectId) result = result.filter((r) => r.objectId === opts.objectId);
  if (opts.predicate) result = result.filter((r) => r.predicate === opts.predicate);
  return result;
}

export function getRelatedObjects(objectId: string): Array<{ relation: TwinRelation; object: TwinObject; direction: "out" | "in" }> {
  const out = getTwinRelations({ subjectId: objectId });
  const inn = getTwinRelations({ objectId: objectId });
  const results: Array<{ relation: TwinRelation; object: TwinObject; direction: "out" | "in" }> = [];
  for (const rel of out) {
    const obj = getTwinObject(rel.objectId);
    if (obj) results.push({ relation: rel, object: obj, direction: "out" });
  }
  for (const rel of inn) {
    const obj = getTwinObject(rel.subjectId);
    if (obj) results.push({ relation: rel, object: obj, direction: "in" });
  }
  return results;
}

// ---- State (time series) ----

export function writeTwinState(point: TwinStatePoint): TwinStatePoint {
  stateSeries.push(point);
  if (stateSeries.length > MAX_STATE_POINTS) {
    stateSeries.splice(0, stateSeries.length - MAX_STATE_POINTS);
  }
  return point;
}

export function getTwinState(opts: {
  objectId: string;
  metric?: string;
  since?: string;
  until?: string;
  limit?: number;
}): TwinStatePoint[] {
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
  // Sort newest first
  result.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  if (opts.limit && opts.limit > 0) {
    result = result.slice(0, opts.limit);
  }
  return result;
}

export function getTwinStateLatest(opts: { objectId: string; metric?: string }): TwinStatePoint | undefined {
  const all = getTwinState({ objectId: opts.objectId, metric: opts.metric });
  return all[0];
}

export function getStateMetricsForObject(objectId: string): string[] {
  const metrics = new Set<string>();
  for (const s of stateSeries) {
    if (s.objectId === objectId) metrics.add(s.metric);
  }
  return Array.from(metrics);
}

// ---- Snapshot (for diagnostics) ----

export function twinSnapshot(): {
  objects: number;
  relations: number;
  statePoints: number;
  kindCounts: Record<string, number>;
} {
  return {
    objects: objects.size,
    relations: relations.size,
    statePoints: stateSeries.length,
    kindCounts: countTwinObjects(),
  };
}

// ---- Hydration from GeoJSON / existing feeds ----

/** Bootstrap the twin from your existing building GeoJSON. */
export function hydrateBuildingsFromGeoJSON(fc: { features?: Array<{ properties?: Record<string, unknown>; geometry?: { type: string; coordinates: unknown }; id?: string | number }> }): number {
  let count = 0;
  for (const f of fc.features ?? []) {
    const props = f.properties ?? {};
    const id = String(props["id"] ?? f.id ?? `building-${count}`);
    const name = String(props["name:en"] ?? props["name"] ?? "Unknown Building");
    const nameTh = String(props["name:th"] ?? props["name"] ?? undefined);
    const levels = Number(props["building:levels"] ?? props["levels"] ?? 1);

    // Compute centroid from polygon
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

    upsertTwinObject({
      id,
      kind: "building",
      name,
      nameTh: nameTh !== "undefined" ? nameTh : undefined,
      nameEn: name,
      lat,
      lng,
      geom,
      properties: { ...props, computedLevels: levels, computedHeightM: levels * 3.5 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    count++;
  }
  return count;
}

/** Bootstrap sensors from FAHFON readings. */
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
  upsertTwinObject(obj);

  // Write current state
  const now = new Date().toISOString();
  if (typeof reading.tempC === "number") writeTwinState({ time: now, objectId: id, metric: "tempC", value: reading.tempC, source: "fahfon" });
  if (typeof reading.co2Ppm === "number") writeTwinState({ time: now, objectId: id, metric: "co2Ppm", value: reading.co2Ppm, source: "fahfon" });
  if (typeof reading.pm25 === "number") writeTwinState({ time: now, objectId: id, metric: "pm25", value: reading.pm25, source: "fahfon" });
  if (typeof reading.pm10 === "number") writeTwinState({ time: now, objectId: id, metric: "pm10", value: reading.pm10, source: "fahfon" });

  return obj;
}
