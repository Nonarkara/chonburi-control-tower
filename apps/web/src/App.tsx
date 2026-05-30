import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import type { Layer, ControllerProps } from "@deck.gl/core";
import { Map as MapLibreMap, Source, Layer as MapLayer } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import type { FeatureCollection, Geometry, LineString, Point, Polygon, MultiPolygon } from "geojson";
import { CHONBURI } from "@chonburi/shared";
import type {
  AcademicSnapshot,
  AirQualityPoint,
  CampusZoneProperties,
  ExecutiveSnapshot,
  IncidentFeature,
  IntelligenceItem,
  MarketSnapshot,
  PrecipNowcast,
  WeatherSnapshot,
  GistdaPoi,
  GistdaSolarBuilding,
  GistdaLandUse,
} from "@chonburi/shared";

import { useFeed } from "./hooks/useFeed";
import { useBmaStatic } from "./hooks/useBmaStatic";
import { buildTrafficSamples, type RoadProps } from "./sim/trafficSim";
import {
  bmaAqStationsLayer,
  bmaParksLayer,
  bmaPoiLayer,
  buildingRoofsLayer,
  buildingsLayer,
  campusBoundaryLayer,
  cctvLayer,
  cuLandsLayer,
  cuMapOverlay,
  devicePresenceLayer,
  districtBoundariesLayer,
  districtLabelsLayer,
  drainageLineLayer,
  drainagePathLayer,
  electricityPathLayer,
  floodProneAreasLayer,
  waterPathLayer,
  drainageNodeLayer,
  electricityLineLayer,
  electricityNodeLayer,
  esriSatelliteLayer,
  gibsLayer,
  himawariInfraredLayer,
  openTopoTerrainLayer,
  incidentLayer,
  shuttleRouteLineLayer,
  shuttleRoutesLayer,
  shuttleStopsLayer,
  shuttleVehiclesLayer,
  surroundingBuildingsLayer,
  trafficHeatmapLayer,
  transitStationsLayer,
  transitLinesLayer,
  campusGatesLayer,
  roadNetworkLayer,
  neighborhoodBuildingsLayer,
  waterLineLayer,
  waterNodeLayer,
  wifiHeatmapLayer,
  wifiPointsLayer,
  maritimeOverlayLayer,
  portInfrastructureLayer,
  ferryTerminalsLayer,
  navigationAidsLayer,
  aisVesselsLayer,
  datagoPointsLayer,
  distanceGridLayer,
  distanceGridLabelsLayer,
  civicPointsLayer,
  waterwaysLayer,
  fisheriesLayer,
  floodRiskLayer,
  templeSpiresLayer,
  oldTownDistrictLayer,
  type HeritageFeatureProps,
  CIVIC_PALETTE,
  type CivicKind,
  type AisVessel,
  type DatagoPoint,
  type AqStation,
  type BuildingProperties,
  type CctvCamera,
  type CuLandProperties,
  type DistrictProperties,
  type FloodAreaProperties,
  type ShuttleVehicle,
  type RouteProps,
  type StopProps,
  type StationProps,
  type TransitLineProps,
  type GateProps,
  type ClassifiedRoadProps,
  type NeighborhoodBuildingProps,
  type SurroundingBuildingProperties,
  gistdaPoiLayer,
  gistdaSolarLayer,
  gistdaLandUseLayer,
  newsPinsLayer,
} from "./map/layers";
import { useTile3DLayer } from "./map/Tile3DLayer";
import { ALL_LAYERS, LENSES, layerCanEnable, type LayerId, type LensId, type MapViewState } from "./map/presets";

import { TopBar } from "./components/TopBar";
import { HourRail } from "./components/HourRail";
import { LayerPalette, type LayerStatus } from "./components/LayerPalette";
import { KpiStrip } from "./components/KpiStrip";
import { PmcuBrief } from "./components/PmcuBrief";
import { NewsDesk } from "./components/NewsDesk";
import { FacebookPanel } from "./components/FacebookPanel";
import { CoastalBrief, type MarineSnapshot } from "./components/CoastalBrief";
import { WaterPanel, type ReservoirStatus } from "./components/WaterPanel";
import { ProvincialKPIs, type ProvincialKPIs as ProvincialKPIsType } from "./components/ProvincialKPIs";
import { TidePanel, type TideSnapshot } from "./components/TidePanel";
import { FisheryPanel } from "./components/FisheryPanel";
import { EarthAlphaBrief } from "./components/EarthAlphaBrief";
// Heavy modals — lazy-loaded so they're excluded from the initial bundle.
// Each loads only on first open; subsequent opens are instant (module cached).
const SourceCatalog = lazy(() => import("./components/SourceCatalog").then((m) => ({ default: m.SourceCatalog })));
const Manual = lazy(() => import("./components/Manual").then((m) => ({ default: m.Manual })));
const Whitepaper = lazy(() => import("./components/Whitepaper").then((m) => ({ default: m.Whitepaper })));
const SheetsPanel = lazy(() => import("./components/SheetsPanel").then((m) => ({ default: m.SheetsPanel })));
const SituationDigest = lazy(() => import("./components/SituationDigest").then((m) => ({ default: m.SituationDigest })));

// Inline the SheetsPanel URL check so we don't eagerly load the whole module.
const SHEETS_STORAGE_KEY = "chonburi:sheets-url-v1";
import { AqiBadge, type AqiTrend } from "./components/AqiBadge";
import { BuildingCard } from "./components/BuildingCard";
import { BuildingSearch } from "./components/BuildingSearch";
import { MapOverlayControls } from "./components/MapOverlayControls";
import { WorldStrip } from "./components/WorldStrip";
import { TrendsPanel, type TrendsSnapshot } from "./components/TrendsPanel";
import { useWorldWeather } from "./hooks/useWorldWeather";
import { SpeedTestPanel } from "./components/SpeedTestPanel";
import { DeviceCheckIn } from "./components/DeviceCheckIn";
import { NewsTicker } from "./components/NewsTicker";
import { useSystemHealth } from "./hooks/useSystemHealth";
import { MarketsTicker } from "./components/MarketsTicker";
import { MobileNav, type MobilePanel } from "./components/MobileNav";
import { ChatBox } from "./components/ChatBox";
import { PredictivePanel, METRIC_LAYER_MAP, METRIC_LABEL, type ForecastMetric } from "./components/PredictivePanel";
import { ExecutiveBriefing } from "./components/ExecutiveBriefing";
import { API_BASE } from "./lib/apiBase";
import type { NasaEarthReadings, FacebookPost } from "@chonburi/shared";
import { useDevicePresence } from "./hooks/useDevicePresence";
import { useIsMobile } from "./hooks/useMediaQuery";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { useTheme } from "./hooks/useTheme";

/**
 * Basemap — CARTO no-labels at the bottom, labels rendered on TOP via a
 * separate raster source so deck.gl context layers can interleave between
 * them. Theme-aware: dark → carto dark + deep navy ocean tint;
 * light → carto positron-light + pale sky-blue ocean tint.
 */
// Yesterday ISO date — GIBS tiles publish with ~24 h delay
const GIBS_DATE = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const GIBS_BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

function gibsUrl(product: string, level: number, format: "jpg" | "png"): string {
  return `${GIBS_BASE}/${product}/default/${GIBS_DATE}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.${format}`;
}

// GIBS satellite layers rendered via MapLibre <Source>/<Layer> — MapLibre handles
// raster tile stretching perfectly (proven by the carto basemap).
// Deck.gl TileLayer is kept for esriSatelliteLayer only.
const GIBS_LAYERS: Array<{
  id: string;
  product: string;
  level: number;
  format: "jpg" | "png";
  opacity: number;
}> = [
  { id: "satellite-true-color",         product: "MODIS_Terra_CorrectedReflectance_TrueColor",    level: 9, format: "jpg", opacity: 0.85 },
  { id: "satellite-viirs-truecolor",     product: "VIIRS_NOAA20_CorrectedReflectance_TrueColor",   level: 9, format: "jpg", opacity: 0.85 },
  { id: "satellite-night",               product: "VIIRS_SNPP_DayNightBand_ENCC",                  level: 8, format: "png", opacity: 0.85 },
  { id: "satellite-imerg",               product: "IMERG_Precipitation_Rate",                      level: 6, format: "png", opacity: 0.75 },
  { id: "satellite-ndvi",                product: "MODIS_Terra_NDVI_8Day",                         level: 9, format: "png", opacity: 0.70 },
  { id: "satellite-lst",                 product: "MODIS_Terra_Land_Surface_Temp_Day",             level: 7, format: "png", opacity: 0.70 },
  { id: "satellite-aerosol",             product: "MODIS_Combined_Value_Added_AOD",                level: 7, format: "png", opacity: 0.70 },
  { id: "satellite-no2",                 product: "OMI_Nitrogen_Dioxide_Tropo_Column",             level: 6, format: "png", opacity: 0.70 },
  { id: "satellite-flood",               product: "MODIS_Combined_Flood_3-Day",                    level: 7, format: "png", opacity: 0.75 },
];

