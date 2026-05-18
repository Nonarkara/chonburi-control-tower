import type { NormalizedFeed } from "@chonburi/shared";
import { cacheAgeMinutes, cached } from "../lib/cache.js";
import { inBbox } from "../lib/bbox.js";
import { fetchJsonOrNull } from "./common.js";

const ENDPOINT = "https://camera.longdo.com/feed/?command=json";
const TTL_SECONDS = 600; // 10 min — camera list rarely changes

export interface CctvCamera {
  id: string;
  name: string;
  lat: number;
  lng: number;
  vendor: "longdo" | "bma" | "exat";
  imageUrl?: string;
  hlsUrl?: string;
  organization?: string;
  updatedAt?: string;
}

interface LongdoCamera {
  camid?: string;
  title?: string;
  latitude?: string | number;
  longitude?: string | number;
  imgurl?: string;
  hls_url?: string;
  organization?: string;
  lastupdate?: string;
}

function num(v: string | number | undefined): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchCctv(): Promise<NormalizedFeed<CctvCamera>> {
  return cached("cctv-longdo", TTL_SECONDS, async () => {
    const fetchedAt = new Date().toISOString();
    const payload = await fetchJsonOrNull<{ cameras?: LongdoCamera[] } | LongdoCamera[]>(ENDPOINT);
    const cameras = Array.isArray(payload) ? payload : payload?.cameras ?? [];

    const features: CctvCamera[] = [];
    for (const cam of cameras) {
      const lat = num(cam.latitude);
      const lng = num(cam.longitude);
      if (lat === null || lng === null) continue;
      if (!inBbox(lng, lat)) continue;
      features.push({
        id: `longdo-${cam.camid ?? `${lng}-${lat}`}`,
        name: cam.title?.trim() || "Camera",
        lat,
        lng,
        vendor: "longdo",
        imageUrl: cam.imgurl,
        hlsUrl: cam.hls_url,
        organization: cam.organization,
        updatedAt: cam.lastupdate,
      });
    }

    return {
      features,
      meta: {
        source: "longdo-cameras",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: features.length > 0 ? "live" : "scenario",
      },
    };
  });
}
