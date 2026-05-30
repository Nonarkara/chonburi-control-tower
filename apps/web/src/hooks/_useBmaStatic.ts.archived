import { useEffect, useState } from "react";
import type { Feature, FeatureCollection, Geometry, Point, Polygon, MultiPolygon } from "geojson";
import type { BmaPoi } from "../map/layers";

interface AqStationProps {
  AIRSTATION_ID?: string;
  NAME_T?: string;
  NAME_E?: string;
  PM10?: number | null;
  PM25?: number | null;
  ADDRESS?: string;
}
interface ParkProps {
  PARK_NAME_T?: string;
  PARK_NAME_E?: string;
  OWNER?: string;
  RAI?: number;
}

export interface BmaStaticSet {
  pois: BmaPoi[];                  // points (hospitals, fire, police, etc.)
  parks: FeatureCollection<Polygon | MultiPolygon, ParkProps>;
  aqStations: FeatureCollection<Point, AqStationProps>;
}

// Each entry maps a static GeoJSON file to a POI kind. Points only.
const POINT_LAYERS: Array<{ file: string; kind: BmaPoi["kind"]; name: (p: Record<string, unknown>) => string; desc?: (p: Record<string, unknown>) => string | undefined }> = [
  { file: "/geo/bma/hospitals.geojson",        kind: "hospital",       name: (p) => (p.NAME_T as string) ?? "Hospital",          desc: (p) => p.NUM_BED ? `${p.NUM_BED} beds` : undefined },
  { file: "/geo/bma/health-centers.geojson",   kind: "health-center",  name: (p) => (p.NAME_T as string) ?? "Health center" },
  { file: "/geo/bma/police-stations.geojson",  kind: "police-station", name: (p) => (p.NAME_T as string) ?? "Police" },
  { file: "/geo/bma/fire-stations.geojson",    kind: "fire-station",   name: (p) => (p.NAME_T as string) ?? "Fire station" },
  { file: "/geo/bma/fire-hydrants.geojson",    kind: "other",          name: () => "Hydrant" },
  { file: "/geo/bma/bma-offices.geojson",      kind: "bma-office",     name: (p) => (p.NAME_T as string) ?? "BMA office" },
  { file: "/geo/bma/mea-offices.geojson",      kind: "bma-office",     name: (p) => (p.NAME_T as string) ?? "MEA office" },
  { file: "/geo/bma/dept-stores.geojson",      kind: "market",         name: (p) => (p.NAME_T as string) ?? "Store" },
  { file: "/geo/bma/aed-points.geojson",       kind: "other",          name: () => "AED" },
];

interface RawGeoFeature {
  geometry: Geometry;
  properties: Record<string, unknown>;
}

function isPoint(g: Geometry): g is Point {
  return g?.type === "Point" && Array.isArray(g.coordinates) && g.coordinates.length >= 2;
}

async function loadOne(entry: (typeof POINT_LAYERS)[number], signal: AbortSignal): Promise<BmaPoi[]> {
  try {
    const res = await fetch(entry.file, { signal });
    if (!res.ok) return [];
    const fc = (await res.json()) as { features?: RawGeoFeature[] };
    const out: BmaPoi[] = [];
    for (const f of fc.features ?? []) {
      if (!isPoint(f.geometry)) continue;
      const [lng, lat] = f.geometry.coordinates as [number, number];
      out.push({
        id: `${entry.kind}-${entry.file}-${lng.toFixed(5)}-${lat.toFixed(5)}`,
        kind: entry.kind,
        name: entry.name(f.properties),
        description: entry.desc?.(f.properties),
        lat,
        lng,
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function loadFc<TProps>(path: string, signal: AbortSignal): Promise<FeatureCollection<Polygon | MultiPolygon, TProps>> {
  try {
    const res = await fetch(path, { signal });
    if (!res.ok) return { type: "FeatureCollection", features: [] };
    return (await res.json()) as FeatureCollection<Polygon | MultiPolygon, TProps>;
  } catch {
    return { type: "FeatureCollection", features: [] };
  }
}

async function loadAq(path: string, signal: AbortSignal): Promise<FeatureCollection<Point, AqStationProps>> {
  try {
    const res = await fetch(path, { signal });
    if (!res.ok) return { type: "FeatureCollection", features: [] };
    const fc = (await res.json()) as { features?: Array<{ geometry: Geometry; properties: AqStationProps }> };
    const features: Feature<Point, AqStationProps>[] = [];
    for (const f of fc.features ?? []) {
      if (!isPoint(f.geometry)) continue;
      features.push({
        type: "Feature",
        geometry: f.geometry,
        properties: f.properties,
      });
    }
    return { type: "FeatureCollection", features };
  } catch {
    return { type: "FeatureCollection", features: [] };
  }
}

export function useBmaStatic(): BmaStaticSet | null {
  const [data, setData] = useState<BmaStaticSet | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      Promise.all(POINT_LAYERS.map((e) => loadOne(e, ctrl.signal))),
      loadFc<ParkProps>("/geo/bma/parks.geojson", ctrl.signal),
      loadAq("/geo/bma/aq-stations.geojson", ctrl.signal),
    ]).then(([pointSets, parks, aqStations]) => {
      if (ctrl.signal.aborted) return;
      const pois = pointSets.flat();
      setData({ pois, parks, aqStations });
    });
    return () => {
      ctrl.abort();
    };
  }, []);
  return data;
}
