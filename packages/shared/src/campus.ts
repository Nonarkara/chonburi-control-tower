import type { Coordinates } from "./types";

export interface CampusConfig {
  id: string;
  name: { en: string; th: string; zh: string };
  center: Coordinates;
  innerBounds: [Coordinates, Coordinates];
  outerBounds: [Coordinates, Coordinates];
  surroundingRoads: string[];
  defaultView: {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch: number;
    bearing: number;
  };
}

export const CHONBURI: CampusConfig = {
  id: "chonburi-town",
  name: {
    en: "Chonburi Town Municipality",
    th: "เทศบาลเมืองชลบุรี",
    zh: "春武里市镇市政府",
  },
  // Chonburi Town Municipality (เทศบาลเมืองชลบุรี) — ~4.2 km²
  // Tight focus on the municipal centre: city hall, main market, old town,
  // railway station, and the commercial core along Klang Mueang / Sukhumvit.
  center: [100.9847, 13.3611],
  innerBounds: [
    [100.975, 13.352], // SW corner — ~2 km from centre
    [100.995, 13.370], // NE corner — ~2 km from centre
  ],
  outerBounds: [
    [100.965, 13.342], // allow slight overscroll but not to Bangkok
    [101.005, 13.380],
  ],
  surroundingRoads: [
    "Sukhumvit Highway",
    "Coastal Road",
    "Klang Mueang Road",
    "Pha Nat Road",
    "Si Racha Road",
  ],
  // Start zoomed in to street level so the mayor sees *their* streets first.
  // Zoom 15.2 ≈ 700 m across the viewport — enough for 2-3 city blocks.
  defaultView: {
    longitude: 100.9847,
    latitude: 13.3611,
    zoom: 15.2,
    pitch: 50,
    bearing: -18,
  },
};

// Legacy alias — keeps any stray CHULA references building during migration.
export const CHULA = CHONBURI;
