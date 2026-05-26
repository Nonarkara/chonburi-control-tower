import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";

export type Coordinates = [number, number];
export type LatLng = [number, number];

export type Locale = "en" | "th" | "zh";

export type FallbackTier =
  | "live"
  | "database"
  | "cache"
  | "scenario"
  | "reference"
  | "unavailable";

export interface SourceMeta {
  source: string;
  fetchedAt: string;
  ageMinutes: number;
  fallbackTier: FallbackTier;
}

export interface NormalizedFeed<T> {
  features: T[];
  meta: SourceMeta;
}

// ---- Incidents ----

export type IncidentCategory =
  | "traffic-accident"
  | "traffic-congestion"
  | "construction"
  | "flooding"
  | "waste"
  | "lighting"
  | "sidewalk"
  | "drainage"
  | "trees"
  | "other";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export type IncidentStatus =
  | "received"
  | "assigned"
  | "in-progress"
  | "resolved";

export interface IncidentFeature {
  id: string;
  ticketNumber?: string;
  lat: number;
  lng: number;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description?: string;
  reportedAt: string;
  resolvedAt?: string;
  imageUrl?: string;
  reporterPlatform: "traffy" | "city-reporter" | "itic" | "internal";
  zoneId?: string;
  raw?: Record<string, unknown>;
}

// ---- Traffic ----

export interface TrafficSample {
  lat: number;
  lng: number;
  intensity: number;
  roadClass: "arterial" | "collector" | "local" | "campus-internal";
}

export interface TrafficCorridor {
  id: string;
  name: string;
  segments: Coordinates[];
  roadClass: TrafficSample["roadClass"];
}

// ---- Environment ----

export interface AirQualityPoint {
  lat: number;
  lng: number;
  station: string;
  aqi: number | null;
  pm25: number | null;
  category: "good" | "moderate" | "unhealthy-sg" | "unhealthy" | "very-unhealthy" | "hazardous" | null;
  observedAt: string;
  source: string;
}

export interface WeatherSnapshot {
  tempC: number | null;
  feelsLikeC: number | null;
  humidity: number | null;
  windKmh: number | null;
  precipMm: number | null;
  condition: string;
  observedAt: string;
}

export interface PrecipNowcast {
  /** mm in the current 15-min interval (≈ rate at observation time). */
  nowMm: number;
  /** Cumulative mm forecast across the next 2 hours. */
  total2hMm: number;
  /** Max single-interval mm in the next 2 hours. */
  peakMm: number;
  /** ISO timestamp of the peak interval, or null if dry. */
  peakAt: string | null;
  /** ISO timestamp of the first interval with ≥ 0.5 mm, or null if none. */
  firstSignificantAt: string | null;
  /** Minutes from now to the first significant interval (multiple of 15), or null. */
  minutesToSignificant: number | null;
  /** Coarse bucket for UI colouring. */
  intensity: "dry" | "light" | "moderate" | "heavy";
  /** Per-15-min forecast points covering the next ~2 hours. */
  points: Array<{ at: string; mm: number; prob: number }>;
}

export interface AcademicPhase {
  /** ISO date when this phase starts. */
  start: string;
  /** ISO date when this phase ends. */
  end: string;
  /** Stable id — used by the UI for icon/colour mapping. */
  id:
    | "semester-1"
    | "semester-1-finals"
    | "semester-2"
    | "semester-2-finals"
    | "summer-term"
    | "break"
    | "freshy-week"
    | "graduation"
    | "holiday";
  /** Short human label, EN. */
  label: string;
  /** One-sentence description of operational impact ("expect higher campus traffic" etc.). */
  describe: string;
}

export interface AcademicSnapshot {
  current: AcademicPhase | null;
  next: AcademicPhase | null;
  /** Days from today (UTC) to `next.start`. Negative if `current` is the next event itself. */
  daysToNext: number | null;
  /** Convenience: campus operational tempo derived from current phase. */
  tempo: "low" | "normal" | "high" | "peak";
}

// ---- News / Vibes ----

export type IntelligenceKind =
  | "news"
  | "social"
  | "incident"
  | "weather"
  | "movement";

export interface IntelligenceItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;
  publishedAt: string;
  tags: string[];
  score: number;
  kind: IntelligenceKind;
  imageUrl?: string;
  /** Geocoded latitude when a known place is mentioned in the story */
  lat: number | null;
  /** Geocoded longitude when a known place is mentioned in the story */
  lng: number | null;
  /** Name of the matched place (e.g. "Talat Chonburi") */
  placeName: string | null;
}

// ---- Campus GeoJSON ----

export interface CampusZoneProperties {
  zoneId: string;
  name: { en: string; th: string; zh: string };
  zoneType:
    | "academic"
    | "residential"
    | "athletic"
    | "park"
    | "commercial"
    | "service"
    | "perimeter";
  color?: string;
  height?: number | null;
}

export type CampusZoneFeature = Feature<Polygon | MultiPolygon, CampusZoneProperties>;
export type CampusZoneCollection = FeatureCollection<Polygon | MultiPolygon, CampusZoneProperties>;

// ---- Executive / Strategic ----

