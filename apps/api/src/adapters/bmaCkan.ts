import type { NormalizedFeed } from "@chula/shared";
import { cacheAgeMinutes, cached } from "../lib/cache.js";
import { fetchJsonOrNull } from "./common.js";

// BMA Open Data Portal — CKAN 3.x at https://data.bangkok.go.th
// The portal hosts hundreds of datasets; we surface a curated keyword search
// so engineers can see what's discoverable and click through. Where a dataset
// is hosted as a public GeoJSON resource we expose its URL for one-click
// ingestion into the BMA ArcGIS adapter or a static layer.

const BASE = "https://data.bangkok.go.th";

// Curated keyword set covering what's useful near a Pathum Wan campus.
const KEYWORDS = [
  "โรงพยาบาล",        // hospital
  "โรงเรียน",         // school
  "สถานีดับเพลิง",   // fire station
  "สถานีตำรวจ",     // police station
  "สวนสาธารณะ",     // public park
  "ตลาด",            // market
  "กล้องวงจรปิด",   // CCTV
  "ขยะ",             // waste
  "ระบายน้ำ",        // drainage
  "จราจร",           // traffic
  "อุบัติเหตุ",      // accident
  "ฝุ่น PM 2.5",     // PM2.5
];

const TTL_SECONDS = 60 * 60 * 6; // 6h — catalog changes slowly

export interface CkanResource {
  id: string;
  name: string;
  format: string;
  url: string;
  lastModified?: string;
}

export interface CkanDataset {
  id: string;
  name: string;
  title: string;
  notes?: string;
  organization?: string;
  numResources: number;
  resources: CkanResource[];
  tags: string[];
  lastModified?: string;
  searchedFor: string;
}

interface CkanResourceRaw {
  id: string;
  name?: string;
  format?: string;
  url?: string;
  last_modified?: string;
}

interface CkanPackage {
  id: string;
  name: string;
  title?: string;
  notes?: string;
  organization?: { title?: string };
  num_resources?: number;
  resources?: CkanResourceRaw[];
  tags?: Array<{ display_name?: string; name?: string }>;
  metadata_modified?: string;
}

interface CkanResp {
  success?: boolean;
  result?: { results?: CkanPackage[]; count?: number };
}

async function searchOne(kw: string): Promise<CkanDataset[]> {
  const url = `${BASE}/api/3/action/package_search?q=${encodeURIComponent(kw)}&rows=6&sort=metadata_modified+desc`;
  const payload = await fetchJsonOrNull<CkanResp>(url);
  const pkgs = payload?.result?.results ?? [];
  return pkgs.map<CkanDataset>((p) => ({
    id: p.id,
    name: p.name,
    title: (p.title ?? p.name).trim(),
    notes: p.notes?.trim().slice(0, 400),
    organization: p.organization?.title,
    numResources: typeof p.num_resources === "number" ? p.num_resources : (p.resources?.length ?? 0),
    resources: (p.resources ?? []).slice(0, 8).map((r) => ({
      id: r.id,
      name: (r.name ?? "resource").trim(),
      format: (r.format ?? "").toUpperCase(),
      url: r.url ?? "",
      lastModified: r.last_modified,
    })),
    tags: (p.tags ?? []).map((t) => t.display_name ?? t.name ?? "").filter(Boolean).slice(0, 6),
    lastModified: p.metadata_modified,
    searchedFor: kw,
  }));
}

export async function fetchBmaCkanDatasets(): Promise<NormalizedFeed<CkanDataset>> {
  return cached("bma-ckan", TTL_SECONDS, async () => {
    const fetchedAt = new Date().toISOString();
    const settled = await Promise.allSettled(KEYWORDS.map(searchOne));

    const collected: CkanDataset[] = [];
    for (const r of settled) {
      if (r.status === "fulfilled") collected.push(...r.value);
    }

    // Dedupe by package id; keep the first hit (relevance order from CKAN).
    const seen = new Set<string>();
    const dedup = collected.filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });

    // Sort: most recently modified first.
    dedup.sort((a, b) => (b.lastModified ?? "").localeCompare(a.lastModified ?? ""));

    return {
      features: dedup.slice(0, 60),
      meta: {
        source: "data.bangkok.go.th",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: dedup.length > 0 ? "live" : "scenario",
      },
    };
  });
}
