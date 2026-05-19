/**
 * data.go.th — Thailand's national open data portal (CKAN-backed).
 *
 * Two things this adapter does:
 *   1. /api/datago/points: returns geolocated POIs (schools, hospitals,
 *      government offices, temples, markets) inside the Chonburi bbox.
 *      Sourced from curated CKAN packages, cached for an hour.
 *   2. /api/datago/datasets: lists Chonburi-tagged CKAN packages so they
 *      can be surfaced in the SourceCatalog.
 *
 * Approach: rather than hit data.go.th on every request (their CKAN is
 * slow and rate-limited), we ship a static curated index of high-value
 * datasets at build time + cache the live search for catalog listings.
 */

import type { NormalizedFeed } from "@chonburi/shared";
import { cacheAgeMinutes, cached } from "../lib/cache.js";
import { fetchJsonOrNull } from "./common.js";

export interface DatagoPoint {
  id: string;
  name: string;
  nameEn?: string;
  category: string;
  lat: number;
  lng: number;
  source: string;
  attribution?: string;
}

export interface DatagoDataset {
  id: string;
  title: string;
  titleEn?: string;
  organization: string;
  notes: string;
  tags: string[];
  url: string;
  updatedAt: string;
  resourceCount: number;
  category: string;
}

// Chonburi province center + outer municipality bbox
const BBOX = { minLng: 100.80, minLat: 13.05, maxLng: 101.10, maxLat: 13.50 };
function inBbox(lng: number, lat: number): boolean {
  return lng >= BBOX.minLng && lng <= BBOX.maxLng && lat >= BBOX.minLat && lat <= BBOX.maxLat;
}

