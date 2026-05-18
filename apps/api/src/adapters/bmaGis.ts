import type { NormalizedFeed } from "@chula/shared";
import { cacheAgeMinutes, cached } from "../lib/cache.js";
import { inBbox, OUTER_BBOX } from "../lib/bbox.js";
import { fetchJsonOrNull } from "./common.js";

// BMA ArcGIS FeatureServer base. Layer paths follow the published catalog at
// https://bmagis.bangkok.go.th/arcgis/rest/services. Some service names are
// well-known (FLOODGATE, PublicHealthCenter); others are best-guess. Adapter
// gracefully drops layers that 404 so we never block on unknowns.

const BASE = "https://bmagis.bangkok.go.th/arcgis/rest/services";

export type BmaPoiKind =
  | "hospital"
  | "health-center"
  | "school"
  | "fire-station"
  | "police-station"
  | "park"
  | "market"
  | "bma-office"
  | "flood-gate"
  | "pump-station"
  | "cctv"
  | "bus-stop"
  | "other";

export interface BmaPoi {
  id: string;
  kind: BmaPoiKind;
  name: string;
  lat: number;
  lng: number;
  description?: string;
  raw?: Record<string, unknown>;
}

interface ServiceDef {
  kind: BmaPoiKind;
  layerId: string;        // /service/FeatureServer/<n>
  nameFields: string[];   // tried in order
  descFields?: string[];
}

// Service names verified against the live BMA ArcGIS catalog
// (curl https://bmagis.bangkok.go.th/arcgis/rest/services/BMA?f=json).
// Field names use NAME_T / NAME_E (Thai/English) as the BMA convention.
const NAME_FIELDS = ["NAME_T", "NAME_TH", "NAME_E", "NAME", "name", "Name"];

const SERVICES: ServiceDef[] = [
  { kind: "flood-gate",     layerId: "BMA/FLOODGATE/FeatureServer/0",                      nameFields: NAME_FIELDS, descFields: ["TYPE_GATE", "ADDRESS"] },
  { kind: "health-center",  layerId: "BMA/PublicHealthCenter/FeatureServer/0",             nameFields: NAME_FIELDS, descFields: ["TYPE_TH", "TYPE"] },
  { kind: "health-center",  layerId: "BMA/BranchPublicHealthCenter/FeatureServer/0",       nameFields: NAME_FIELDS },
  { kind: "hospital",       layerId: "BMA/Hospital_Location/FeatureServer/0",              nameFields: NAME_FIELDS, descFields: ["TYPE_TH", "TYPE"] },
  { kind: "school",         layerId: "BMA/SCHOOL_FORMAL/FeatureServer/0",                  nameFields: NAME_FIELDS },
  { kind: "school",         layerId: "BMA/SCHOOL_OTHER/FeatureServer/0",                   nameFields: NAME_FIELDS },
  { kind: "police-station", layerId: "BMA/Police_Station/FeatureServer/0",                 nameFields: NAME_FIELDS },
  { kind: "park",           layerId: "BMA/PUBLIC_PARK/FeatureServer/0",                    nameFields: NAME_FIELDS },
  { kind: "bma-office",     layerId: "BMA/BMA_Office/FeatureServer/0",                     nameFields: NAME_FIELDS, descFields: ["TYPE_TH", "DISTRICT"] },
  { kind: "pump-station",   layerId: "BMA/PUMP_STATION/FeatureServer/0",                   nameFields: NAME_FIELDS },
  { kind: "fire-station",   layerId: "riskbkk/RISK_ADMIN_FireStation_2567/FeatureServer/0", nameFields: NAME_FIELDS },
  { kind: "market",         layerId: "riskbkk/RISK_ADMIN_DepartmentStore/FeatureServer/0", nameFields: NAME_FIELDS, descFields: ["TYPE_TH"] },
];

const TTL_SECONDS = 60 * 60; // 1h — POIs barely move

interface GeoJsonFeature {
  geometry: { type: string; coordinates: number[] | number[][] };
  properties: Record<string, unknown>;
}

function bboxEnvelope() {
  // ArcGIS spatial filter uses 4326 envelope: xmin,ymin,xmax,ymax
  return `${OUTER_BBOX.minLng},${OUTER_BBOX.minLat},${OUTER_BBOX.maxLng},${OUTER_BBOX.maxLat}`;
}

function buildUrl(layerId: string): string {
  // ArcGIS dislikes URL-encoded commas in the geometry envelope, so we build
  // the query string by hand and only encode the `where` clause.
  const env = bboxEnvelope();
  const qs = [
    `where=${encodeURIComponent("1=1")}`,
    "outFields=*",
    "f=geojson",
    "outSR=4326",
    `geometry=${env}`,
    "geometryType=esriGeometryEnvelope",
    "inSR=4326",
    "spatialRel=esriSpatialRelIntersects",
    "resultRecordCount=200",
  ].join("&");
  return `${BASE}/${layerId}/query?${qs}`;
}

function pickField(props: Record<string, unknown>, fields: string[]): string | undefined {
  for (const f of fields) {
    const v = props[f];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

async function fetchService(svc: ServiceDef): Promise<BmaPoi[]> {
  const url = buildUrl(svc.layerId);
  const payload = await fetchJsonOrNull<{ features?: GeoJsonFeature[] }>(url);
  if (!payload?.features) return [];

  const out: BmaPoi[] = [];
  for (const f of payload.features) {
    const g = f.geometry;
    if (!g) continue;

    let lng: number | null = null;
    let lat: number | null = null;
    if (g.type === "Point" && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
      lng = Number(g.coordinates[0]);
      lat = Number(g.coordinates[1]);
    }
    if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!inBbox(lng, lat)) continue;

    const name = pickField(f.properties, svc.nameFields) ?? "—";
    const description = svc.descFields ? pickField(f.properties, svc.descFields) : undefined;

    out.push({
      id: `${svc.kind}-${svc.layerId.split("/")[1] ?? "unknown"}-${lng.toFixed(5)}-${lat.toFixed(5)}`,
      kind: svc.kind,
      name,
      lat,
      lng,
      description,
      raw: f.properties,
    });
  }
  return out;
}

export async function fetchBmaPois(): Promise<NormalizedFeed<BmaPoi>> {
  return cached("bma-pois", TTL_SECONDS, async () => {
    const fetchedAt = new Date().toISOString();
    const settled = await Promise.allSettled(SERVICES.map(fetchService));
    const features: BmaPoi[] = [];
    for (const r of settled) {
      if (r.status === "fulfilled") features.push(...r.value);
    }

    // Dedupe — multiple services can return the same building (e.g. health-center near a hospital)
    const seen = new Set<string>();
    const dedup = features.filter((p) => {
      const key = `${p.kind}|${p.lng.toFixed(4)}|${p.lat.toFixed(4)}|${p.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      features: dedup,
      meta: {
        source: "bmagis-arcgis",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: dedup.length > 0 ? "live" : "scenario",
      },
    };
  });
}