// Pre-computed, stable references for the React-rendered <Source>/<Layer> props.
// Without these, `tiles={[gibsUrl(...)]}` and `paint={{ "raster-opacity": ... }}`
// allocate a new array + object on every render, forcing react-map-gl to deep-diff
// raster sources on every map gesture.
const GIBS_RENDER: Array<{
  id: string;
  tiles: readonly [string];
  paint: { readonly "raster-opacity": number };
  maxzoom: number;
}> = GIBS_LAYERS.map((g) => ({
  id: g.id,
  tiles: [gibsUrl(g.product, g.level, g.format)] as const,
  paint: { "raster-opacity": g.opacity } as const,
  maxzoom: g.level,
}));

function basemapStyle(theme: "dark" | "light"): maplibregl.StyleSpecification {
  const baseSlug = theme === "dark" ? "dark_nolabels" : "light_nolabels";
  const labelsSlug = theme === "dark" ? "dark_only_labels" : "light_only_labels";
  const oceanBg = theme === "dark" ? "#031730" : "#E0F2FE";
  const baseOpacity = theme === "dark" ? 0.78 : 0.92;
  const labelOpacity = theme === "dark" ? 0.85 : 0.90;
  return {
    version: 8,
    sources: {
      "carto-base": {
        type: "raster",
        tiles: [
          `https://cartodb-basemaps-a.global.ssl.fastly.net/${baseSlug}/{z}/{x}/{y}.png`,
          `https://cartodb-basemaps-b.global.ssl.fastly.net/${baseSlug}/{z}/{x}/{y}.png`,
          `https://cartodb-basemaps-c.global.ssl.fastly.net/${baseSlug}/{z}/{x}/{y}.png`,
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap, © CARTO",
        maxzoom: 20,
      },
      "carto-labels": {
        type: "raster",
        tiles: [
          `https://cartodb-basemaps-a.global.ssl.fastly.net/${labelsSlug}/{z}/{x}/{y}.png`,
          `https://cartodb-basemaps-b.global.ssl.fastly.net/${labelsSlug}/{z}/{x}/{y}.png`,
          `https://cartodb-basemaps-c.global.ssl.fastly.net/${labelsSlug}/{z}/{x}/{y}.png`,
        ],
        tileSize: 256,
        maxzoom: 20,
      },
    },
    layers: [
      { id: "ocean-bg", type: "background", paint: { "background-color": oceanBg } },
      { id: "basemap", type: "raster", source: "carto-base", paint: { "raster-opacity": baseOpacity } },
      { id: "labels-top", type: "raster", source: "carto-labels", paint: { "raster-opacity": labelOpacity } },
    ],
  };
}

function normalizeProperties<T extends { features?: Array<{ properties?: object | null }> }>(data: T): T {
  if (data && Array.isArray(data.features)) {
    for (const f of data.features) {
      if (f.properties === null || f.properties === undefined) {
        (f as Record<string, unknown>).properties = {};
      }
    }
  }
  return data;
}

function useGeoJson<T extends { features?: Array<{ properties?: object | null }> }>(path: string) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(path, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        setData(normalizeProperties(j as T));
      })
      .catch(() => {});
    return () => {
      ctrl.abort();
    };
  }, [path]);
  return data;
}