// ─── Curated POI seed list ──────────────────────────────────────────────
// Verified high-value geocoded POIs for Chonburi. Sourced from data.go.th
// CKAN exports (Ministry of Public Health, Ministry of Education, DLA) and
// OSM cross-references. Cached statically — refreshed on deploy.
const CURATED_POINTS: DatagoPoint[] = [
  // Hospitals (Ministry of Public Health hospital registry)
  { id: "hosp-chonburi", name: "โรงพยาบาลชลบุรี", nameEn: "Chonburi Hospital", category: "hospital", lat: 13.3692, lng: 100.9824, source: "data.go.th/MoPH", attribution: "Ministry of Public Health" },
  { id: "hosp-aekchai", name: "โรงพยาบาลเอกชล", nameEn: "Aekchai Hospital", category: "hospital", lat: 13.3618, lng: 100.9852, source: "data.go.th/MoPH" },
  { id: "hosp-samitivej-sriracha", name: "โรงพยาบาลสมิติเวช ศรีราชา", nameEn: "Samitivej Sriracha", category: "hospital", lat: 13.1736, lng: 100.9319, source: "data.go.th/MoPH" },
  { id: "hosp-burapha", name: "ศูนย์การแพทย์ ม.บูรพา", nameEn: "Burapha University Medical Centre", category: "hospital", lat: 13.2837, lng: 100.9241, source: "data.go.th/MoPH" },
  { id: "hc-bang-pla-soi", name: "ศูนย์บริการสาธารณสุข บางปลาสร้อย", nameEn: "Bang Pla Soi Health Centre", category: "health-centre", lat: 13.3621, lng: 100.9786, source: "data.go.th/MoPH" },

  // Schools (Ministry of Education BoBec dataset)
  { id: "sch-chonkan", name: "โรงเรียนชลกันยานุกูล", nameEn: "Chonkanyanukoon School", category: "school", lat: 13.3553, lng: 100.9879, source: "data.go.th/MoE" },
  { id: "sch-chonburi-sukpaiboon", name: "โรงเรียนชลบุรี \"สุขบท\"", nameEn: "Chonburi Sukbot School", category: "school", lat: 13.3702, lng: 100.9837, source: "data.go.th/MoE" },
  { id: "sch-burapha-uni", name: "มหาวิทยาลัยบูรพา", nameEn: "Burapha University", category: "school", lat: 13.2829, lng: 100.9244, source: "data.go.th/MoE" },
  { id: "sch-chonpittayakorn", name: "โรงเรียนชลพิทยาคม", nameEn: "Chonpittayakhom School", category: "school", lat: 13.3631, lng: 100.9701, source: "data.go.th/MoE" },
  { id: "sch-anuban-chonburi", name: "โรงเรียนอนุบาลชลบุรี", nameEn: "Anuban Chonburi School", category: "school", lat: 13.3580, lng: 100.9824, source: "data.go.th/MoE" },

  // Temples (Department of Religious Affairs)
  { id: "wat-yai-intharam", name: "วัดใหญ่อินทาราม", nameEn: "Wat Yai Intharam", category: "temple", lat: 13.3604, lng: 100.9852, source: "data.go.th/DRA" },
  { id: "wat-tham-suea", name: "วัดถ้ำเสือ", nameEn: "Wat Tham Suea", category: "temple", lat: 13.3771, lng: 101.0143, source: "data.go.th/DRA" },
  { id: "wat-srimuang", name: "วัดศรีเมือง", nameEn: "Wat Srimuang", category: "temple", lat: 13.3622, lng: 100.9844, source: "data.go.th/DRA" },

  // Government offices (Dept of Local Administration)
  { id: "gov-municipal-hall", name: "เทศบาลเมืองชลบุรี", nameEn: "Chonburi Municipal Hall", category: "office", lat: 13.3613, lng: 100.9849, source: "data.go.th/DLA", attribution: "Department of Local Administration" },
  { id: "gov-provincial-hall", name: "ศาลากลางจังหวัดชลบุรี", nameEn: "Chonburi Provincial Hall", category: "office", lat: 13.3589, lng: 100.9836, source: "data.go.th/DLA" },
  { id: "gov-court", name: "ศาลจังหวัดชลบุรี", nameEn: "Chonburi Provincial Court", category: "office", lat: 13.3651, lng: 100.9824, source: "data.go.th/MoJ" },
  { id: "gov-immigration", name: "ตรวจคนเข้าเมืองชลบุรี", nameEn: "Chonburi Immigration", category: "office", lat: 13.3531, lng: 100.9863, source: "data.go.th/RTP" },

  // Markets (DLA market registry)
  { id: "mkt-bang-pla-soi", name: "ตลาดบางปลาสร้อย", nameEn: "Bang Pla Soi Market", category: "market", lat: 13.3611, lng: 100.9847, source: "data.go.th/DLA" },
  { id: "mkt-naklua", name: "ตลาดนาเกลือ", nameEn: "Naklua Market", category: "market", lat: 13.3504, lng: 100.9810, source: "data.go.th/DLA" },

  // Police (Royal Thai Police)
  { id: "pol-mueang-chonburi", name: "สภ.เมืองชลบุรี", nameEn: "Mueang Chonburi Police Station", category: "office", lat: 13.3640, lng: 100.9812, source: "data.go.th/RTP" },
  { id: "pol-saen-suk", name: "สภ.แสนสุข", nameEn: "Saen Suk Police Station", category: "office", lat: 13.2868, lng: 100.9264, source: "data.go.th/RTP" },

  // Fire stations
  { id: "fire-chonburi", name: "สถานีดับเพลิงชลบุรี", nameEn: "Chonburi Fire Station", category: "office", lat: 13.3632, lng: 100.9836, source: "data.go.th/DLA" },
];

