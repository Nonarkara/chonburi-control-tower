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

export const CHULA: CampusConfig = {
  id: "chula-main",
  name: {
    en: "Chulalongkorn University",
    th: "จุฬาลงกรณ์มหาวิทยาลัย",
    zh: "朱拉隆功大学",
  },
  center: [100.5328, 13.7395],
  innerBounds: [
    [100.522, 13.733],
    [100.540, 13.749],
  ],
  outerBounds: [
    [100.515, 13.728],
    [100.548, 13.756],
  ],
  surroundingRoads: [
    "Rama I",
    "Rama IV",
    "Phaya Thai",
    "Henri Dunant",
    "Chula Soi 5/12/64",
  ],
  defaultView: {
    longitude: 100.5328,
    latitude: 13.7395,
    zoom: 15.2,
    pitch: 0,
    bearing: 0,
  },
};
