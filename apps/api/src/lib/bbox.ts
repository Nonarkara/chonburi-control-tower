import { CHONBURI } from "@chonburi/shared";

export const OUTER_BBOX = {
  minLng: CHONBURI.outerBounds[0][0],
  minLat: CHONBURI.outerBounds[0][1],
  maxLng: CHONBURI.outerBounds[1][0],
  maxLat: CHONBURI.outerBounds[1][1],
};

export function inBbox(lng: number, lat: number): boolean {
  return (
    lng >= OUTER_BBOX.minLng &&
    lng <= OUTER_BBOX.maxLng &&
    lat >= OUTER_BBOX.minLat &&
    lat <= OUTER_BBOX.maxLat
  );
}