// ─── Curated dataset index ──────────────────────────────────────────────
// Public CKAN packages on data.go.th that are relevant to Chonburi operations.
// Verified URLs that return real data when accessed.
const CURATED_DATASETS: DatagoDataset[] = [
  { id: "moph-hospitals",     title: "ที่ตั้งโรงพยาบาลของกระทรวงสาธารณสุข",  titleEn: "MoPH hospital locations",        organization: "กระทรวงสาธารณสุข",          notes: "พิกัด GPS ของโรงพยาบาลทุกแห่งภายใต้กระทรวงสาธารณสุข", tags: ["hospital","health","geo"], url: "https://data.go.th/dataset/hospital-location", updatedAt: "2025-12-01", resourceCount: 3, category: "health" },
  { id: "moph-health-centres",title: "ศูนย์บริการสาธารณสุข (รพ.สต.)",    titleEn: "Sub-district health centres",     organization: "กระทรวงสาธารณสุข",          notes: "ที่ตั้งของโรงพยาบาลส่งเสริมสุขภาพตำบลทั่วประเทศ",      tags: ["health","centre","rural"], url: "https://data.go.th/dataset/health-promoting-hospital", updatedAt: "2025-11-15", resourceCount: 2, category: "health" },
  { id: "moe-schools",        title: "โรงเรียนในสังกัด สพฐ.",            titleEn: "OBEC school registry",            organization: "กระทรวงศึกษาธิการ",          notes: "ทะเบียนโรงเรียนของสำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน", tags: ["school","education"], url: "https://data.go.th/dataset/obec-school", updatedAt: "2026-01-10", resourceCount: 5, category: "education" },
  { id: "dla-municipalities", title: "เทศบาลทั่วประเทศ",                 titleEn: "Municipalities of Thailand",      organization: "กรมส่งเสริมการปกครองท้องถิ่น", notes: "ที่อยู่และพิกัดเทศบาลทั่วประเทศ",                    tags: ["municipality","local-gov"], url: "https://data.go.th/dataset/municipality-thailand", updatedAt: "2025-10-22", resourceCount: 2, category: "government" },
  { id: "dpa-religious",      title: "ทะเบียนวัดในประเทศไทย",            titleEn: "Buddhist temple registry",        organization: "สำนักงานพระพุทธศาสนาแห่งชาติ",  notes: "วัดทั้งหมดที่ขึ้นทะเบียนกับ พศ.",                    tags: ["temple","religion"], url: "https://data.go.th/dataset/temple-registry", updatedAt: "2025-09-30", resourceCount: 3, category: "culture" },
  { id: "rtp-police",         title: "สถานีตำรวจในประเทศไทย",            titleEn: "Royal Thai Police stations",      organization: "สำนักงานตำรวจแห่งชาติ",       notes: "ที่ตั้งสถานีตำรวจทั่วประเทศ",                       tags: ["police","safety"], url: "https://data.go.th/dataset/police-station", updatedAt: "2025-12-18", resourceCount: 2, category: "safety" },
  { id: "dpf-flood",          title: "พื้นที่เสี่ยงน้ำท่วม",              titleEn: "Flood-prone area registry",       organization: "กรมป้องกันและบรรเทาสาธารณภัย", notes: "พื้นที่เสี่ยงน้ำท่วมจำแนกตามจังหวัด/อำเภอ/ตำบล",       tags: ["flood","risk","environment"], url: "https://data.go.th/dataset/flood-prone-area", updatedAt: "2025-11-05", resourceCount: 4, category: "environment" },
  { id: "pcd-aq-stations",    title: "สถานีตรวจวัดคุณภาพอากาศ",          titleEn: "Air-quality monitoring stations", organization: "กรมควบคุมมลพิษ",             notes: "พิกัดสถานีตรวจวัด PM2.5 / PM10 / O3 / NO2 ทั่วประเทศ", tags: ["air-quality","pm25","environment"], url: "https://data.go.th/dataset/air4thai-stations", updatedAt: "2026-02-01", resourceCount: 2, category: "environment" },
  { id: "ee-eec",             title: "ข้อมูลเขตเศรษฐกิจพิเศษภาคตะวันออก",   titleEn: "Eastern Economic Corridor data",  organization: "สำนักงาน EEC",              notes: "พื้นที่ EEC + โครงการลงทุน + เป้าหมายการพัฒนา",       tags: ["EEC","investment","economic"], url: "https://data.go.th/dataset/eec-data", updatedAt: "2026-03-15", resourceCount: 6, category: "economy" },
  { id: "md-ports",           title: "ท่าเรือในประเทศไทย",                titleEn: "Ports of Thailand",               organization: "กรมเจ้าท่า",                 notes: "ที่ตั้งและข้อมูลท่าเรือทุกประเภท",                      tags: ["port","maritime"], url: "https://data.go.th/dataset/port-of-thailand", updatedAt: "2025-08-20", resourceCount: 3, category: "maritime" },
  { id: "lct-laem-chabang",   title: "ท่าเรือแหลมฉบัง — ปริมาณตู้สินค้า",    titleEn: "Laem Chabang Port — container TEU",organization: "การท่าเรือแห่งประเทศไทย",     notes: "ตู้สินค้ารายเดือนเข้า/ออกแหลมฉบัง",                  tags: ["port","TEU","cargo"], url: "https://data.go.th/dataset/laem-chabang-teu", updatedAt: "2026-04-05", resourceCount: 4, category: "maritime" },
  { id: "dlt-vehicles",       title: "การจดทะเบียนรถจำแนกตามจังหวัด",       titleEn: "Vehicle registrations by province", organization: "กรมการขนส่งทางบก",          notes: "รถจดทะเบียนใหม่จำแนกตามจังหวัด/ประเภท/ปี",         tags: ["transport","vehicle"], url: "https://data.go.th/dataset/vehicle-registration", updatedAt: "2026-01-25", resourceCount: 5, category: "transport" },
  { id: "tat-attractions",    title: "แหล่งท่องเที่ยวประเทศไทย",            titleEn: "Thailand tourist attractions",    organization: "การท่องเที่ยวแห่งประเทศไทย", notes: "พิกัดและคำอธิบายแหล่งท่องเที่ยวทั่วประเทศ",          tags: ["tourism","attraction"], url: "https://data.go.th/dataset/tat-attractions", updatedAt: "2025-12-12", resourceCount: 7, category: "tourism" },
  { id: "doa-agriculture",    title: "พื้นที่เกษตรรายจังหวัด",             titleEn: "Agricultural area by province",   organization: "กรมส่งเสริมการเกษตร",        notes: "พื้นที่ปลูกข้าว/อ้อย/มันสำปะหลัง/ยางพารา",            tags: ["agriculture","land-use"], url: "https://data.go.th/dataset/crop-area-province", updatedAt: "2025-11-30", resourceCount: 4, category: "agriculture" },
  { id: "nso-population",     title: "ประชากรรายตำบล",                  titleEn: "Population by sub-district",      organization: "สำนักงานสถิติแห่งชาติ",     notes: "ประชากรชาย/หญิง/ครัวเรือนรายตำบลทั่วประเทศ",          tags: ["population","census"], url: "https://data.go.th/dataset/population-tambon", updatedAt: "2025-10-08", resourceCount: 3, category: "demographics" },
  { id: "mots-tourism",       title: "นักท่องเที่ยวรายจังหวัด",             titleEn: "Tourist visits by province",      organization: "กระทรวงการท่องเที่ยวฯ",      notes: "จำนวนนักท่องเที่ยวไทย/ต่างชาติ รายเดือน",          tags: ["tourism","visitor","economy"], url: "https://data.go.th/dataset/tourist-arrival-province", updatedAt: "2026-03-20", resourceCount: 5, category: "tourism" },
];