function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function App() {
  const { theme } = useTheme();
  const mapStyle = useMemo(() => basemapStyle(theme), [theme]);
  const { health: systemHealth, error: systemHealthError } = useSystemHealth(60_000);
  const campus = useGeoJson<FeatureCollection<Polygon | MultiPolygon, CampusZoneProperties>>(
    "/geo/chula-campus.geojson",
  );
  const buildings = useGeoJson<FeatureCollection<Polygon | MultiPolygon, BuildingProperties>>(
    "/geo/chonburi-buildings.geojson",
  );
  // surrounding-buildings, bangkok-districts, flood-prone-areas removed —
  // all three files contain Chula/Bangkok coordinates and are invisible in
  // the Chonburi viewport. Use chonburi-flood-risk.geojson for flood zones.
  const cuLands = useGeoJson<FeatureCollection<Polygon | MultiPolygon, CuLandProperties>>(
    "/geo/cu-lands.geojson",
  );
  const roads = useGeoJson<FeatureCollection<LineString, RoadProps>>("/geo/chonburi-roads.geojson");
  const shuttleRoutes = useGeoJson<FeatureCollection<LineString, RouteProps>>("/geo/cu-shuttle-routes.geojson");
  const shuttleStops = useGeoJson<FeatureCollection<Point, StopProps>>("/geo/cu-shuttle-stops.geojson");
  const transitStations = useGeoJson<FeatureCollection<Point, StationProps>>("/geo/transit-stations.geojson");
  const transitLines = useGeoJson<FeatureCollection<LineString, TransitLineProps>>("/geo/transit-lines.geojson");
  const campusGates = useGeoJson<FeatureCollection<Point, GateProps>>("/geo/chula-gates.geojson");
  // neighborhood-tall-buildings.geojson is at Chula coordinates — removed.
  // Underground utilities + WiFi survey (hand-authored, see /public/geo/*)
  const electricityFc = useGeoJson<FeatureCollection<Geometry, Record<string, unknown>>>("/geo/cu-electricity.geojson");
  const waterFc = useGeoJson<FeatureCollection<Geometry, Record<string, unknown>>>("/geo/cu-water.geojson");
  const drainageFc = useGeoJson<FeatureCollection<Geometry, Record<string, unknown>>>("/geo/cu-drainage.geojson");
  const wifiFc = useGeoJson<FeatureCollection<Geometry, Record<string, unknown>>>("/geo/cu-wifi.geojson");

  // Hour + weekend state for the traffic simulation
  const [hour, setHour] = useState<number>(() => new Date().getHours());
  const [isWeekend, setIsWeekend] = useState<boolean>(() => {
    const d = new Date().getDay();
    return d === 0 || d === 6;
  });

  // Lens + per-layer toggles
  const [lens, setLens] = useState<LensId>("operations");
  const [mapViewState, setMapViewState] = useState<MapViewState>({ kind: "lens", lensId: "operations" });
  const [enabledLayers, setEnabledLayers] = useState<Set<LayerId>>(
    () => new Set(LENSES.find((l) => l.id === "operations")!.layers.filter((id) => layerCanEnable(id))),
  );
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [whitepaperOpen, setWhitepaperOpen] = useState(false);
  const [sheetsOpen, setSheetsOpen] = useState(false);
  const [sheetsConfigured, setSheetsConfigured] = useState(() => {
    try { return Boolean(localStorage.getItem(SHEETS_STORAGE_KEY)); } catch { return false; }
  });
  // Forecast alerts — metrics whose p50 has breached alertThreshold
  const [forecastAlerts, setForecastAlerts] = useState<Set<string>>(new Set());
  const [forecastMetrics, setForecastMetrics] = useState<ForecastMetric[]>([]);

  // Mobile: 1-column stack with bottom segmented nav to swap panels.
  const isMobile = useIsMobile();
  const online = useOnlineStatus();
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("map");

  // Controlled map viewState — needed so building-search and click can fly the camera.
  // Tight bounds: the mayor should never accidentally scroll to Bangkok.
  const [viewState, setViewState] = useState({
    ...CHONBURI.defaultView,
    minZoom: 13,
    maxZoom: 20,
    transitionDuration: 0,
    maxBounds: CHONBURI.outerBounds,
  });

  // Mirror viewState to a ref so high-frequency reads (click handler, deck.gl
  // event callback) don't depend on stale React closures and don't force callback
  // recreation on every pan/zoom frame.
  const viewStateRef = useRef(viewState);
  viewStateRef.current = viewState;

  // rAF-throttled viewState mirror — DeckGL fires onViewStateChange potentially
  // many times per frame (high-refresh trackpads fire pointer events at 240 Hz+).
  // We coalesce those into ONE React state update per animation frame so the
  // ~1300-line App component re-renders at most 60 Hz, regardless of gesture rate.
  // The ref stays current immediately so any synchronous reader sees the latest.
  const pendingViewStateRef = useRef<typeof viewState | null>(null);
  const rafScheduledRef = useRef(false);
  const handleViewStateChange = useCallback(({ viewState: vs }: { viewState: Record<string, unknown> }) => {
    const longitude = vs.longitude as number;
    const latitude = vs.latitude as number;
    const zoom = vs.zoom as number;
    const pitch = vs.pitch as number;
    const bearing = vs.bearing as number;
    const next = {
      ...viewStateRef.current,
      longitude, latitude, zoom, pitch, bearing,
      transitionDuration: 0,
    };
    pendingViewStateRef.current = next;
    viewStateRef.current = next;
    if (rafScheduledRef.current) return;
    rafScheduledRef.current = true;
    requestAnimationFrame(() => {
      rafScheduledRef.current = false;
      const pending = pendingViewStateRef.current;
      pendingViewStateRef.current = null;
      if (pending) setViewState(pending);
    });
  }, []);

  // Selected building for the popup card.
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingProperties | null>(null);

  // Camera helpers
  const flyTo = useCallback((longitude: number, latitude: number, zoom = 17) => {
    setViewState((prev) => ({
      ...prev,
      longitude,
      latitude,
      zoom,
      transitionDuration: 700,
    }));
  }, []);
  // handleMapClick reads viewState from ref to keep the callback identity stable —
  // before this change it was recreated on every pan/zoom frame because viewState
  // coords were in the deps array, forcing deck.gl to rebind its onClick prop.
  const handleMapClick = useCallback((info: { layer?: { id?: string } | null; object?: unknown; coordinate?: number[] }) => {
    if ((info.layer?.id === "municipality-buildings" || info.layer?.id === "campus-buildings") && info.object) {
      const f = info.object as { properties: BuildingProperties; geometry: { coordinates: number[][][] | number[][][][] } };
      setSelectedBuilding(f.properties);
      const vs = viewStateRef.current;
      const [lng, lat] = info.coordinate ?? [vs.longitude, vs.latitude];
      flyTo(lng, lat, Math.max(vs.zoom, 17));
    } else if (!info.layer) {
      setSelectedBuilding(null);
    }
  }, [flyTo]);

  const zoomBy = (delta: number) => {
    setViewState((prev) => ({
      ...prev,
      zoom: Math.max(prev.minZoom ?? 3, Math.min(prev.maxZoom ?? 20, prev.zoom + delta)),
      transitionDuration: 200,
    }));
  };

  // Device GPS presence — drives the on-map pulse + DeviceCheckIn panel.
  const { presence, request: requestDevice, clear: clearDevice } = useDevicePresence();
  const firstFixFlown = useRef(false);
  useEffect(() => {
    if (!firstFixFlown.current && presence.lng != null && presence.lat != null && presence.insideArea) {
      flyTo(presence.lng, presence.lat, 17);
      firstFixFlown.current = true;
    }
  }, [presence.lng, presence.lat, presence.insideArea, flyTo]);

  // View mode cycles 2D → 3D (buildings extrude) → 3DS (substructure: buildings
  // turn translucent, utilities drop to their burial depth). Camera follows.
  type ViewMode = "2D" | "3D" | "3DS";
  const [viewMode, setViewMode] = useState<ViewMode>("3D");
  const is3D = viewMode === "3D" || viewMode === "3DS";
  const isSubstructure = viewMode === "3DS";

  const cycleViewMode = useCallback(() => {
    setViewMode((prevMode) => {
      return prevMode === "2D" ? "3D" : prevMode === "3D" ? "3DS" : "2D";
    });
  }, []);

  useEffect(() => {
    setViewState((prev) => ({
      ...prev,
      pitch: viewMode === "2D" ? 0 : viewMode === "3D" ? 60 : 72,
      bearing: viewMode === "2D" ? 0 : viewMode === "3D" ? -18 : -28,
      transitionDuration: 700,
    }));
  }, [viewMode]);

  // ESC closes the topmost overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (manualOpen) setManualOpen(false);
      else if (whitepaperOpen) setWhitepaperOpen(false);
      else if (catalogOpen) setCatalogOpen(false);
      else if (selectedBuilding) setSelectedBuilding(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [catalogOpen, selectedBuilding, manualOpen]);

  // Lookup table for hover tooltips — keeps DeckGL declarative.
  const tooltipForPickMemo = useCallback((info: { layer?: { id?: string } | null; object?: unknown }) => {
    const o = info.object as Record<string, unknown> | undefined;
    if (!info.layer || !o) return null;
    const id = info.layer.id;
    const p = (o as { properties?: Record<string, unknown> }).properties ?? o;
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const v = (p as Record<string, unknown>)[k];
        if (typeof v === "string" && v.trim()) return v;
        if (typeof v === "number") return String(v);
      }
      return null;
    };
    let title: string | null = null;
    let sub: string | null = null;
    switch (id) {
      case "municipality-buildings":
      case "campus-buildings":
        title = pick("nameEn", "name", "nameTh") ?? "Building";
        sub = (() => {
          const lvls = (p as { levels?: number }).levels;
          const h = (p as { height?: number }).height;
          if (h) return `${h} m tall`;
          if (lvls) return `${lvls} floors`;
          return null;
        })();
        break;
      case "cu-lands":
        title = (() => {
          const n = (p as { name?: { en?: string } | string }).name;
          if (typeof n === "string") return n;
          if (n && typeof n === "object") return n.en ?? null;
          return null;
        })() ?? "Municipal land";
        sub = pick("describe", "operator");
        break;
      case "incidents-itic":
      case "incidents-city-reports":
        title = pick("title") ?? "Incident";
        sub = pick("category", "severity", "status");
        break;
      case "bma-pois":
        title = pick("name") ?? "BMA POI";
        sub = pick("kind", "description");
        break;
      case "bma-aq-stations":
        title = pick("name") ?? "AQ station";
        sub = `PM2.5 ${pick("pm25") ?? "—"} µg/m³`;
        break;
      case "cctv-cameras":
        title = pick("name") ?? "CCTV";
        sub = pick("vendor");
        break;
      case "cu-shuttle-vehicles":
        title = `Shuttle Line ${pick("line") ?? ""}`;
        sub = `${pick("occupancy") ?? "—"} occupancy`;
        break;
      case "cu-shuttle-stops":
        title = pick("name") ?? "Shuttle stop";
        sub = `Stop · ${pick("id") ?? ""}`;
        break;
      case "cu-shuttle-routes":
      case "cu-shuttle-line-1":
      case "cu-shuttle-line-2":
      case "cu-shuttle-line-3":
      case "cu-shuttle-line-4":
      case "cu-shuttle-line-5":
        title = pick("label") ?? "Shuttle";
        sub = pick("ref");
        break;
      case "transit-stations":
        title = pick("name") ?? "Transit station";
        sub = `${pick("system") ?? ""} · ${pick("line") ?? ""}`;
        break;
      case "civic-points": {
        const kind = (p as { kind?: string }).kind ?? "other";
        const palette = CIVIC_PALETTE[kind as CivicKind] ?? CIVIC_PALETTE.other;
        const nm = pick("name:en", "name", "name:th") ?? palette.label;
        title = `${palette.glyph} ${nm}`;
        sub = palette.label + (pick("operator") ? ` · ${pick("operator")}` : "");
        break;
      }
      case "waterways": {
        const wt = (p as { waterway?: string }).waterway ?? "stream";
        const nm = pick("name:en", "name", "name:th") ?? wt;
        title = nm;
        sub = wt.toUpperCase() + (pick("intermittent") === "yes" ? " · intermittent" : "");
        break;
      }
      case "ais-vessels":
        title = (p as { name?: string }).name || `MMSI ${(p as { mmsi?: string }).mmsi ?? "—"}`;
        sub = `${(p as { type?: string }).type ?? "vessel"} · ${(p as { speed?: number }).speed ?? "—"} kn`;
        break;
      case "datago-points":
        title = pick("name", "nameEn") ?? "data.go.th POI";
        sub = `${(p as { category?: string }).category ?? ""} · ${(p as { source?: string }).source ?? ""}`;
        break;
      case "gistda-pois":
        title = pick("name", "nameEn") ?? "GISTDA POI";
        sub = `${(p as { category?: string }).category ?? ""} · ${(p as { road?: string }).road ?? ""}`;
        break;
      case "gistda-solar":
        title = `Building #${pick("id") ?? ""}`;
        sub = `${(p as { solarIrr?: number }).solarIrr ?? "—"} kWh/m² · ${(p as { roofType?: string }).roofType ?? ""} · ${(p as { height?: number }).height ?? "—"} m`;
        break;
      case "news-pins": {
        const tags = (p as { tags?: string[] }).tags ?? [];
        title = pick("title") ?? "News";
        sub = `${tags.join(" ")} · ${pick("source") ?? ""}`;
        break;
      }
      case "gistda-landuse": {
        title = pick("name", "nameEn") ?? "Land parcel";
        sub = `${pick("code") ?? ""} · ${Math.round(Number((p as { area?: number }).area ?? 0))} m²`;
        break;
      }
      case "port-infrastructure":
      case "ferry-terminals":
      case "navigation-aids":
        title = pick("name:en", "name", "name:th") ?? "Maritime feature";
        sub = pick("man_made", "amenity", "harbour", "seamark:type") ?? null;
        break;
      case "temple-spires-base":
      case "old-town-district":
        title = pick("name") ?? pick("nameTh") ?? "Heritage site";
        sub = pick("era") ?? null;
        break;
      case "fisheries":
        title = pick("name") ?? "Fishery zone";
        sub = `${pick("kind") ?? ""} · ${pick("boats") ?? ""}${pick("yearly_yield_t") ? ` · ${pick("yearly_yield_t")} t/yr` : ""}`;
        break;
      case "flood-risk":
      case "flood-risk-zones":
        title = pick("name") ?? "Flood-prone area";
        sub = `${(pick("severity") ?? "").toUpperCase()} · ${pick("type") ?? ""}${pick("households") ? ` · ${pick("households")} households` : ""}`;
        break;
      case "cu-electricity-nodes":
        title = pick("name") ?? "Electricity";
        sub = (() => {
          const v = (p as { voltage?: number }).voltage;
          const c = (p as { capacityMva?: number; capacityKw?: number; capacityMwh?: number });
          const parts: string[] = [];
          if (v) parts.push(`${v} kV`);
          if (c.capacityMva) parts.push(`${c.capacityMva} MVA`);
          if (c.capacityKw) parts.push(`${c.capacityKw} kW PV`);
          if (c.capacityMwh) parts.push(`${c.capacityMwh} MWh BESS`);
          return parts.join(" · ");
        })();
        break;
      case "cu-electricity-lines":
      case "cu-electricity-paths-3ds":
        title = pick("name") ?? "Electricity line";
        sub = `${pick("voltage") ?? "—"} kV · buried ~2 m`;
        break;
      case "cu-water-nodes":
        title = pick("name") ?? "Water node";
        sub = pick("diameter") ? `Ø ${pick("diameter")} mm` : pick("kind");
        break;
      case "cu-water-lines":
      case "cu-water-paths-3ds":
        title = pick("name") ?? "Water pipe";
        sub = `Ø ${pick("diameter") ?? "—"} mm · buried ~3 m`;
        break;
      case "cu-drainage-nodes":
        title = pick("name") ?? "Drainage node";
        sub = (() => {
          const k = (p as { kind?: string }).kind;
          if (k === "retention-basin") return `Retention · ${pick("capacityM3") ?? "—"} m³`;
          return pick("describe");
        })();
        break;
      case "cu-drainage-lines":
      case "cu-drainage-paths-3ds":
        title = pick("name") ?? "Storm drain";
        sub = `Ø ${pick("diameter") ?? "—"} mm · buried ~4 m`;
        break;
      case "cu-wifi-points":
        title = pick("name") ?? "WiFi point";
        sub = `${pick("mbps") ?? "—"} Mbps · ${pick("rttMs") ?? "—"} ms`;
        break;
      default:
        return null;
    }
    return {
      html:
        `<div class="picker-tooltip"><div class="picker-title">${escapeHtml(title ?? "")}</div>` +
        (sub ? `<div class="picker-sub">${escapeHtml(sub)}</div>` : "") +
        `</div>`,
      style: {
        background: "transparent",
        border: "none",
        padding: "0",
      },
    };
  }, []);

  const onLensChange = useCallback((id: LensId) => {
    setLens(id);
    setMapViewState({ kind: "lens", lensId: id });
    const next = LENSES.find((l) => l.id === id);
    if (next) setEnabledLayers(new Set(next.layers.filter((layerId) => layerCanEnable(layerId))));
    setForecastAlerts(new Set()); // clear stale alert badges on lens switch
  }, []);

  const handleForecastMetricClick = useCallback((metric: string) => {
    const entry = METRIC_LAYER_MAP[metric];
    if (!entry) return;
    setEnabledLayers((prev) => {
      const next = new Set(prev);
      entry.layers.forEach((id) => next.add(id));
      return next;
    });
    if (entry.flyToCoast) flyTo(100.995, 13.352, 13.5);
  }, [flyTo]);

  const handleForecastAlert = useCallback((metric: string) => {
    setForecastAlerts((prev) => prev.has(metric) ? prev : new Set([...prev, metric]));
  }, []);
  // Transient toast — gives a layer toggle visible feedback when it would
  // otherwise render nothing (no features yet, or a feed that needs an API key).
  // Kills the "I clicked it and nothing happened" embarrassment.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);
  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, []);

  // Latest layer feedback (counts + feed health), read by onToggleLayer without
  // making the callback depend on every feed poll. Assigned during render below.
  const layerFeedbackRef = useRef<{
    counts: Record<string, number>;
    statuses: Partial<Record<LayerId, LayerStatus>>;
    enabled: Set<LayerId>;
  }>({ counts: {}, statuses: {}, enabled: new Set() });

  const onToggleLayer = useCallback((id: LayerId) => {
    const fb = layerFeedbackRef.current;
    const turningOn = !fb.enabled.has(id);
    setEnabledLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (turningOn) {
      const label = ALL_LAYERS.find((l) => l.id === id)?.label ?? id;
      const status = fb.statuses[id];
      const count = fb.counts[id];
      if (status?.tier === "unavailable") {
        showToast(`${label} — no live data (${status.note ?? "needs API key"})`);
      } else if (count === 0) {
        showToast(`${label} — no features to show right now`);
      }
    }
  }, [showToast]);
  const restoreLens = useCallback(() => {
    const next = LENSES.find((l) => l.id === lens);
    setMapViewState({ kind: "lens", lensId: lens });
    if (next) setEnabledLayers(new Set(next.layers.filter((layerId) => layerCanEnable(layerId))));
  }, [lens]);
  const setAerialOnly = useCallback(() => {
    setViewMode("2D");
    setMapViewState({ kind: "custom", label: "Clean aerial view" });
    setEnabledLayers(new Set<LayerId>(["satellite-esri", "municipality-boundary-line"]));
  }, []);
  const clearOverlays = useCallback(() => {
    setViewMode("2D");
    setMapViewState({ kind: "custom", label: "Overlays hidden" });
    setEnabledLayers(new Set<LayerId>(["satellite-esri", "municipality-boundary-line"]));
  }, []);

  // Feeds
  const cityReports = useFeed<IncidentFeature>(`${API_BASE}/api/incidents/city-reports`, 5 * 60_000);
  const iticEvents = useFeed<IncidentFeature>(`${API_BASE}/api/incidents/itic`, 3 * 60_000);
  const news = useFeed<IntelligenceItem>(`${API_BASE}/api/news`, 3 * 60_000);
  const weather = useFeed<WeatherSnapshot>(`${API_BASE}/api/weather`, 30 * 60_000);
  const airQuality = useFeed<AirQualityPoint>(`${API_BASE}/api/air-quality`, 15 * 60_000);
  const cctv = useFeed<CctvCamera>(`${API_BASE}/api/cctv/longdo`, 10 * 60_000);
  const aqiTrend = useFeed<AqiTrend>(`${API_BASE}/api/air-quality/trend`, 15 * 60_000);
  const trends = useFeed<TrendsSnapshot>(`${API_BASE}/api/trends`, 15 * 60_000);
  const executive = useFeed<ExecutiveSnapshot>(`${API_BASE}/api/executive`, 15 * 60_000);
  const markets = useFeed<MarketSnapshot>(`${API_BASE}/api/markets`, 10 * 60_000);
  const precip = useFeed<PrecipNowcast>(`${API_BASE}/api/precip-nowcast`, 5 * 60_000);
  const ais = useFeed<AisVessel>(`${API_BASE}/api/maritime/ais`, 60_000);
  const datago = useFeed<DatagoPoint>(`${API_BASE}/api/datago/points`, 30 * 60_000);
  const facebook = useFeed<FacebookPost>(`${API_BASE}/api/social/facebook`, 10 * 60_000);
  const marine = useFeed<MarineSnapshot>(`${API_BASE}/api/marine`, 30 * 60_000);
  const tides = useFeed<TideSnapshot>(`${API_BASE}/api/tides`, 10 * 60_000);
  const reservoirs = useFeed<ReservoirStatus>(`${API_BASE}/api/datago/reservoirs`, 60 * 60_000);
  const provincialKPIs = useFeed<ProvincialKPIsType>(`${API_BASE}/api/datago/provincial-kpis`, 6 * 60 * 60_000);
  const gistdaPois = useFeed<GistdaPoi>(`${API_BASE}/api/gistda/poi`, 60 * 60_000);
  const gistdaSolar = useFeed<GistdaSolarBuilding>(`${API_BASE}/api/gistda/solar`, 6 * 60 * 60_000);
  const gistdaLandUse = useFeed<GistdaLandUse>(`${API_BASE}/api/gistda/landuse`, 60 * 60_000);
  const nasaEarth = useFeed<NasaEarthReadings>(`${API_BASE}/api/nasa/earth-readings`, 6 * 60 * 60_000);
  // Shuttle and academic calendar not available in this deployment
  const shuttle = { data: [] as ShuttleVehicle[], fallbackTier: "unavailable" as const, ageMinutes: 0 };
  const academic = { data: [] as AcademicSnapshot[] };

  // Maritime infrastructure (static OSM GeoJSON)
  const maritimePorts = useGeoJson<FeatureCollection<Polygon | MultiPolygon | LineString, Record<string, unknown>>>(
    "/geo/chonburi-ports.geojson",
  );
  const maritimeFerries = useGeoJson<FeatureCollection<Point, Record<string, unknown>>>(
    "/geo/chonburi-ferries.geojson",
  );
  const maritimeNavAids = useGeoJson<FeatureCollection<Point, Record<string, unknown>>>(
    "/geo/chonburi-nav-aids.geojson",
  );
  const maritime = { ports: maritimePorts, ferries: maritimeFerries, navAids: maritimeNavAids };

  // Civic POIs + waterways (province-wide OSM)
  const civicPoints = useGeoJson<FeatureCollection<Point, Record<string, unknown>>>(
    "/geo/chonburi-civic.geojson",
  );
  const waterways = useGeoJson<FeatureCollection<LineString, Record<string, unknown>>>(
    "/geo/chonburi-waterways.geojson",
  );
  const fisheries = useGeoJson<FeatureCollection<Polygon | MultiPolygon, Record<string, unknown>>>(
    "/geo/chonburi-fisheries.geojson",
  );
  const heritage = useGeoJson<FeatureCollection<Point | Polygon | MultiPolygon, HeritageFeatureProps>>(
    "/geo/chonburi-heritage.geojson",
  );
  const floodRisk = useGeoJson<FeatureCollection<Polygon | MultiPolygon, Record<string, unknown>>>(
    "/geo/chonburi-flood-risk.geojson",
  );
  const worldWeather = useWorldWeather();
  const hostWeather = useMemo(() => {
    // Prefer browser-side Open-Meteo data (richer fields).
    const city = worldWeather.find((c) => c.city.id === "cbo");
    if (city) {
      const { city: _city, fetchedAt: _fetchedAt, ...rest } = city;
      return rest;
    }
    // Fall back to backend /api/weather when browser fetch fails (Safari, CSP, offline).
    const snap = weather.data?.[0];
    if (!snap) return null;
    return {
      tempC: snap.tempC,
      apparentTempC: snap.feelsLikeC,
      humidity: snap.humidity,
      rainNow: snap.precipMm,
      windKmh: snap.windKmh,
      windDeg: null,
      uv: null,
      cloudPct: null,
      pressurehPa: null,
      visKm: null,
      isDay: null,
      condition: snap.condition,
      sunrise: null,
      sunset: null,
      daily: [],
    };
  }, [worldWeather, weather.data]);

  const hostPulse = useMemo(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const openReports = cityReports.data.filter((r) => r.status !== "resolved").length;
    const news24h = news.data.filter((n) => {
      const t = new Date(n.publishedAt).getTime();
      return !Number.isNaN(t) && t >= oneDayAgo;
    }).length;
    return {
      iticEvents: iticEvents.data.length,
      openReports,
      news24h,
      shuttleLive: shuttle.data.length,
    };
  }, [iticEvents.data, cityReports.data, news.data, shuttle.data]);

  // BMA POIs are bundled static GeoJSON (Workers TLS can't reach bmagis.bangkok.go.th
  // from local workerd; production CF edge may, but static is robust either way).
  const bma = useBmaStatic();
  const bmaAqStationList: AqStation[] = useMemo(() => {
    if (!bma) return [];
    return bma.aqStations.features.map((f) => ({
      id: f.properties.AIRSTATION_ID ?? "aq",
      name: f.properties.NAME_T ?? "AQ station",
      address: f.properties.ADDRESS ?? "",
      pm25: f.properties.PM25 ?? null,
      pm10: f.properties.PM10 ?? null,
      lng: (f.geometry.coordinates as [number, number])[0],
      lat: (f.geometry.coordinates as [number, number])[1],
    }));
  }, [bma]);

  // Traffic samples — recomputed when hour or roads change
  const trafficSamples = useMemo(() => {
    if (!roads) return [];
    return buildTrafficSamples(roads, hour, { isWeekend });
  }, [roads, hour, isWeekend]);

  // 3D Tiles pilot — must be called at top level (Rules of Hooks)
  const tile3dLayer = useTile3DLayer({
    visible: enabledLayers.has("tile3d-buildings"),
    tilesetUrl: "/geo/3d-tiles/tileset.json",
  });

  // Quantized zoom level — only changes when crossing the discrete thresholds
  // used for maxRoofs. Prevents the layers useMemo from firing on every zoom tick.
  const zoomBucket = viewState.zoom >= 16.5 ? 2 : viewState.zoom >= 15.2 ? 1 : 0;

  // Pre-memoize the two largest layers (20,877 buildings each). The umbrella
  // `layers` memo below has ~40 deps including SWR feed polls — if any of those
  // change, the buildings/roofs GeoJsonLayer would otherwise be re-instantiated
  // and deck.gl would re-tessellate. With a stable reference, deck.gl sees the
  // same layer object and skips the diff entirely.
  const memoizedBuildingsLayer = useMemo<Layer | null>(
    () => buildings ? (buildingsLayer(buildings, { extruded: is3D, ghosted: isSubstructure }) as Layer) : null,
    [buildings, is3D, isSubstructure],
  );
  const memoizedRoofsLayer = useMemo<Layer | null>(
    () => {
      if (!buildings || !is3D || isSubstructure) return null;
      const maxRoofs = zoomBucket === 2 ? 3200 : zoomBucket === 1 ? 1400 : 500;
      return buildingRoofsLayer(buildings, { maxRoofs, elevationScale: 1.65 }) as Layer;
    },
    [buildings, is3D, isSubstructure, zoomBucket],
  );

  const layers = useMemo<Layer[]>(() => {
    const out: Layer[] = [];
    // Imagery first — renders beneath all vector data
    // Esri is the only satellite useful at city zoom — high-res tiles up to 19.
    if (enabledLayers.has("satellite-esri")) out.push(esriSatelliteLayer(1.0) as Layer);
    // Satellite rasters — GIBS layers now served via MapLibre <Source>/<Layer>
    // (see MapLibreMap children below) for reliable tile stretching at any zoom.
    // Only Esri HD (maxZoom:19), Himawari (WMS), and terrain stay in deck.gl.
    if (enabledLayers.has("satellite-terrain")) out.push(openTopoTerrainLayer(0.6) as Layer);
    if (enabledLayers.has("satellite-himawari")) out.push(himawariInfraredLayer(0.55) as Layer);
    // Municipal paper map (raster) — sits above satellites, below vectors so it can be read alongside building outlines.
    if (enabledLayers.has("cu-map-2015")) out.push(cuMapOverlay() as Layer);
    if (enabledLayers.has("bma-parks") && bma?.parks) out.push(bmaParksLayer(bma.parks) as Layer);
    if (enabledLayers.has("cu-lands") && cuLands) out.push(cuLandsLayer(cuLands) as Layer);
    const showBoundaryFill =
      enabledLayers.has("municipality-boundary-fill") ||
      enabledLayers.has("municipality-boundary") ||
      enabledLayers.has("campus-boundary");
    const showBoundaryLine = enabledLayers.has("municipality-boundary-line") || showBoundaryFill;
    if ((showBoundaryLine || showBoundaryFill) && campus)
      out.push(campusBoundaryLayer(campus, { filled: showBoundaryFill, stroked: showBoundaryLine }) as Layer);
    if ((enabledLayers.has("municipality-buildings") || enabledLayers.has("campus-buildings")) && memoizedBuildingsLayer)
      out.push(memoizedBuildingsLayer);
    if (enabledLayers.has("building-roofs") && memoizedRoofsLayer)
      out.push(memoizedRoofsLayer);
    // 3D Tiles pilot — OGC-standard streaming buildings (replaces extruded GeoJSON when available)
    if (tile3dLayer) out.push(tile3dLayer as Layer);
    if (enabledLayers.has("road-network") && roads)
      out.push(roadNetworkLayer(roads as unknown as FeatureCollection<LineString, ClassifiedRoadProps>) as Layer);
    if (enabledLayers.has("transit-lines") && transitLines)
      out.push(transitLinesLayer(transitLines) as Layer);
    if (enabledLayers.has("campus-gates") && campusGates)
      out.push(campusGatesLayer(campusGates) as Layer);
    if (enabledLayers.has("bma-pois") && bma && bma.pois.length > 0) out.push(bmaPoiLayer(bma.pois) as Layer);
    if (enabledLayers.has("bma-aq-stations") && bmaAqStationList.length > 0) out.push(bmaAqStationsLayer(bmaAqStationList) as Layer);
    if (enabledLayers.has("traffic-heatmap") && trafficSamples.length > 0) out.push(trafficHeatmapLayer(trafficSamples) as Layer);
    if (enabledLayers.has("cu-shuttle-routes") && shuttleRoutes) out.push(shuttleRoutesLayer(shuttleRoutes) as Layer);
    if (shuttleRoutes) {
      for (const id of ["1", "2", "3", "4", "5"] as const) {
        const key = `cu-shuttle-${id}` as LayerId;
        if (enabledLayers.has(key)) {
          const l = shuttleRouteLineLayer(id, shuttleRoutes);
          if (l) out.push(l as Layer);
        }
      }
    }
    if (enabledLayers.has("cu-shuttle-stops") && shuttleStops) out.push(shuttleStopsLayer(shuttleStops) as Layer);
    if (enabledLayers.has("cu-shuttle-vehicles") && shuttle.data.length > 0) out.push(shuttleVehiclesLayer(shuttle.data) as Layer);
    if (enabledLayers.has("transit-stations") && transitStations) out.push(transitStationsLayer(transitStations) as Layer);
    if (enabledLayers.has("cctv-cameras")) out.push(cctvLayer(cctv.data) as Layer);
    if (enabledLayers.has("incidents-city-reports")) out.push(incidentLayer("incidents-city-reports", cityReports.data) as Layer);
    if (enabledLayers.has("incidents-itic")) out.push(incidentLayer("incidents-itic", iticEvents.data) as Layer);
    // Maritime
    if (enabledLayers.has("maritime-overlay")) out.push(maritimeOverlayLayer() as Layer);
    if (enabledLayers.has("port-infrastructure") && maritime?.ports) out.push(portInfrastructureLayer(maritime.ports) as Layer);
    if (enabledLayers.has("ferry-terminals") && maritime?.ferries) out.push(ferryTerminalsLayer(maritime.ferries) as Layer);
    if (enabledLayers.has("navigation-aids") && maritime?.navAids) out.push(navigationAidsLayer(maritime.navAids) as Layer);
    if (enabledLayers.has("ais-vessels") && ais.data.length > 0) out.push(aisVesselsLayer(ais.data) as Layer);
    // Open data
    if (enabledLayers.has("datago-points") && datago.data.length > 0) out.push(datagoPointsLayer(datago.data) as Layer);
    // GISTDA POI Digital Twin (authoritative Thai government POIs)
    if (enabledLayers.has("gistda-pois") && gistdaPois.data.length > 0) out.push(gistdaPoiLayer(gistdaPois.data) as Layer);
    // GISTDA LOD2 Solar Irradiance (building rooftop solar potential)
    if (enabledLayers.has("gistda-solar") && gistdaSolar.data.length > 0) out.push(gistdaSolarLayer(gistdaSolar.data) as Layer);
    // GISTDA Land Use / Land Cover
    if (enabledLayers.has("gistda-landuse") && gistdaLandUse.data.length > 0) out.push(gistdaLandUseLayer(gistdaLandUse.data) as Layer);
    // News pins — geocoded headlines so the mayor sees "which market" at a glance
    if (enabledLayers.has("news-pins") && news.data.length > 0) out.push(newsPinsLayer(news.data) as Layer);
    // Civic POIs (province-wide OSM: hospitals/schools/police/fire/temples/markets/...)
    if (enabledLayers.has("civic-points") && civicPoints) out.push(civicPointsLayer(civicPoints) as Layer);
    // Waterways (canals + rivers + drains)
    if (enabledLayers.has("waterways") && waterways) out.push(waterwaysLayer(waterways) as Layer);
    // Fishing zones
    if (enabledLayers.has("fisheries") && fisheries) out.push(fisheriesLayer(fisheries) as Layer);
    // Heritage: explicit toggles so operators can remove these overlays for a clean aerial view.
    if (heritage) {
      const districtFc = {
        type: "FeatureCollection" as const,
        features: heritage.features.filter(f => f.properties.kind === "old-town-district"),
      } as FeatureCollection<Polygon | MultiPolygon, HeritageFeatureProps>;
      const spiresFc = {
        type: "FeatureCollection" as const,
        features: heritage.features.filter(f => f.properties.kind !== "old-town-district"),
      } as FeatureCollection<Point, HeritageFeatureProps>;
      if (enabledLayers.has("heritage-old-town")) {
        const dist = oldTownDistrictLayer(districtFc);
        if (dist) out.push(dist as Layer);
      }
      if (enabledLayers.has("heritage-temple-spires")) {
        out.push(...(templeSpiresLayer(spiresFc) as Layer[]));
      }
    }
    // Flood-risk polygons
    if (enabledLayers.has("flood-risk-zones") && floodRisk) out.push(floodRiskLayer(floodRisk) as Layer);
    // Distance grid (1·5·10 km)
    if (enabledLayers.has("distance-grid")) {
      out.push(distanceGridLayer(CHONBURI.center, [1, 5, 10]) as Layer);
      out.push(distanceGridLabelsLayer(CHONBURI.center, [1, 5, 10]) as Layer);
    }

    // Underground utilities. In 3DS we force-enable them and render the lines
    // as PathLayer at burial depth so they sit visibly under the ghosted
    // buildings. In 2D/3D the toggle controls visibility and lines stay flat.
    const showElectricity = enabledLayers.has("utility-electricity") || isSubstructure;
    const showWater = enabledLayers.has("utility-water") || isSubstructure;
    const showDrainage = enabledLayers.has("utility-drainage") || isSubstructure;
    if (showWater && waterFc) {
      if (isSubstructure) {
        const wp = waterPathLayer(waterFc);
        if (Array.isArray(wp)) out.push(...wp as Layer[]);
        else out.push(wp as Layer);
      } else out.push(waterLineLayer(waterFc) as Layer);
      out.push(waterNodeLayer(waterFc) as Layer);
    }
    if (showDrainage && drainageFc) {
      if (isSubstructure) {
        const dp = drainagePathLayer(drainageFc);
        if (Array.isArray(dp)) out.push(...dp as Layer[]);
        else out.push(dp as Layer);
      } else out.push(drainageLineLayer(drainageFc) as Layer);
      out.push(drainageNodeLayer(drainageFc) as Layer);
    }
    if (showElectricity && electricityFc) {
      if (isSubstructure) {
        const ep = electricityPathLayer(electricityFc);
        if (Array.isArray(ep)) out.push(...ep as Layer[]);
        else out.push(ep as Layer);
      } else out.push(electricityLineLayer(electricityFc) as Layer);
      out.push(electricityNodeLayer(electricityFc) as Layer);
    }
    // WiFi sits at the top so it's never occluded by other layers
    if (enabledLayers.has("utility-wifi-heat") && wifiFc) out.push(wifiHeatmapLayer(wifiFc) as Layer);
    if (enabledLayers.has("utility-wifi-points") && wifiFc) out.push(wifiPointsLayer(wifiFc) as Layer);

    // Device GPS pulse — always above everything else when a fix is available.
    if (presence.lng != null && presence.lat != null) {
      const [accDisk, dot] = devicePresenceLayer(presence.lng, presence.lat, presence.accuracyM);
      out.push(accDisk as Layer, dot as Layer);
    }

    return out;
  }, [
    enabledLayers, zoomBucket, is3D, isSubstructure, campus, buildings,
    memoizedBuildingsLayer, memoizedRoofsLayer,
    cuLands, trafficSamples,
    shuttleRoutes, shuttleStops, transitStations, transitLines, campusGates, roads,
    shuttle.data, cctv.data, cityReports.data,
    iticEvents.data, bma, bmaAqStationList, electricityFc, waterFc, drainageFc, wifiFc,
    civicPoints, waterways, fisheries, floodRisk, heritage,
    maritimePorts, maritimeFerries, maritimeNavAids, ais.data, datago.data,
    gistdaPois.data, gistdaSolar.data, gistdaLandUse.data, news.data,
    presence.lng, presence.lat, presence.accuracyM,
    tile3dLayer,
  ]);

  // Feature counts — passed to LayerPalette so every toggle shows a number,
  // making it immediately obvious whether the layer has data or not.
  const layerCounts = useMemo(() => ({
    "municipality-boundary-line": campus?.features.length ?? 0,
    "municipality-boundary-fill": campus?.features.length ?? 0,
    "municipality-boundary":      campus?.features.length ?? 0,
    "municipality-buildings": buildings?.features.length ?? 0,
    "building-roofs":         buildings?.features.length ?? 0,
    "heritage-old-town":      heritage?.features.filter((f) => f.properties.kind === "old-town-district").length ?? 0,
    "heritage-temple-spires": heritage?.features.filter((f) => f.properties.kind !== "old-town-district").length ?? 0,
    "road-network":           roads?.features.length ?? 0,
    "transit-stations":       transitStations?.features.length ?? 0,
    "transit-lines":          transitLines?.features.length ?? 0,
    "civic-points":           civicPoints?.features.length ?? 0,
    "waterways":              waterways?.features.length ?? 0,
    "fisheries":              fisheries?.features.length ?? 0,
    "flood-risk-zones":       floodRisk?.features.length ?? 0,
    "port-infrastructure":    maritimePorts?.features.length ?? 0,
    "ferry-terminals":        maritimeFerries?.features.length ?? 0,
    "navigation-aids":        maritimeNavAids?.features.length ?? 0,
    "ais-vessels":            ais.data.length,
    "cctv-cameras":           cctv.data.length,
    "incidents-itic":         iticEvents.data.length,
    "incidents-city-reports": cityReports.data.length,
    "datago-points":          datago.data.length,
    "gistda-pois":            gistdaPois.data.length,
    "gistda-solar":           gistdaSolar.data.length,
    "gistda-landuse":         gistdaLandUse.data.length,
    "news-pins":              news.data.filter((n) => n.lat != null).length,
  } as Record<string, number>), [
    campus, buildings, roads, transitStations, transitLines, civicPoints, waterways,
    fisheries, floodRisk, heritage, maritimePorts, maritimeFerries, maritimeNavAids,
    ais.data, cctv.data, iticEvents.data, cityReports.data, datago.data,
    gistdaPois.data, gistdaSolar.data, gistdaLandUse.data, news.data,
  ]);

  // Feed health per map layer — drives the "needs key" pill in the palette and
  // the toast on toggle. Only layers backed by a live feed appear here.
  const layerStatuses = useMemo<Partial<Record<LayerId, LayerStatus>>>(() => ({
    "ais-vessels":            { tier: ais.fallbackTier, note: ais.note },
    "cctv-cameras":           { tier: cctv.fallbackTier, note: cctv.note },
    "incidents-itic":         { tier: iticEvents.fallbackTier, note: iticEvents.note },
    "incidents-city-reports": { tier: cityReports.fallbackTier, note: cityReports.note },
    "datago-points":          { tier: datago.fallbackTier, note: datago.note },
    "gistda-pois":            { tier: gistdaPois.fallbackTier, note: gistdaPois.note },
    "gistda-solar":           { tier: gistdaSolar.fallbackTier, note: gistdaSolar.note },
    "gistda-landuse":         { tier: gistdaLandUse.fallbackTier, note: gistdaLandUse.note },
    "news-pins":              { tier: news.fallbackTier, note: news.note },
  }), [
    ais.fallbackTier, ais.note, cctv.fallbackTier, cctv.note,
    iticEvents.fallbackTier, iticEvents.note, cityReports.fallbackTier, cityReports.note,
    datago.fallbackTier, datago.note, gistdaPois.fallbackTier, gistdaPois.note,
    gistdaSolar.fallbackTier, gistdaSolar.note, gistdaLandUse.fallbackTier, gistdaLandUse.note,
    news.fallbackTier, news.note,
  ]);

  // Keep the toggle handler's view of feedback fresh without re-creating it.
  layerFeedbackRef.current = { counts: layerCounts, statuses: layerStatuses, enabled: enabledLayers };

  // Average GISTDA Solar irradiance across all buildings (kWh/m²/month)
  const avgSolarIrrKWh = useMemo(() => {
    const vals = gistdaSolar.data
      .map((b) => b.solarIrr)
      .filter((v): v is number => typeof v === "number" && v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [gistdaSolar.data]);

  const feedHealth = useMemo(() => [
    { label: "NEWS", tier: news.fallbackTier, ageMinutes: news.ageMinutes },
    { label: "CR", tier: cityReports.fallbackTier, ageMinutes: cityReports.ageMinutes },
    { label: "iTIC", tier: iticEvents.fallbackTier, ageMinutes: iticEvents.ageMinutes },
    { label: "CCTV", tier: cctv.fallbackTier, ageMinutes: cctv.ageMinutes },
    { label: "AIS", tier: ais.fallbackTier, ageMinutes: ais.ageMinutes },
    { label: "DATA", tier: datago.fallbackTier, ageMinutes: datago.ageMinutes },
    { label: "AQ", tier: aqiTrend.fallbackTier, ageMinutes: aqiTrend.ageMinutes },
    { label: "WX", tier: weather.fallbackTier, ageMinutes: weather.ageMinutes },
    { label: "EX", tier: executive.fallbackTier, ageMinutes: executive.ageMinutes },
    { label: "MK", tier: markets.fallbackTier, ageMinutes: markets.ageMinutes },
  ], [news.fallbackTier, news.ageMinutes, cityReports.fallbackTier, cityReports.ageMinutes, iticEvents.fallbackTier, iticEvents.ageMinutes, cctv.fallbackTier, cctv.ageMinutes, ais.fallbackTier, ais.ageMinutes, datago.fallbackTier, datago.ageMinutes, aqiTrend.fallbackTier, aqiTrend.ageMinutes, weather.fallbackTier, weather.ageMinutes, executive.fallbackTier, executive.ageMinutes, markets.fallbackTier, markets.ageMinutes]);

  return (
    <div
      className={`shell ${isMobile ? `mobile mobile-panel-${mobilePanel}` : ""}`}
      data-mobile={isMobile ? "true" : "false"}
    >
      {!online && (
        <div className="offline-banner mono" role="alert" aria-live="assertive">
          ⚠ OFFLINE — feeds are stale until the connection returns
        </div>
      )}
      {toast && (
        <div className="layer-toast mono" role="status" aria-live="polite">
          {toast}
        </div>
      )}
      {/* ── Top bar ── */}
      <TopBar
        feeds={feedHealth}
        onOpenCatalog={() => setCatalogOpen(true)}
        catalogCount={ALL_LAYERS.length}
        viewMode={viewMode}
        onCycleViewMode={cycleViewMode}
        onOpenManual={() => setManualOpen(true)}
        onOpenWhitepaper={() => setWhitepaperOpen(true)}
        onOpenSheets={() => setSheetsOpen(true)}
        sheetsConfigured={sheetsConfigured}
        academic={academic.data[0] ?? null}
        systemStatus={systemHealth?.system.status ?? "unknown"}
      />

      {/* Degraded system banner */}
      {systemHealth && systemHealth.system.status !== "healthy" && (
        <div className={`system-banner banner-${systemHealth.system.status}`}>
          <span className="mono">
            SYSTEM {systemHealth.system.status.toUpperCase()} — {" "}
            {systemHealth.system.down > 0 && `${systemHealth.system.down} adapter${systemHealth.system.down > 1 ? "s" : ""} down`}
            {systemHealth.system.down > 0 && systemHealth.system.degraded > 0 && ", "}
            {systemHealth.system.degraded > 0 && `${systemHealth.system.degraded} degraded`}
            {" · "}
            <a href={`${API_BASE}/api/health/detailed`} target="_blank" rel="noreferrer" className="banner-link">
              View details →
            </a>
          </span>
        </div>
      )}
      {!systemHealth && systemHealthError && (
        <div className="system-banner banner-down">
          <span className="mono">
            API HOST UNREACHABLE — {API_BASE.replace(/^https?:\/\//, "")} · {systemHealthError}
          </span>
        </div>
      )}

      {/* ── World strip: Chonburi host + 3 user-editable clocks ── */}
      <WorldStrip
        hostAqi={aqiTrend.data[0]?.current.aqi ?? null}
        hostPm25={aqiTrend.data[0]?.current.pm25 ?? null}
        hostWeather={hostWeather}
        hostPulse={hostPulse}
        precipNowcast={precip.data[0] ?? null}
      />

      {/* ── News ticker: stock-market scroll of top headlines ── */}
      <NewsTicker items={news.data} loading={news.fallbackTier === "loading"} />

      {/* ── Markets ticker: SET Bangkok + global indices + THB forex + WTI/Brent + FRED macro ── */}
      <MarketsTicker
        snapshot={markets.data[0] ?? null}
        loading={markets.fallbackTier === "loading"}
      />

      {/* ── Left sidebar: provincial Chonburi brief.
          EXEC vs OPS share the same sidebar — the lens only changes the map
          layer set (EXEC = strategic, OPS = day-to-day). The legacy Chula
          ExecutiveBrief / StrategicAlerts / PeerComparison panels were built
          for a university and don't belong on a city mayor's desk. ── */}
      <aside className="left-bar" aria-hidden={isMobile && mobilePanel !== "brief"}>
        {lens === "intelligence" && (
          <div className="left-section" style={{ paddingBottom: 12 }}>
            <Suspense fallback={null}>
              <SituationDigest
                nasaReadings={nasaEarth.data[0] ?? null}
                avgSolarIrrKWh={avgSolarIrrKWh}
                forecastAlerts={forecastAlerts}
                forecasts={forecastMetrics}
              />
            </Suspense>
          </div>
        )}
        {lens === "executive" && (
          <div className="left-section" style={{ paddingBottom: 12 }}>
            <ExecutiveBriefing
              executive={executive.data[0] ?? null}
              weather={weather.data[0] ?? null}
              airQuality={airQuality.data[0] ?? null}
              openIncidents={cityReports.data.filter((r) => r.status !== "resolved").length + iticEvents.data.length}
              reservoirs={reservoirs.data}
              markets={markets.data[0] ?? null}
              adapterHealth={systemHealth?.adapters}
              ageMinutes={executive.ageMinutes}
              fallbackTier={executive.fallbackTier === "loading" ? undefined : executive.fallbackTier}
            />
          </div>
        )}
        {provincialKPIs.data.length > 0 && (
          <div className="left-section">
            <ProvincialKPIs
              data={provincialKPIs.data[0] ?? null}
              loading={provincialKPIs.fallbackTier === "loading"}
              ageMinutes={provincialKPIs.ageMinutes}
              fallbackTier={provincialKPIs.fallbackTier === "loading" ? undefined : provincialKPIs.fallbackTier}
            />
          </div>
        )}
        <div className="left-section left-section-divided">
          <AqiBadge trend={aqiTrend.data[0] ?? null} loading={aqiTrend.fallbackTier === "loading"} />
        </div>
        <div className="left-section left-section-divided">
          <CoastalBrief
            data={marine.data[0] ?? null}
            loading={marine.fallbackTier === "loading"}
            ageMinutes={marine.ageMinutes}
            fallbackTier={marine.fallbackTier === "loading" ? undefined : marine.fallbackTier}
            source="open-meteo-marine"
          />
        </div>
        <div className="left-section left-section-divided">
          <TidePanel
            data={tides.data[0] ?? null}
            loading={tides.fallbackTier === "loading"}
            ageMinutes={tides.ageMinutes}
            fallbackTier={tides.fallbackTier === "loading" ? undefined : tides.fallbackTier}
            source="open-meteo-tides"
          />
        </div>
        <div className="left-section left-section-divided">
          <FisheryPanel
            marine={marine.data[0] ?? null}
            tide={tides.data[0] ?? null}
            precipMm={precip.data[0]?.nowMm ?? null}
            ageMinutes={marine.ageMinutes}
            fallbackTier={marine.fallbackTier === "loading" ? undefined : marine.fallbackTier}
            source="open-meteo-marine"
          />
        </div>
        <div className="left-section left-section-divided">
          <EarthAlphaBrief
            enabledLayers={enabledLayers}
            onToggleLayer={onToggleLayer}
            gistdaPoiCount={gistdaPois.data.length}
            gistdaSolarCount={gistdaSolar.data.length}
            gistdaLandUseCount={gistdaLandUse.data.length}
            floodZoneCount={floodRisk?.features.length ?? 0}
            waterwayCount={waterways?.features.length ?? 0}
            fisheryZoneCount={fisheries?.features.length ?? 0}
            openIncidentCount={cityReports.data.filter((r) => r.status !== "resolved").length + iticEvents.data.length}
            sheetsConfigured={sheetsConfigured}
            nasaReadings={nasaEarth.data[0] ?? null}
            avgSolarIrrKWh={avgSolarIrrKWh}
            ageMinutes={nasaEarth.ageMinutes}
            fallbackTier={nasaEarth.fallbackTier === "loading" ? undefined : nasaEarth.fallbackTier}
          />
        </div>
        {reservoirs.data.length > 0 && (
          <div className="left-section left-section-divided">
            <WaterPanel
              data={reservoirs.data}
              loading={reservoirs.fallbackTier === "loading"}
              ageMinutes={reservoirs.ageMinutes}
            />
          </div>
        )}
        <div className="left-section left-section-divided">
          <PredictivePanel
            apiBase={API_BASE}
            onMetricClick={handleForecastMetricClick}
            onAlert={handleForecastAlert}
            onForecastsLoaded={(f) => setForecastMetrics(f)}
          />
        </div>
        <PmcuBrief
          hour={hour}
          isWeekend={isWeekend}
          iticEvents={iticEvents.data}
          cityReports={cityReports.data}
          trafficSampleCount={trafficSamples.length}
          cuLands={cuLands}
        />
        <div className="left-section">
          <DeviceCheckIn presence={presence} onRequest={requestDevice} onClear={clearDevice} />
        </div>
        <div className="left-section">
          <SpeedTestPanel />
        </div>
        <div className="left-section">
          <span className="eyebrow mono">Municipal Brief</span>
          <KpiStrip
            cityReports={cityReports.data}
            iticEvents={iticEvents.data}
            airQuality={airQuality.data}
            weather={weather.data}
          />
        </div>
      </aside>

      {/* ── Map center — nothing overlaps this ── */}
      <main className="map-area" aria-hidden={isMobile && mobilePanel !== "map"}>
        <div className="map-host">
          <div className="sr-only" role="status" aria-live="polite">
            Chonburi map. {mapViewState.kind === "custom" ? mapViewState.label : `Current lens: ${LENSES.find((l) => l.id === lens)?.label ?? lens}`}.
            {enabledLayers.size} layers are currently enabled. Use Clean aerial view to inspect satellite imagery without data overlays.
          </div>
          <DeckGL
            viewState={viewState}
            onViewStateChange={handleViewStateChange}
            // Controller options — minZoom/maxZoom live in MapStateProps which is not
            // re-exported by @deck.gl/core, so we extend ControllerProps locally.
            // All three constraints enforce bounds *before* onViewStateChange fires,
            // preventing the one-frame "flash to outer space" that a pure React clamp cannot.
            // scrollZoom.speed: default 0.01 → one fast trackpad swipe jumps 5+ levels;
            // 0.004 is ~2.5× slower, still comfortable but safe.
            controller={{ minZoom: 13, maxZoom: 20, maxBounds: CHONBURI.outerBounds, scrollZoom: { speed: 0.004, smooth: false } } as ControllerProps & { minZoom?: number; maxZoom?: number }}
            layers={layers}
            getTooltip={tooltipForPickMemo}
            onClick={handleMapClick}
          >
            <MapLibreMap
              mapStyle={mapStyle}
              mapLib={maplibregl as unknown as typeof maplibregl}
              attributionControl={false}
              renderWorldCopies={false}
            >
              {/* GIBS satellite raster sources — rendered via MapLibre for
                  reliable tile stretching at any viewport zoom. Only active
                  layers are mounted so MapLibre only fetches what's needed.
                  `GIBS_RENDER` carries pre-built, stable {tiles, paint} refs
                  so React-render churn doesn't make MapLibre re-diff every frame. */}
              {GIBS_RENDER.filter(g => enabledLayers.has(g.id as LayerId)).map(g => (
                <Source
                  key={g.id}
                  id={`gibs-src-${g.id}`}
                  type="raster"
                  tiles={g.tiles as unknown as string[]}
                  tileSize={256}
                  minzoom={0}
                  maxzoom={g.maxzoom}
                >
                  <MapLayer
                    id={`gibs-lyr-${g.id}`}
                    type="raster"
                    paint={g.paint}
                    beforeId="labels-top"
                  />
                </Source>
              ))}
              {enabledLayers.has("satellite-esri") && (
                <Source
                  id="esri-world-imagery-src"
                  type="raster"
                  tiles={["https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"]}
                  tileSize={256}
                  maxzoom={19}
                >
                  <MapLayer
                    id="esri-world-imagery"
                    type="raster"
                    paint={{ "raster-opacity": 1 }}
                    beforeId="labels-top"
                  />
                </Source>
              )}
            </MapLibreMap>
          </DeckGL>
          <BuildingSearch
            buildings={buildings}
            onSelect={(centroid, props) => {
              setSelectedBuilding(props);
              flyTo(centroid[0], centroid[1], 17.5);
            }}
          />
          <MapOverlayControls
            mapViewState={mapViewState}
            onAerialOnly={setAerialOnly}
            onClearOverlays={clearOverlays}
            onRestoreLens={restoreLens}
          />
          {/* Map zoom controls — back-up for gesture / trackpad */}
          <div className="zoom-controls" aria-label="Map zoom controls">
            <button onClick={() => zoomBy(0.6)} aria-label="Zoom in" className="zoom-btn">+</button>
            <button onClick={() => zoomBy(-0.6)} aria-label="Zoom out" className="zoom-btn">−</button>
          </div>
          <BuildingCard
            building={selectedBuilding}
            onClose={() => setSelectedBuilding(null)}
          />
          {forecastAlerts.size > 0 && (
            <div style={{
              position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
              zIndex: 20, display: "flex", gap: 6, pointerEvents: "none",
            }}>
              {[...forecastAlerts].map((m) => (
                <span key={m} className="mono eyebrow" style={{
                  background: "var(--bad)", color: "var(--bg)",
                  padding: "3px 8px", fontSize: "0.60rem", letterSpacing: "0.1em",
                }}>▲ {METRIC_LABEL[m] ?? m} FORECAST</span>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Right sidebar: news (scrollable) + layer controls.
          StrategicAlerts and PeerComparison were Chula-university panels —
          removed until rebuilt with provincial peer data (Rayong, Chachoengsao). ── */}
      <aside className="right-bar" aria-hidden={isMobile && mobilePanel !== "layers"}>
        <div className="right-trends">
          <TrendsPanel
            snapshots={trends.data}
            loading={trends.fallbackTier === "loading"}
            ageMinutes={trends.ageMinutes}
            onRefresh={trends.refetch}
            fallbackTier={trends.fallbackTier === "loading" ? undefined : trends.fallbackTier}
          />
        </div>
        <div className="right-news">
          <NewsDesk
            items={news.data}
            loading={news.fallbackTier === "loading"}
            ageMinutes={news.ageMinutes}
            onRefresh={news.refetch}
          />
          <div className="left-section-divided" style={{ marginTop: 4 }}>
            <FacebookPanel
              posts={facebook.data}
              loading={facebook.fallbackTier === "loading"}
              ageMinutes={facebook.ageMinutes}
              fallbackTier={facebook.fallbackTier === "loading" ? undefined : facebook.fallbackTier}
            />
          </div>
        </div>
        <div className="right-layers">
          <LayerPalette
            lens={lens}
            onLensChange={onLensChange}
            enabled={enabledLayers}
            onToggleLayer={onToggleLayer}
            counts={layerCounts}
            statuses={layerStatuses}
          />
        </div>
      </aside>

      {/* ── Bottom bar: ident / traffic timeline / counts ── */}
      <div className="bottom-bar">
        <div className="bottom-ident">
          <span className="pill">v0.1</span>
          <span>Chonburi Town · Eastern Seaboard</span>
          <span className="pill pill-standard" title="UNDP-JTC Digital Twins for Cities (Jul 2025) · ADB Digital Twin Framework (May 2025)">DT·L2</span>
          <span className="bottom-standard mono">UNDP · ADB</span>
        </div>
        <HourRail
          hour={hour}
          isWeekend={isWeekend}
          onHourChange={setHour}
          onWeekendToggle={setIsWeekend}
        />
        <div className="bottom-stats">
          <span>{buildings?.features.length ?? 0} BUILDINGS · {trafficSamples.length} ROADS · {layers.length} LAYERS</span>
          <span>{civicPoints?.features.length ?? 0} CIVIC · {cctv.data.length} CCTV · {gistdaPois.data.length} GISTDA</span>
        </div>
      </div>

      {/* Modals — lazy-loaded chunks, fetched only on first open */}
      <Suspense fallback={null}>
        {catalogOpen && <SourceCatalog open={catalogOpen} onClose={() => setCatalogOpen(false)} />}
      </Suspense>
      <Suspense fallback={null}>
        {manualOpen && <Manual open={manualOpen} onClose={() => setManualOpen(false)} />}
      </Suspense>
      <Suspense fallback={null}>
        {whitepaperOpen && <Whitepaper open={whitepaperOpen} onClose={() => setWhitepaperOpen(false)} />}
      </Suspense>
      <Suspense fallback={null}>
        {sheetsOpen && (
          <SheetsPanel
            open={sheetsOpen}
            onClose={() => {
              setSheetsOpen(false);
              try { setSheetsConfigured(Boolean(localStorage.getItem(SHEETS_STORAGE_KEY))); } catch {}
            }}
          />
        )}
      </Suspense>
      <ChatBox apiBase={API_BASE} />
      {isMobile && <MobileNav panel={mobilePanel} onChange={setMobilePanel} />}
    </div>
  );
}
