/**
 * GISTDA (Geo-Informatics & Space Technology Development Agency) adapter.
 *
 * Services hosted at gistdaportal.gistda.or.th/arcgis/rest/services.
 * All read endpoints work without auth. The GISTDA_API_KEY unlocks
 * THEOS-2 satellite ordering and higher-rate queries.
 *
 * Wired endpoints:
 *   /api/gistda/poi       — POI Digital Twin (schools, temples, gov, hotels …)
 *   /api/gistda/solar     — LOD2 building solar irradiance (Chonburi)
 *   /api/gistda/landuse   — Land use / land cover classification
 *   /api/gistda/buildings — Building footprints (LOD1)
 */

import type { NormalizedFeed } from "@chonburi/shared";
import { CHONBURI } from "@chonburi/shared";
import { cacheAgeMinutes, cached } from "../lib/cache.js";
import { fetchJsonOrNull } from "./common.js";

const PORTAL = "https://gistdaportal.gistda.or.th/arcgis/rest/services";

// Category code → readable label (GISTDA POI category schema)
const POI_CATEGORY: Record<number, string> = {
  11: "government",
  13: "school",
  14: "temple",
  15: "hospital",
  17: "hotel",
  18: "bank",
  20: "restaurant",
  40: "shopping",
  60: "transport",
  70: "sport",
  90: "agency",
};

export interface GistdaPoi {
  id: number;
  name: string;
  nameEn: string;
  category: string;
  subcat: number;
  road: string;
  roadEn: string;
  lat: number;
  lng: number;
  disabled: string;
}

export interface GistdaSolarBuilding {
  id: number;
  height: number;
  area: number;
  solarIrr: number;     // kWh/m² monthly
  roofType: string;
  buildType: string;
  month: string;
  monthNum: number;
  lat: number;
  lng: number;
}

/** Build an ArcGIS FeatureServer query URL */
function arcgisQuery(
  service: string,
  layer: number,
  where: string,
  fields: string,
  bbox?: [number, number, number, number],
  count?: number,
): string {
  const params = new URLSearchParams({
    f: "json",
    where,
    outFields: fields,
    ...(bbox ? {
      geometry: bbox.join(","),
      geometryType: "esriGeometryEnvelope",
      spatialRel: "esriSpatialRelIntersects",
    } : {}),
    resultRecordCount: String(count ?? 500),
  });
  return `${PORTAL}/${service}/MapServer/${layer}/query?${params}`;
}

export async function fetchGistdaPoi(): Promise<NormalizedFeed<GistdaPoi>> {
  return cached("gistda-poi", 3600 * 6, async () => {
    const fetchedAt = new Date().toISOString();
    const [lng0, lat0] = CHONBURI.center;
    // Tight bounds: Chonburi Town Municipality (~4 km²) + small buffer
    const bbox: [number, number, number, number] = [
      lng0 - 0.025, lat0 - 0.025, lng0 + 0.025, lat0 + 0.025,
    ];
    const url = arcgisQuery(
      "POI_Map_Service", 0,
      "1=1",
      "OBJECTID,Category,SubCat,Official,OnTrans,RoadName,RnTrans,Disabled",
      bbox,
      1000,
    );

    interface ArcGisFeatureSet {
      features?: Array<{ attributes?: Record<string, unknown>; geometry?: { x?: number; y?: number } }>;
    }
    const data = await fetchJsonOrNull<ArcGisFeatureSet>(url);
    if (!data?.features) {
      return { features: [], meta: { source: "gistda-poi", fetchedAt, ageMinutes: 0, fallbackTier: "unavailable" as const } };
    }

    const features: GistdaPoi[] = data.features
      .filter(f => f.geometry?.x && f.geometry?.y)
      .map(f => {
        const a = f.attributes ?? {};
        const cat = Number(a["Category"] ?? 0);
        return {
          id: Number(a["OBJECTID"] ?? 0),
          name: String(a["Official"] ?? "").trim(),
          nameEn: String(a["OnTrans"] ?? "").trim(),
          category: POI_CATEGORY[cat] ?? "other",
          subcat: Number(a["SubCat"] ?? 0),
          road: String(a["RoadName"] ?? "").trim(),
          roadEn: String(a["RnTrans"] ?? "").trim(),
          lat: f.geometry!.y!,
          lng: f.geometry!.x!,
          disabled: String(a["Disabled"] ?? ""),
        };
      })
      .filter(p => p.name.length > 0);

    return {
      features,
      meta: {
        source: "gistda-poi-digital-twin",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: features.length > 0 ? "live" : "unavailable",
      },
    };
  });
}