export interface RankingEntry {
  system: "qs-world" | "qs-asia" | "the-world" | "the-asia";
  label: string;
  rank: number;
  total: number;
  year: number;
  previousRank: number;
  trend: "up" | "down" | "stable";
}

export interface EnrollmentSnapshot {
  total: number;
  undergraduate: number;
  graduate: number;
  international: number;
  internationalPct: number;
  faculties: number;
  studentFacultyRatio: string;
}

export interface ResearchSnapshot {
  publications2024: number;
  citations2024: number;
  hIndex: number;
  topFields: string[];
  researchFundingMThb: number | null;
  patentsFiled: number;
}

export interface FinancialSnapshot {
  annualBudgetBThb: number | null;
  researchGrantsMThb: number | null;
  endowmentBThb: number | null;
  note: string;
}

export interface StrategicInitiative {
  id: string;
  name: string;
  status: "on-track" | "at-risk" | "delayed" | "completed";
  progressPct: number;
  owner: string;
  deadline: string;
  describe: string;
}

export interface PeerSnapshot {
  name: string;
  country: string;
  qsWorldRank: number;
  theWorldRank: number;
  studentsTotal: number;
  internationalPct: number;
  researchOutput: string;
}

export interface StrategicAlert {
  id: string;
  level: "info" | "watch" | "warning" | "critical";
  category: "environment" | "safety" | "reputation" | "operations" | "finance";
  title: string;
  message: string;
  issuedAt: string;
  source: string;
  actionRequired?: string;
}

export interface ExecutiveSnapshot {
  rankings: RankingEntry[];
  enrollment: EnrollmentSnapshot;
  research: ResearchSnapshot;
  finance: FinancialSnapshot;
  initiatives: StrategicInitiative[];
  peers: PeerSnapshot[];
  alerts: StrategicAlert[];
  updatedAt: string;
}

// ── Global markets — FMP (live ticks) + FRED (macro series) ─────────
export interface MarketTick {
  symbol: string;
  name: string;
  group: "index" | "forex" | "commodity" | "macro";
  value: number | null;
  changePct: number | null;
  asOf: string;
}

export interface MarketSnapshot {
  ticks: MarketTick[];
  thb: { vs: "USD" | "EUR" | "JPY" | "CNY"; rate: number | null }[];
}

// ── Digital Twin ────────────────────────────────────────────────────

export type TwinKind =
  | "building"
  | "sensor"
  | "road"
  | "reservoir"
  | "vessel"
  | "zone"
  | "poi"
  | "bridge"
  | "ferry"
  | "port";

export type TwinRelationPredicate =
  | "contains"
  | "monitors"
  | "adjacent_to"
  | "connected_to"
  | "serves"
  | "located_in"
  | "part_of";

export interface TwinObject {
  id: string;
  kind: TwinKind;
  name: string;
  nameTh?: string;
  nameEn?: string;
  lat: number;
  lng: number;
  geom?: unknown;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TwinRelation {
  id: string;
  subjectId: string;
  predicate: TwinRelationPredicate;
  objectId: string;
  properties?: Record<string, unknown>;
  createdAt: string;
}

export interface TwinStatePoint {
  time: string;
  objectId: string;
  metric: string;
  value: number;
  source: string;
  properties?: Record<string, unknown>;
}

export type AdapterStatus = "healthy" | "degraded" | "down" | "unknown";

export interface AdapterHealth {
  name: string;
  status: AdapterStatus;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  consecutiveFailures: number;
  totalCalls: number;
  totalErrors: number;
  ageMinutes: number | null;
}

// ── GISTDA (Thailand Geo-Informatics & Space Technology) ────────────

export interface GistdaPoi {
  id: number;
  name: string;
  nameEn: string;
  category:
    | "government"
    | "school"
    | "temple"
    | "hospital"
    | "hotel"
    | "bank"
    | "restaurant"
    | "shopping"
    | "transport"
    | "sport"
    | "agency"
    | "other";
  subcat: number;
  road: string;
  roadEn: string;
  lat: number;
  lng: number;
  disabled: string;
}

export interface GistdaSolarBuilding {
  id: number;
  height: number;
  area: number;
  solarIrr: number; // kWh/m² monthly
  roofType: string;
  buildType: string;
  month: string;
  monthNum: number;
  lat: number;
  lng: number;
}

export interface GistdaLandUse {
  id: number;
  code: string;
  name: string;
  nameEn: string;
  area: number;
  lat: number;
  lng: number;
}

/**
 * Satellite-derived climate readings at Chonburi centroid.
 * Source: NASA POWER API (MERRA-2 reanalysis + satellite obs), ~3-day latency.
 * No API key required.
 */
export interface NasaEarthReadings {
  tempC: number | null;
  precipMmDay: number | null;
  solarMJm2: number | null;
  solarKWhm2: number | null;    // solarMJm2 / 3.6
  clearnessIndex: number | null; // ALLSKY_KT 0–1
  dataDate: string;              // YYYYMMDD
  source: "nasa-power-merra2";
}

/** Facebook page post — mirrors the API adapter's FacebookPost interface. */
export interface FacebookPost {
  id: string;
  message: string;
  permalink: string;
  createdAt: string;
  image?: string;
  reactions?: number;
  comments?: number;
  shares?: number;
}
