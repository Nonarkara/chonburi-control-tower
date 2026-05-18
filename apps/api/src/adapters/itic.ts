import type { IncidentFeature, IncidentSeverity, NormalizedFeed } from "@chonburi/shared";
import { cacheAgeMinutes, cached } from "../lib/cache.js";
import { inBbox } from "../lib/bbox.js";
import { fetchJsonOrNull } from "./common.js";

const EVENT_URL = "https://event.longdo.com/feed/json";
const TTL_SECONDS = 180;

interface LongdoEvent {
  eid?: string | number;
  title?: string;
  title_en?: string;
  description?: string;
  description_en?: string;
  latitude?: string | number;
  longitude?: string | number;
  type?: string | number;
  start?: string;
  stop?: string;
  severity?: string | number;
}

function num(v: string | number | undefined): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function parseThaiTs(v?: string): string | undefined {
  if (!v) return undefined;
  const parsed = new Date(`${v.trim().replace(/\s+/g, "T")}+07:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function classify(typeCode: number, severity: number): { category: IncidentFeature["category"]; severity: IncidentSeverity } {
  // Longdo type codes (approximate, from existing iticAdapter):
  // 1=accident, 2=closure, 3=construction, 4=breakdown, else=traffic
  let category: IncidentFeature["category"] = "traffic-congestion";
  if (typeCode === 1) category = "traffic-accident";
  else if (typeCode === 2) category = "construction"; // closure mapped to construction
  else if (typeCode === 3) category = "construction";

  let sev: IncidentSeverity = "low";
  if (severity >= 3) sev = "high";
  else if (severity >= 2) sev = "medium";
  if (category === "traffic-accident" && sev === "low") sev = "medium";
  return { category, severity: sev };
}

export async function fetchItic(): Promise<NormalizedFeed<IncidentFeature>> {
  return cached("itic", TTL_SECONDS, async () => {
    const fetchedAt = new Date().toISOString();
    const payload = await fetchJsonOrNull<{ events?: LongdoEvent[] } | LongdoEvent[]>(EVENT_URL);
    const events = Array.isArray(payload) ? payload : payload?.events ?? [];

    const features: IncidentFeature[] = [];

    for (const e of events) {
      const lat = num(e.latitude);
      const lng = num(e.longitude);
      if (lat === null || lng === null) continue;
      if (!inBbox(lng, lat)) continue;

      const typeCode = Number(e.type ?? 0);
      const severityCode = Number(e.severity ?? 0);
      const { category, severity } = classify(typeCode, severityCode);

      features.push({
        id: `itic-${e.eid ?? `${lng}-${lat}-${features.length}`}`,
        lat,
        lng,
        category,
        severity,
        status: "in-progress",
        title: (e.title_en ?? e.title ?? "Traffic event").trim(),
        description: (e.description_en ?? e.description ?? "").trim() || undefined,
        reportedAt: parseThaiTs(e.start) ?? fetchedAt,
        reporterPlatform: "itic",
      });
    }

    return {
      features,
      meta: {
        source: "itic-longdo",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: features.length > 0 ? "live" : "scenario",
      },
    };
  });
}
