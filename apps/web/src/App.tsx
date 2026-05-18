import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import type { Layer } from "@deck.gl/core";
import { Map as MapLibreMap } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import type { FeatureCollection, Geometry, LineString, Point, Polygon, MultiPolygon } from "geojson";
import { CHULA } from "@chula/shared";
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
} from "@chula/shared";

import { useFeed } from "./hooks/useFeed";
import { useBmaStatic } from "./hooks/useBmaStatic";
import { buildTrafficSamples, type RoadProps } from "./sim/trafficSim";
import {
  bmaAqStationsLayer,
  bmaParksLayer,
  bmaPoiLayer,
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
} from "./map/layers";
import { ALL_LAYERS, LENSES, type LayerId, type LensId } from "./map/presets";

import { TopBar } from "./components/TopBar";
import { HourRail } from "./components/HourRail";
import { LayerPalette } from "./components/LayerPalette";
import { KpiStrip } from "./components/KpiStrip";
import { PmcuBrief } from "./components/PmcuBrief";
import { NewsDesk } from "./components/NewsDesk";
import { SourceCatalog } from "./components/SourceCatalog";
import { Manual } from "./components/Manual";
import { SheetsPanel, loadSheetsUrl } from "./components/SheetsPanel";
import { AqiBadge, type AqiTrend } from "./components/AqiBadge";
import { BuildingCard } from "./components/BuildingCard";
import { BuildingSearch } from "./components/BuildingSearch";
import { WorldStrip } from "./components/WorldStrip";
import { TrendsPanel, type TrendsSnapshot } from "./components/TrendsPanel";
import { useWorldWeather } from "./hooks/useWorldWeather";
import { SpeedTestPanel } from "./components/SpeedTestPanel";
import { DeviceCheckIn } from "./components/DeviceCheckIn";
import { NewsTicker } from "./components/NewsTicker";
import { MarketsTicker } from "./components/MarketsTicker";
import { MobileNav, type MobilePanel } from "./components/MobileNav";
import { ChatBox } from "./components/ChatBox";
import { ExecutiveBrief } from "./components/ExecutiveBrief";
import { PeerComparison } from "./components/PeerComparison";
import { StrategicAlerts } from "./components/StrategicAlerts";
import { useDevicePresence } from "./hooks/useDevicePresence";
import { useIsMobile } from "./hooks/useMediaQuery";
import { useOnlineStatus } from "./hooks/useOnlineStatus";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

/**
 * Basemap — CARTO dark_nolabels at the bottom. Labels (CARTO dark_only_labels)
 * are rendered on TOP of all deck.gl context layers via a separate Mapbox/Maplibre
 * raster source registered as the last style layer. This matches the
 * city-reporter-v2 pane stack: base → satellite (deck.gl) → labels.
 */
const BASEMAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "carto-dark-base": {
      type: "raster",
      tiles: [
        "https://cartodb-basemaps-a.global.ssl.fastly.net/dark_nolabels/{z}/{x}/{y}.png",
        "https://cartodb-basemaps-b.global.ssl.fastly.net/dark_nolabels/{z}/{x}/{y}.png",
        "https://cartodb-basemaps-c.global.ssl.fastly.net/dark_nolabels/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap, © CARTO",
      maxzoom: 20,
    },
    "carto-dark-labels": {
      type: "raster",
      tiles: [
        "https://cartodb-basemaps-a.global.ssl.fastly.net/dark_only_labels/{z}/{x}/{y}.png",
        "https://cartodb-basemaps-b.global.ssl.fastly.net/dark_only_labels/{z}/{x}/{y}.png",
        "https://cartodb-basemaps-c.global.ssl.fastly.net/dark_only_labels/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 20,
    },
  },
  layers: [
    { id: "basemap", type: "raster", source: "carto-dark-base" },
    // Labels-on-top: this layer renders ABOVE the basemap; deck.gl draws between
    // basemap and this layer via the mapbox-overlay interleave behaviour.
    { id: "labels-top", type: "raster", source: "carto-dark-labels", paint: { "raster-opacity": 0.85 } },
  ],
};

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
  const campus = useGeoJson<FeatureCollection<Polygon | MultiPolygon, CampusZoneProperties>>(
    "/geo/chula-campus.geojson",
  );
  const buildings = useGeoJson<FeatureCollection<Polygon | MultiPolygon, BuildingProperties>>(
    "/geo/chula-buildings.geojson",
  );
  const surroundingBuildings = useGeoJson<FeatureCollection<Polygon | MultiPolygon, SurroundingBuildingProperties>>(
    "/geo/surrounding-buildings.geojson",
  );
  const districts = useGeoJson<FeatureCollection<Polygon | MultiPolygon, DistrictProperties>>(
    "/geo/bangkok-districts.geojson",
  );
  const floodAreas = useGeoJson<FeatureCollection<Polygon | MultiPolygon, FloodAreaProperties>>(
    "/geo/flood-prone-areas.geojson",
  );
  const cuLands = useGeoJson<FeatureCollection<Polygon | MultiPolygon, CuLandProperties>>(
    "/geo/cu-lands.geojson",
  );
  const roads = useGeoJson<FeatureCollection<LineString, RoadProps>>("/geo/chula-roads.geojson");
  const shuttleRoutes = useGeoJson<FeatureCollection<LineString, RouteProps>>("/geo/cu-shuttle-routes.geojson");
  const shuttleStops = useGeoJson<FeatureCollection<Point, StopProps>>("/geo/cu-shuttle-stops.geojson");
  const transitStations = useGeoJson<FeatureCollection<Point, StationProps>>("/geo/transit-stations.geojson");
  const transitLines = useGeoJson<FeatureCollection<LineString, TransitLineProps>>("/geo/transit-lines.geojson");
  const campusGates = useGeoJson<FeatureCollection<Point, GateProps>>("/geo/chula-gates.geojson");
  const neighborhoodBuildings = useGeoJson<FeatureCollection<Polygon | MultiPolygon, NeighborhoodBuildingProps>>(
    "/geo/neighborhood-tall-buildings.geojson",
  );
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
  const [enabledLayers, setEnabledLayers] = useState<Set<LayerId>>(
    () => new Set(LENSES.find((l) => l.id === "operations")!.layers),
  );
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [sheetsOpen, setSheetsOpen] = useState(false);
  const [sheetsConfigured, setSheetsConfigured] = useState(() => Boolean(loadSheetsUrl()));

  // Mobile: 1-column stack with bottom segmented nav to swap panels.
  const isMobile = useIsMobile();
  const online = useOnlineStatus();
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("map");

  // Controlled map viewState — needed so building-search and click can fly the camera.
  const [viewState, setViewState] = useState({
    ...CHULA.defaultView,
    minZoom: 12,
    maxZoom: 20,
    transitionDuration: 0,
  });

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
  const handleMapClick = useCallback((info: { layer?: { id?: string } | null; object?: unknown; coordinate?: number[] }) => {
    if (info.layer?.id === "campus-buildings" && info.object) {
      const f = info.object as { properties: BuildingProperties; geometry: { coordinates: number[][][] | number[][][][] } };
      setSelectedBuilding(f.properties);
      const [lng, lat] = info.coordinate ?? [viewState.longitude, viewState.latitude];
      flyTo(lng, lat, Math.max(viewState.zoom, 17));
    } else if (!info.layer) {
      setSelectedBuilding(null);
    }
  }, [flyTo, viewState.longitude, viewState.latitude, viewState.zoom]);

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
    if (!firstFixFlown.current && presence.lng != null && presence.lat != null && presence.insideCampus) {
      flyTo(presence.lng, presence.lat, 17);
      firstFixFlown.current = true;
    }
  }, [presence.lng, presence.lat, presence.insideCampus, flyTo]);

  // View mode cycles 2D → 3D (buildings extrude) → 3DS (substructure: buildings
  // turn translucent, utilities drop to their burial depth). Camera follows.
  type ViewMode = "2D" | "3D" | "3DS";
  const [viewMode, setViewMode] = useState<ViewMode>("2D");
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
      pitch: viewMode === "2D" ? 0 : viewMode === "3D" ? 50 : 62,
      bearing: viewMode === "2D" ? 0 : viewMode === "3D" ? -18 : -28,
      transitionDuration: 700,
    }));
  }, [viewMode]);

  // ESC closes the topmost overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (manualOpen) setManualOpen(false);
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
        })() ?? "CU land";
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
        title = `CU Shuttle Line ${pick("line") ?? ""}`;
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
        title = pick("label") ?? "CU Shuttle";
        sub = pick("ref");
        break;
      case "transit-stations":
        title = pick("name") ?? "Transit station";
        sub = `${pick("system") ?? ""} · ${pick("line") ?? ""}`;
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
      case "surrounding-buildings":
        title = pick("nameEn", "name", "nameTh") ?? "Building";
        sub = (() => {
          const h = (p as { height?: number }).height;
          const lvls = (p as { levels?: number }).levels;
          if (h) return `${h} m tall`;
          if (lvls) return `${lvls} floors`;
          return null;
        })();
        break;
      case "bangkok-districts":
        title = pick("nameEn") ?? "District";
        sub = `${pick("nameTh") ?? ""} · ${pick("code") ?? ""}`;
        break;
      case "flood-prone-areas":
        title = pick("nameEn") ?? "Flood zone";
        sub = `${(p as { risk?: string }).risk?.toUpperCase() ?? ""} risk · ${pick("frequency") ?? ""}`;
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
    const next = LENSES.find((l) => l.id === id);
    if (next) setEnabledLayers(new Set(next.layers));
  }, []);
  const onToggleLayer = useCallback((id: LayerId) => {
    setEnabledLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Feeds
  const cityReports = useFeed<IncidentFeature>(`${API_BASE}/api/incidents/city-reports`, 5 * 60_000);
  const iticEvents = useFeed<IncidentFeature>(`${API_BASE}/api/incidents/itic`, 3 * 60_000);
  const news = useFeed<IntelligenceItem>(`${API_BASE}/api/news`, 3 * 60_000);
  const weather = useFeed<WeatherSnapshot>(`${API_BASE}/api/weather`, 30 * 60_000);
  const airQuality = useFeed<AirQualityPoint>(`${API_BASE}/api/air-quality`, 15 * 60_000);
  const cctv = useFeed<CctvCamera>(`${API_BASE}/api/cctv/longdo`, 10 * 60_000);
  const shuttle = useFeed<ShuttleVehicle>(`${API_BASE}/api/transit/cu-shuttle`, 30_000);
  const aqiTrend = useFeed<AqiTrend>(`${API_BASE}/api/air-quality/trend`, 15 * 60_000);
  const trends = useFeed<TrendsSnapshot>(`${API_BASE}/api/trends`, 15 * 60_000);
  const executive = useFeed<ExecutiveSnapshot>(`${API_BASE}/api/executive`, 15 * 60_000);
  const markets = useFeed<MarketSnapshot>(`${API_BASE}/api/markets`, 10 * 60_000);
  const precip = useFeed<PrecipNowcast>(`${API_BASE}/api/precip-nowcast`, 5 * 60_000);
  const academic = useFeed<AcademicSnapshot>(`${API_BASE}/api/academic-calendar`, 30 * 60_000);
  const worldWeather = useWorldWeather();
  const bangkokWeather = useMemo(() => {
    const city = worldWeather.find((c) => c.city.id === "bkk");
    if (!city) return null;
    const { city: _city, fetchedAt: _fetchedAt, ...rest } = city;
    return rest;
  }, [worldWeather]);

  const bangkokPulse = useMemo(() => {
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

  const layers = useMemo<Layer[]>(() => {
    const out: Layer[] = [];
    // Imagery first — renders beneath all vector data
    // Esri is the only satellite useful at city zoom — high-res tiles up to 19.
    if (enabledLayers.has("satellite-esri")) out.push(esriSatelliteLayer(1.0) as Layer);
    // OpenTopoMap renders contours that fight with our building outlines —
    // hide it at zoom ≥ 14 (city scale) so it only helps the regional view.
    if (enabledLayers.has("satellite-terrain") && viewState.zoom < 14)
      out.push(openTopoTerrainLayer(0.6) as Layer);
    // MODIS / Himawari are 250 m – 1 km globals. They smear past zoom 10, so
    // we pass `currentZoom` and let the factory mark them invisible.
    if (enabledLayers.has("satellite-true-color"))
      out.push(gibsLayer("MODIS_Terra_CorrectedReflectance_TrueColor", undefined, 0.55, viewState.zoom) as Layer);
    if (enabledLayers.has("satellite-viirs-truecolor"))
      out.push(gibsLayer("VIIRS_NOAA20_CorrectedReflectance_TrueColor", undefined, 0.65, viewState.zoom) as Layer);
    if (enabledLayers.has("satellite-night"))
      out.push(gibsLayer("VIIRS_SNPP_DayNightBand_ENCC", undefined, 0.85, viewState.zoom) as Layer);
    if (enabledLayers.has("satellite-himawari"))
      out.push(himawariInfraredLayer(0.55, viewState.zoom) as Layer);
    if (enabledLayers.has("satellite-imerg"))
      out.push(gibsLayer("IMERG_Precipitation_Rate", undefined, 0.7, viewState.zoom) as Layer);
    if (enabledLayers.has("satellite-ndvi"))
      out.push(gibsLayer("MODIS_Terra_NDVI_8Day", undefined, 0.6, viewState.zoom) as Layer);
    if (enabledLayers.has("satellite-lst"))
      out.push(gibsLayer("MODIS_Terra_Land_Surface_Temp_Day", undefined, 0.65, viewState.zoom) as Layer);
    if (enabledLayers.has("satellite-aerosol"))
      out.push(gibsLayer("MODIS_Combined_Value_Added_AOD", undefined, 0.7, viewState.zoom) as Layer);
    if (enabledLayers.has("satellite-no2"))
      out.push(gibsLayer("OMI_Nitrogen_Dioxide_Tropo_Column", undefined, 0.7, viewState.zoom) as Layer);
    if (enabledLayers.has("satellite-flood"))
      out.push(gibsLayer("MODIS_Combined_Flood_3-Day", undefined, 0.7, viewState.zoom) as Layer);
    // CU paper map (raster) — sits above satellites, below vectors so it can be read alongside building outlines.
    if (enabledLayers.has("cu-map-2015")) out.push(cuMapOverlay() as Layer);
    if (enabledLayers.has("bma-parks") && bma?.parks) out.push(bmaParksLayer(bma.parks) as Layer);
    if (enabledLayers.has("cu-lands") && cuLands) out.push(cuLandsLayer(cuLands) as Layer);
    if (enabledLayers.has("campus-boundary") && campus) out.push(campusBoundaryLayer(campus) as Layer);
    if (enabledLayers.has("campus-buildings") && buildings)
      out.push(buildingsLayer(buildings, { extruded: is3D, ghosted: isSubstructure }) as Layer);
    if (enabledLayers.has("neighborhood-buildings") && neighborhoodBuildings)
      out.push(neighborhoodBuildingsLayer(neighborhoodBuildings, { extruded: is3D, ghosted: isSubstructure }) as Layer);
    if (enabledLayers.has("surrounding-buildings") && surroundingBuildings)
      out.push(surroundingBuildingsLayer(surroundingBuildings, { extruded: is3D, ghosted: isSubstructure }) as Layer);
    if (enabledLayers.has("road-network") && roads)
      out.push(roadNetworkLayer(roads as unknown as FeatureCollection<LineString, ClassifiedRoadProps>) as Layer);
    if (enabledLayers.has("transit-lines") && transitLines)
      out.push(transitLinesLayer(transitLines) as Layer);
    if (enabledLayers.has("campus-gates") && campusGates)
      out.push(campusGatesLayer(campusGates) as Layer);
    if (enabledLayers.has("bangkok-districts") && districts) {
      out.push(districtBoundariesLayer(districts) as Layer);
      out.push(districtLabelsLayer(districts) as Layer);
    }
    if (enabledLayers.has("flood-prone-areas") && floodAreas)
      out.push(floodProneAreasLayer(floodAreas) as Layer);
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
    enabledLayers, viewState.zoom, is3D, isSubstructure, campus, buildings,
    surroundingBuildings, districts, floodAreas, cuLands, trafficSamples,
    shuttleRoutes, shuttleStops, transitStations, transitLines, campusGates, neighborhoodBuildings, roads,
    shuttle.data, cctv.data, cityReports.data,
    iticEvents.data, bma, bmaAqStationList, electricityFc, waterFc, drainageFc, wifiFc,
    presence.lng, presence.lat, presence.accuracyM,
  ]);

  const feedHealth = useMemo(() => [
    { label: "NEWS", tier: news.fallbackTier, ageMinutes: news.ageMinutes },
    { label: "CR", tier: cityReports.fallbackTier, ageMinutes: cityReports.ageMinutes },
    { label: "iTIC", tier: iticEvents.fallbackTier, ageMinutes: iticEvents.ageMinutes },
    { label: "BMA", tier: (bma ? "cache" : "loading") as "cache" | "loading", ageMinutes: 0 },
    { label: "CCTV", tier: cctv.fallbackTier, ageMinutes: cctv.ageMinutes },
    { label: "BUS", tier: shuttle.fallbackTier, ageMinutes: shuttle.ageMinutes },
    { label: "AQ", tier: aqiTrend.fallbackTier, ageMinutes: aqiTrend.ageMinutes },
    { label: "WX", tier: weather.fallbackTier, ageMinutes: weather.ageMinutes },
    { label: "EX", tier: executive.fallbackTier, ageMinutes: executive.ageMinutes },
    { label: "MK", tier: markets.fallbackTier, ageMinutes: markets.ageMinutes },
  ], [news.fallbackTier, news.ageMinutes, cityReports.fallbackTier, cityReports.ageMinutes, iticEvents.fallbackTier, iticEvents.ageMinutes, bma, cctv.fallbackTier, cctv.ageMinutes, shuttle.fallbackTier, shuttle.ageMinutes, aqiTrend.fallbackTier, aqiTrend.ageMinutes, weather.fallbackTier, weather.ageMinutes, executive.fallbackTier, executive.ageMinutes, markets.fallbackTier, markets.ageMinutes]);

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
      {/* ── Top bar ── */}
      <TopBar
        feeds={feedHealth}
        onOpenCatalog={() => setCatalogOpen(true)}
        catalogCount={ALL_LAYERS.length}
        viewMode={viewMode}
        onCycleViewMode={cycleViewMode}
        onOpenManual={() => setManualOpen(true)}
        onOpenSheets={() => setSheetsOpen(true)}
        sheetsConfigured={sheetsConfigured}
        academic={academic.data[0] ?? null}
      />

      {/* ── World strip: Bangkok host + 3 user-editable clocks ── */}
      <WorldStrip
        bangkokAqi={aqiTrend.data[0]?.current.aqi ?? null}
        bangkokPm25={aqiTrend.data[0]?.current.pm25 ?? null}
        bangkokWeather={bangkokWeather}
        bangkokPulse={bangkokPulse}
        precipNowcast={precip.data[0] ?? null}
      />

      {/* ── News ticker: stock-market scroll of top campus headlines ── */}
      <NewsTicker items={news.data} loading={news.fallbackTier === "loading"} />

      {/* ── Markets ticker: SET Bangkok + global indices + THB forex + WTI/Brent + FRED macro ── */}
      <MarketsTicker
        snapshot={markets.data[0] ?? null}
        loading={markets.fallbackTier === "loading"}
      />

      {/* ── Left sidebar: operational or executive brief ── */}
      <aside className={`left-bar ${lens === "executive" ? "left-bar-exec" : ""}`}>
        {lens === "executive" ? (
          <>
            <ExecutiveBrief
              data={executive.data[0] ?? null}
              loading={executive.fallbackTier === "loading"}
            />
          </>
        ) : (
          <>
            <AqiBadge trend={aqiTrend.data[0] ?? null} loading={aqiTrend.fallbackTier === "loading"} />
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
              <span className="eyebrow mono">Campus Brief</span>
              <KpiStrip
                cityReports={cityReports.data}
                iticEvents={iticEvents.data}
                airQuality={airQuality.data}
                weather={weather.data}
              />
            </div>
          </>
        )}
      </aside>

      {/* ── Map center — nothing overlaps this ── */}
      <main className="map-area">
        <div className="map-host">
          <DeckGL
            viewState={viewState}
            onViewStateChange={({ viewState: vs }) => {
              const { longitude, latitude, zoom, pitch, bearing } = vs as Record<string, number>;
              setViewState((prev) => ({ ...prev, longitude, latitude, zoom, pitch, bearing, transitionDuration: 0 }));
            }}
            controller
            layers={layers}
            getTooltip={tooltipForPickMemo}
            onClick={handleMapClick}
          >
            <MapLibreMap
              mapStyle={BASEMAP_STYLE}
              mapLib={maplibregl as unknown as typeof maplibregl}
              attributionControl={false}
              renderWorldCopies={false}
            />
          </DeckGL>
          <BuildingSearch
            buildings={buildings}
            onSelect={(centroid, props) => {
              setSelectedBuilding(props);
              flyTo(centroid[0], centroid[1], 17.5);
            }}
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
        </div>
      </main>

      {/* ── Right sidebar: news (scrollable) + layer controls ── */}
      <aside className="right-bar">
        {lens === "executive" && executive.data[0] && (
          <div className="right-alerts">
            <StrategicAlerts alerts={executive.data[0].alerts} />
          </div>
        )}
        <div className="right-trends">
          <TrendsPanel
            snapshots={trends.data}
            loading={trends.fallbackTier === "loading"}
            ageMinutes={trends.ageMinutes}
            onRefresh={trends.refetch}
          />
        </div>
        {lens === "executive" && executive.data[0] && (
          <div className="right-peers">
            <PeerComparison peers={executive.data[0].peers} />
          </div>
        )}
        <div className="right-news">
          <NewsDesk
            items={news.data}
            loading={news.fallbackTier === "loading"}
            ageMinutes={news.ageMinutes}
            onRefresh={news.refetch}
          />
        </div>
        <div className="right-layers">
          <LayerPalette
            lens={lens}
            onLensChange={onLensChange}
            enabled={enabledLayers}
            onToggleLayer={onToggleLayer}
          />
        </div>
      </aside>

      {/* ── Bottom bar: ident / traffic timeline / counts ── */}
      <div className="bottom-bar">
        <div className="bottom-ident">
          <span className="pill">v0.1</span>
          <span>Chula Main · Bangkok</span>
        </div>
        <HourRail
          hour={hour}
          isWeekend={isWeekend}
          onHourChange={setHour}
          onWeekendToggle={setIsWeekend}
        />
        <div className="bottom-stats">
          <span>{trafficSamples.length} ROADS · {layers.length} LAYERS</span>
          <span>{bma?.pois.length ?? 0} BMA · {cctv.data.length} CCTV · {shuttle.data.length} BUSES</span>
        </div>
      </div>

      <SourceCatalog open={catalogOpen} onClose={() => setCatalogOpen(false)} />
      <Manual open={manualOpen} onClose={() => setManualOpen(false)} />
      <SheetsPanel
        open={sheetsOpen}
        onClose={() => { setSheetsOpen(false); setSheetsConfigured(Boolean(loadSheetsUrl())); }}
      />
      <ChatBox apiBase={API_BASE} />
      {isMobile && <MobileNav panel={mobilePanel} onChange={setMobilePanel} />}
    </div>
  );
}
