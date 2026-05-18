import { CHULA } from "@chula/shared";

export const OUTER_BBOX = {
  minLng: CHULA.outerBounds[0][0],
  minLat: CHULA.outerBounds[0][1],
  maxLng: CHULA.outerBounds[1][0],
  maxLat: CHULA.outerBounds[1][1],
};

export function inBbox(lng: number, lat: number): boolean {
  return (
    lng >= OUTER_BBOX.minLng &&
    lng <= OUTER_BBOX.maxLng &&
    lat >= OUTER_BBOX.minLat &&
    lat <= OUTER_BBOX.maxLat
  );
}