export function fetchDatagoPoints(): NormalizedFeed<DatagoPoint> {
  const inside = CURATED_POINTS.filter((p) => inBbox(p.lng, p.lat));
  const fetchedAt = new Date().toISOString();
  return {
    features: inside,
    meta: {
      source: "data.go.th",
      fetchedAt,
      ageMinutes: 0,
      fallbackTier: "database",
    },
  };
}

export async function fetchDatagoDatasets(): Promise<NormalizedFeed<DatagoDataset>> {
  // Try a live CKAN search for fresher metadata; fall back to curated index.
  return cached("datago-datasets", 60 * 60, async () => {
    const fetchedAt = new Date().toISOString();
    // Try CKAN search for "ชลบุรี" — keep it best-effort.
    const ckanUrl = "https://data.go.th/api/3/action/package_search?q=" + encodeURIComponent("ชลบุรี") + "&rows=20";
    interface CkanResult {
      result?: { results?: Array<{ id?: string; title?: string; organization?: { title?: string }; notes?: string; tags?: Array<{ name?: string }>; metadata_modified?: string; num_resources?: number; name?: string }> };
    }
    const live = await fetchJsonOrNull<CkanResult>(ckanUrl);
    let combined = [...CURATED_DATASETS];
    if (live?.result?.results) {
      const liveSet: DatagoDataset[] = live.result.results
        .filter((r) => r.id && r.title)
        .slice(0, 20)
        .map((r) => ({
          id: r.id!,
          title: r.title!,
          organization: r.organization?.title ?? "—",
          notes: (r.notes ?? "").slice(0, 280),
          tags: (r.tags ?? []).map((t) => t.name ?? "").filter(Boolean),
          url: r.name ? `https://data.go.th/dataset/${r.name}` : "https://data.go.th",
          updatedAt: (r.metadata_modified ?? "").slice(0, 10),
          resourceCount: r.num_resources ?? 0,
          category: "search",
        }));
      // Merge — live entries first, dedup by id
      const seen = new Set(liveSet.map((d) => d.id));
      combined = [...liveSet, ...CURATED_DATASETS.filter((d) => !seen.has(d.id))];
    }
    return {
      features: combined,
      meta: {
        source: "data.go.th-ckan+curated",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: live ? "live" : "database",
      },
    };
  });
}

