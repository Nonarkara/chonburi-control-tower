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
  center: [100.9847, 13.3611],
  innerBounds: [
    [100.968, 13.348],
    [101.000, 13.375],
  ],
  outerBounds: [
    [100.940, 13.320],
    [101.030, 13.410],
  ],
  surroundingRoads: [
    "Sukhumvit Highway",
    "Coastal Road",
    "Klang Mueang Road",
    "Pha Nat Road",
    "Si Racha Road",
  ],
  defaultView: {
    longitude: 100.9847,
    latitude: 13.3611,
    zoom: 13.5,
    pitch: 0,
    bearing: 0,
  },
};

// Legacy alias — keeps any stray CHULA references building during migration.
export const CHULA = CHONBURI;
