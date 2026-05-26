import type { IncidentCategory, IncidentFeature, IncidentSeverity, IncidentStatus, NormalizedFeed } from "@chonburi/shared";
import { cacheAgeMinutes, cachedWithStale as cached } from "../lib/cache.js";
import { inBbox } from "../lib/bbox.js";
import { fetchJsonOrNull } from "./common.js";

// Traffy Fondue is the de facto public citizen-report feed for Bangkok.
// City Reporter v2 (bots/city-reporter-v2) writes to the same shape.

// Traffy search filtered to Chonburi. The `keyword=ชลบุรี` parameter narrows
// the API result set server-side so we download ~200 items instead of 2000.
// Client-side bbox + org filters still run as a secondary pass in case the
// keyword match misses location-only tickets (no org tag).
const ENDPOINT =
  "https://publicapi.traffy.in.th/share/teamchadchart/search?limit=500&keyword=ชลบุรี";

const TTL_SECONDS = 300; // 5 min

interface TraffyRaw {
  ticket_id?: string;
  type?: string | string[];
  state?: string;
  latitude?: number;
  longitude?: number;
  coords?: unknown;
  address?: string;
  district?: string;
  org?: string;
  photo_url?: string;
  timestamp?: string;
  description?: string;
}

function parseCoords(r: TraffyRaw): [number, number] | null {
  if (r.latitude != null && r.longitude != null) {
    const lat = Number(r.latitude);
    const lng = Number(r.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) return [lng, lat];
  }
  if (Array.isArray(r.coords) && r.coords.length >= 2) {
    // Traffy returns [lng, lat] as stringified numbers
    const lng = Number(r.coords[0]);
    const lat = Number(r.coords[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) return [lng, lat];
  }
  return null;
}

function mapStatus(state?: string): IncidentStatus {
  if (!state) return "received";
  const lower = state.toLowerCase();
  if (lower.includes("เสร็จ") || lower === "resolved" || lower === "finish") return "resolved";
  if (lower.includes("ดำเนิน") || lower === "in-progress" || lower === "active") return "in-progress";
  if (lower.includes("assign")) return "assigned";
  return "received";
}

function mapCategory(type?: string | string[]): { category: IncidentCategory; title: string } {
  const t = Array.isArray(type) ? type.join(" ") : type ?? "";
  const lower = typeof t === "string" ? t.toLowerCase() : "";
  if (lower.includes("ถนน") || lower.includes("road")) return { category: "construction", title: "Road damage" };
  if (lower.includes("น้ำท่วม") || lower.includes("flood")) return { category: "flooding", title: "Flooding" };
  if (lower.includes("ขยะ") || lower.includes("waste") || lower.includes("trash")) return { category: "waste", title: "Waste" };
  if (lower.includes("ไฟ") || lower.includes("light") || lower.includes("lamp")) return { category: "lighting", title: "Lighting" };
  if (lower.includes("ทางเท้า") || lower.includes("sidewalk") || lower.includes("foot")) return { category: "sidewalk", title: "Sidewalk" };
  if (lower.includes("ระบาย") || lower.includes("drain")) return { category: "drainage", title: "Drainage" };
  if (lower.includes("ต้นไม้") || lower.includes("tree")) return { category: "trees", title: "Trees" };
  if (lower.includes("จราจร") || lower.includes("traffic")) return { category: "traffic-congestion", title: "Traffic" };
  return { category: "other", title: t || "Report" };
}

function inferSeverity(category: IncidentCategory, description?: string): IncidentSeverity {
  const text = typeof description === "string" ? description.toLowerCase() : "";
  if (text.includes("urgent") || text.includes("ด่วน") || category === "flooding") return "high";
  if (category === "traffic-congestion" || category === "drainage") return "medium";
  return "low";
}

export async function fetchCityReports(): Promise<NormalizedFeed<IncidentFeature>> {
  return cached("city-reports", TTL_SECONDS, async () => {
    const fetchedAt = new Date().toISOString();
    const payload = await fetchJsonOrNull<TraffyRaw[] | { results?: TraffyRaw[] }>(ENDPOINT);
    const raw = Array.isArray(payload) ? payload : payload?.results ?? [];

    const features: IncidentFeature[] = [];

    for (const r of raw) {
      const coords = parseCoords(r);
      if (!coords) continue;
      const [lng, lat] = coords;
      // Accept if inside Eastern-Seaboard bbox OR if org/address mentions Chonburi
      const inArea = inBbox(lng, lat);
      const orgMatch = (r.org ?? r.address ?? "").includes("ชลบุรี") ||
                       (r.org ?? r.address ?? "").toLowerCase().includes("chonburi");
      if (!inArea && !orgMatch) continue;

      const { category, title } = mapCategory(r.type);
      const status = mapStatus(r.state);
      const severity = inferSeverity(category, r.description);

      features.push({
        id: `traffy-${r.ticket_id ?? `${lng}-${lat}-${features.length}`}`,
        ticketNumber: r.ticket_id,
        lat,
        lng,
        category,
        severity,
        status,
        title,
        description: r.description,
        reportedAt: r.timestamp ?? fetchedAt,
        imageUrl: r.photo_url,
        reporterPlatform: "traffy",
      });
    }

    return {
      features,
      meta: {
        source: "traffy-fondue",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: features.length > 0 ? "live" : "scenario",
      },
    };
  });
}