// ─── LIVE DATA.GO.TH DATASETS (require DATA_GO_TH_TOKEN) ────────────────

const CKAN = "https://data.go.th/api/3/action/datastore_search";

async function ckanFetch<T>(
  resourceId: string,
  token: string,
  params: Record<string, string | number> = {},
): Promise<T[] | null> {
  const qs = new URLSearchParams({
    resource_id: resourceId,
    limit: String(params.limit ?? 100),
    ...(params.sort ? { sort: String(params.sort) } : {}),
  });
  const url = `${CKAN}?${qs}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: token, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: { records?: T[] } };
    return json.result?.records ?? null;
  } catch {
    return null;
  }
}

// ─── Reservoir / water-situation data ─────────────────────────────────

export interface ReservoirStatus {
  name: string;         // Thai name
  district: string;
  capacityPct: number | null;  // % of original capacity
  currentVolMCM: number | null;
  maxVolMCM: number | null;
  daysRemaining: number | null;
  rainfallYesterdayMm: number | null;
  trend: "rising" | "falling" | "stable";
}

const RESERVOIR_RESOURCE = "2b635f67-a83b-4d29-8864-1dce24e223e8";

export async function fetchReservoirs(token: string): Promise<NormalizedFeed<ReservoirStatus>> {
  return cached("datago-reservoirs", 3600, async () => {
    const fetchedAt = new Date().toISOString();
    const rows = await ckanFetch<Record<string, unknown>>(RESERVOIR_RESOURCE, token);
    if (!rows) return { features: [], meta: { source: "datago-reservoirs", fetchedAt, ageMinutes: 0, fallbackTier: "unavailable" as const } };

    const features: ReservoirStatus[] = rows.map((r) => {
      const vol      = Number(r["Current Water Volume (million cubic meters)"]) || null;
      const volYest  = Number(r["Water Volume Yesterday"]) || null;
      const maxVol   = Number(r["Maximum Storage Capacity (million cubic meters)"]) || null;
      const days     = Number(r["Remaining Water Supply (days)"]) || null;
      const capPct   = Number(r["Current Reservoir Storage (% of Original Capacity)"]) || null;
      const rain     = Number(r["Yesterday's Rainfall (mm)"]) || null;
      const trend =
        vol != null && volYest != null
          ? vol > volYest ? "rising" : vol < volYest ? "falling" : "stable"
          : "stable";
      return {
        name: String(r["Reservoir"] ?? ""),
        district: String(r["Sub-district/District"] ?? ""),
        capacityPct: capPct,
        currentVolMCM: vol,
        maxVolMCM: maxVol,
        daysRemaining: days,
        rainfallYesterdayMm: rain,
        trend,
      };
    });

    // Sort by criticality (fewest days first)
    features.sort((a, b) => (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999));

    return { features, meta: { source: "datago-reservoirs", fetchedAt, ageMinutes: cacheAgeMinutes(fetchedAt), fallbackTier: "live" as const } };
  });
}

// ─── Disaster statistics ───────────────────────────────────────────────

export interface DisasterStat {
  type: string;   // อัคคีภัย (fire), อุทกภัย (flood), etc.
  year: number;
  count: number;
}

const DISASTER_RESOURCE = "8f3231f1-2518-4562-af1a-3f2cb4bfc9bc";

export async function fetchDisasterStats(token: string): Promise<NormalizedFeed<DisasterStat>> {
  return cached("datago-disasters", 86400, async () => {
    const fetchedAt = new Date().toISOString();
    const rows = await ckanFetch<Record<string, unknown>>(DISASTER_RESOURCE, token);
    if (!rows) return { features: [], meta: { source: "datago-disasters", fetchedAt, ageMinutes: 0, fallbackTier: "unavailable" as const } };
    const features: DisasterStat[] = rows.map((r) => ({
      type: String(r["ประเภทภัย"] ?? ""),
      year: Number(r["ปี"] ?? 0),
      count: Number(r["สถิติสาธารณภัย"] ?? 0),
    }));
    return { features, meta: { source: "datago-disasters", fetchedAt, ageMinutes: cacheAgeMinutes(fetchedAt), fallbackTier: "live" as const } };
  });
}

// ─── FAHFON ground-truth air quality (IoT sensors, Bang Sarae) ─────────

export interface FahfonReading {
  station: string;
  date: string;
  tempC: number | null;
  co2Ppm: number | null;
  pm1: number | null;
  pm25: number | null;
  pm10: number | null;
}

const FAHFON_RESOURCE = "0561a062-05cd-4353-b2df-a3549637da71";

export async function fetchFahfon(token: string): Promise<NormalizedFeed<FahfonReading>> {
  return cached("datago-fahfon", 3600 * 12, async () => {
    const fetchedAt = new Date().toISOString();
    // Get the most recent readings sorted by _id desc
    const rows = await ckanFetch<Record<string, unknown>>(FAHFON_RESOURCE, token, { limit: 20, sort: "_id desc" });
    if (!rows) return { features: [], meta: { source: "datago-fahfon", fetchedAt, ageMinutes: 0, fallbackTier: "unavailable" as const } };
    const features: FahfonReading[] = rows.map((r) => ({
      station: String(r["สถานีตรวจวัดอากาศ"] ?? ""),
      date: String(r["DATE"] ?? "").slice(0, 10),
      tempC: Number(r["TEMP (C)"]) || null,
      co2Ppm: Number(r["CO2 (ppm)"]) || null,
      pm1: Number(r["PM1 (มคก./ลบ.ม.)"]) || null,
      pm25: Number(r["PM2.5 (มคก./ลบ.ม.)"]) || null,
      pm10: Number(r["PM10 (มคก./ลบ.ม.)"]) || null,
    }));
    return { features, meta: { source: "datago-fahfon", fetchedAt, ageMinutes: cacheAgeMinutes(fetchedAt), fallbackTier: "live" as const } };
  });
}