export async function fetchGistdaSolar(month?: number): Promise<NormalizedFeed<GistdaSolarBuilding>> {
  // Default to current month
  const m = month ?? new Date().getMonth() + 1;
  const monthStr = String(m).padStart(2, "0");
  const cacheKey = `gistda-solar-${monthStr}`;

  return cached(cacheKey, 3600 * 24, async () => {
    const fetchedAt = new Date().toISOString();
    const [lng0, lat0] = CHONBURI.center;
    // Tight bounds: Chonburi Town Municipality (~4 km²) + small buffer
    const bbox: [number, number, number, number] = [
      lng0 - 0.025, lat0 - 0.025, lng0 + 0.025, lat0 + 0.025,
    ];
    // Filter by month number (smonth_num field)
    const where = `sun_irr IS NOT NULL AND smonth_num = '${m}'`;
    const url = arcgisQuery(
      "GISDTA_BLDGLOD2_Solar_TimeSlider_Chonburi_Month", 0,
      where,
      "OBJECTID,BL_HEIGHT,BLDG_Area,sun_irr,smonth_th,smonth_num,rooftype_th,buildtype_th,lat,long",
      bbox,
      2000,
    );

    interface ArcGisFeatureSet {
      features?: Array<{ attributes?: Record<string, unknown>; geometry?: { x?: number; y?: number } }>;
    }
    const data = await fetchJsonOrNull<ArcGisFeatureSet>(url);
    if (!data?.features?.length) {
      return { features: [], meta: { source: "gistda-solar", fetchedAt, ageMinutes: 0, fallbackTier: "unavailable" as const } };
    }

    const features: GistdaSolarBuilding[] = data.features.map(f => {
      const a = f.attributes ?? {};
      const lat = Number(a["lat"] ?? f.geometry?.y ?? 0);
      const lng = Number(a["long"] ?? f.geometry?.x ?? 0);
      return {
        id: Number(a["OBJECTID"] ?? 0),
        height: Number(a["BL_HEIGHT"] ?? 0),
        area: Number(a["BLDG_Area"] ?? 0),
        solarIrr: Number(a["sun_irr"] ?? 0),
        roofType: String(a["rooftype_th"] ?? ""),
        buildType: String(a["buildtype_th"] ?? ""),
        month: String(a["smonth_th"] ?? ""),
        monthNum: Number(a["smonth_num"] ?? m),
        lat,
        lng,
      };
    }).filter(b => b.lat !== 0 && b.lng !== 0 && b.solarIrr > 0);

    return {
      features,
      meta: {
        source: "gistda-solar-lod2",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: features.length > 0 ? "live" : "unavailable",
      },
    };
  });
}

// ── GISTDA Land Use / Land Cover ────────────────────────────────────────

export interface GistdaLandUse {
  id: number;
  code: string;
  name: string;
  nameEn: string;
  area: number;
  lat: number;
  lng: number;
}

export async function fetchGistdaLandUse(): Promise<NormalizedFeed<GistdaLandUse>> {
  return cached("gistda-landuse", 3600 * 12, async () => {
    const fetchedAt = new Date().toISOString();
    const [lng0, lat0] = CHONBURI.center;
    const bbox: [number, number, number, number] = [
      lng0 - 0.03, lat0 - 0.03, lng0 + 0.03, lat0 + 0.03,
    ];
    const url = arcgisQuery(
      "LandUse_Map_Service", 0,
      "1=1",
      "OBJECTID,LU_CODE,LU_NAME,LU_NAME_EN,Shape_Area",
      bbox,
      1000,
    );

    interface ArcGisFeatureSet {
      features?: Array<{ attributes?: Record<string, unknown>; geometry?: { x?: number; y?: number } }>;
    }
    const data = await fetchJsonOrNull<ArcGisFeatureSet>(url);
    if (!data?.features?.length) {
      return { features: [], meta: { source: "gistda-landuse", fetchedAt, ageMinutes: 0, fallbackTier: "unavailable" as const } };
    }

    const features: GistdaLandUse[] = data.features
      .filter(f => f.geometry?.x && f.geometry?.y)
      .map(f => {
        const a = f.attributes ?? {};
        return {
          id: Number(a["OBJECTID"] ?? 0),
          code: String(a["LU_CODE"] ?? ""),
          name: String(a["LU_NAME"] ?? ""),
          nameEn: String(a["LU_NAME_EN"] ?? ""),
          area: Number(a["Shape_Area"] ?? 0),
          lat: f.geometry!.y!,
          lng: f.geometry!.x!,
        };
      })
      .filter(p => p.name.length > 0);

    return {
      features,
      meta: {
        source: "gistda-landuse",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: features.length > 0 ? "live" : "unavailable",
      },
    };
  });
}
