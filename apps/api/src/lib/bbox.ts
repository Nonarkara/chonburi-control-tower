import { CHONBURI } from "@chonburi/shared";

// Visual map clamp — small (municipality only)
export const OUTER_BBOX = {
  minLng: CHONBURI.outerBounds[0][0],
  minLat: CHONBURI.outerBounds[0][1],
  maxLng: CHONBURI.outerBounds[1][0],
  maxLat: CHONBURI.outerBounds[1][1],
};

// Eastern Seaboard envelope for nationwide feeds (Traffy / iTIC / CCTV).
// Includes Pattaya / Sattahip in the south, Laem Chabang / Si Racha mid,
// Chonburi city + Bang Saen in the north. Caps lat at 13.55 so southern
// Bangkok (Pathum Wan ~13.74) doesn't leak in.
export const FEED_BBOX = {
  minLng: 100.70,
  minLat: 12.50,
  maxLng: 101.50,
  maxLat: 13.55,
};

export function inBbox(lng: number, lat: number): boolean {
  return (
    lng >= FEED_BBOX.minLng &&
    lng <= FEED_BBOX.maxLng &&
    lat >= FEED_BBOX.minLat &&
    lat <= FEED_BBOX.maxLat
  );
}

// Strict municipality-only check, for visual layers
export function inMunicipality(lng: number, lat: number): boolean {
  return (
    lng >= OUTER_BBOX.minLng &&
    lng <= OUTER_BBOX.maxLng &&
    lat >= OUTER_BBOX.minLat &&
    lat <= OUTER_BBOX.maxLat
  );
}
