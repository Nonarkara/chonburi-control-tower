export type LensId = "operations" | "mobility" | "environment" | "safety" | "vibes" | "maritime" | "executive";

export type LayerId =
  // Municipality core
  | "municipality-boundary"
  | "municipality-buildings"
  | "neighborhood-buildings"
  | "districts"
  | "flood-prone-areas"
  | "road-network"
  // Maritime (new)
  | "maritime-overlay"
  | "port-infrastructure"
  | "ferry-terminals"
  | "ais-vessels"
  | "navigation-aids"
  | "distance-grid"
  // Transit
  | "transit-stations"
  | "transit-lines"
  // Live ops
  | "traffic-heatmap"
  | "incidents-itic"
  | "incidents-city-reports"
  | "cctv-cameras"
  // Open data
  | "datago-points"
  // Civic
  | "civic-points"
  | "waterways"
  // Marine + risk
  | "fisheries"
  | "flood-risk-zones"
  // 3D Tiles
  | "tile3d-buildings"
  // Imagery
  | "satellite-esri"
  | "satellite-viirs-truecolor"
  | "satellite-night"
  | "satellite-imerg"
  | "satellite-aerosol"
  | "satellite-no2"
  | "satellite-true-color"
  | "satellite-himawari"
  | "satellite-ndvi"
  | "satellite-lst"
  | "satellite-flood"
  | "satellite-terrain"
  // (legacy IDs kept as no-op for backward compat — empty rendering)
  | "campus-boundary"
  | "campus-buildings"
  | "campus-gates"
  | "surrounding-buildings"
  | "cu-lands"
  | "cu-map-2015"
  | "bma-pois"
  | "bma-parks"
  | "bma-aq-stations"
  | "bangkok-districts"
  | "cu-shuttle-routes"
  | "cu-shuttle-1"
  | "cu-shuttle-2"
  | "cu-shuttle-3"
  | "cu-shuttle-4"
  | "cu-shuttle-5"
  | "cu-shuttle-stops"
  | "cu-shuttle-vehicles"
  | "utility-electricity"
  | "utility-water"
  | "utility-drainage"
  | "utility-wifi-heat"
  | "utility-wifi-points";

export interface Lens {
  id: LensId;
  label: string;
  describe: string;
  layers: LayerId[];
}

export const LENSES: Lens[] = [
  {
    id: "executive",
    label: "EXEC",
    describe:
      "Executive — strategic view. Municipal boundary + buildings + Esri satellite + maritime + districts. For the mayor and leadership team.",
    layers: [
      "municipality-boundary",
      "municipality-buildings",
      "districts",
      "satellite-esri",
      "maritime-overlay",
      "port-infrastructure",
      "transit-stations",
      "road-network",
      "datago-points",
    ],
  },
  {
    id: "operations",
    label: "OPS",
    describe: "Operations — buildings, road network, civic POIs (hospitals/police/fire/schools), waterways, live traffic, incidents, CCTV, AIS vessels. The default day-to-day view.",
    layers: [
      "municipality-boundary",
      "municipality-buildings",
      "road-network",
      "civic-points",
      "waterways",
      "traffic-heatmap",
      "incidents-city-reports",
      "incidents-itic",
      "cctv-cameras",
      "ais-vessels",
    ],
  },
  {
    id: "mobility",
    label: "MOB",
    describe: "Mobility — road network, transit stations, traffic heatmap, iTIC events, ferry terminals, AIS vessels, CCTV. For dispatch + routing decisions.",
    layers: [
      "municipality-boundary",
      "road-network",
      "transit-lines",
      "transit-stations",
      "ferry-terminals",
      "traffic-heatmap",
      "incidents-itic",
      "cctv-cameras",
      "ais-vessels",
    ],
  },
  {
    id: "maritime",
    label: "MAR",
    describe: "Maritime — Gulf of Thailand maritime infrastructure. OpenSeaMap overlay, Laem Chabang port, ferry terminals, navigation aids, live AIS vessels, 1·5·10 km reach grid.",
    layers: [
      "municipality-boundary",
      "satellite-esri",
      "maritime-overlay",
      "port-infrastructure",
      "ferry-terminals",
      "navigation-aids",
      "ais-vessels",
      "fisheries",
      "distance-grid",
    ],
  },
  {
    id: "environment",
    label: "ENV",
    describe: "Environment — Esri high-res satellite, AQ-relevant satellite layers, flood zones. Opt into MODIS NDVI/LST/AOD when zoomed out.",
    layers: [
      "municipality-boundary",
      "municipality-buildings",
      "satellite-esri",
      "flood-prone-areas",
    ],
  },
  {
    id: "safety",
    label: "SAF",
    describe: "Safety — coastal flood-risk zones, citizen reports (Traffy), iTIC, CCTV, waterways for drainage, hospitals + fire + police, MODIS flood detection, maritime warnings.",
    layers: [
      "municipality-boundary",
      "municipality-buildings",
      "civic-points",
      "waterways",
      "flood-risk-zones",
      "incidents-city-reports",
      "incidents-itic",
      "satellite-flood",
      "cctv-cameras",
      "navigation-aids",
    ],
  },
  {
    id: "vibes",
    label: "VIB",
    describe: "Vibes — pretty view. Municipal boundary + MODIS true-color satellite + maritime overlay. Use this when presenting Chonburi at a glance.",
    layers: ["municipality-boundary", "satellite-true-color", "maritime-overlay"],
  },
];

export type LayerGroup = "municipality" | "maritime" | "mobility" | "incidents" | "open-data" | "imagery" | "environment";

export const LAYER_GROUP_LABEL: Record<LayerGroup, string> = {
  municipality: "Municipality",
  maritime:     "Maritime",
  mobility:     "Mobility",
  incidents:    "Incidents",
  "open-data":  "Open data",
  imagery:      "Imagery",
  environment:  "Environment",
};

// ─── Satellite freshness ───────────────────────────────────────────────
// NASA GIBS products have different latency between the satellite pass
// and tile publication. Numbers below are the typical "delay in days"
// from the user's local now → the publicly served tile.
const SATELLITE_DELAY_DAYS: Partial<Record<LayerId, number>> = {
  "satellite-true-color":         1,    // MODIS Terra ~24-36 h
  "satellite-viirs-truecolor":    1,    // VIIRS NOAA-20 ~24 h
  "satellite-night":              1,    // VIIRS Day/Night Band ~24 h
  "satellite-himawari":           0,    // Himawari Band 13 — 10 min
  "satellite-imerg":              0,    // IMERG half-hourly, ~6 h delay
  "satellite-ndvi":               8,    // MODIS NDVI 8-day composite
  "satellite-lst":                1,    // MODIS LST day ~36 h
  "satellite-aerosol":            1,    // MAIAC AOD ~24 h
  "satellite-no2":                1,    // OMI NO2 ~24 h
  "satellite-flood":              3,    // MODIS 3-day combined flood
  "satellite-esri":               0,    // Esri mosaic — not date-specific
  "satellite-terrain":            0,    // OpenTopoMap — vector, static
};

export function satelliteFreshness(id: LayerId): { label: string; date: string } | null {
  const d = SATELLITE_DELAY_DAYS[id];
  if (d == null) return null;
  const t = new Date();
  t.setUTCDate(t.getUTCDate() - d);
  const date = t.toISOString().slice(0, 10);
  if (d === 0) return { label: "LIVE", date };
  if (d === 1) return { label: "Y’DAY", date };
  return { label: `${d}D AGO`, date };
}

export const ALL_LAYERS: {
  id: LayerId;
  label: string;
  swatch: string;
  group: LayerGroup;
  describe: string;
}[] = [
  // ─── Municipality ──────────────────────────────────────────────────────
  { id: "municipality-boundary",  label: "Municipal boundary",        swatch: "#0EA5E9", group: "municipality",
    describe: "Chonburi Town Municipality outer boundary (เทศบาลเมืองชลบุรี)." },
  { id: "municipality-buildings", label: "Buildings (OSM, 3D)",       swatch: "#0EA5E9", group: "municipality",
    describe: "All ~5,000 building footprints inside the municipality with height inferred from OSM tags or area heuristics. Click any building for name + levels; 3D mode extrudes them as boxes." },
  { id: "tile3d-buildings",       label: "Buildings (3D Tiles)",       swatch: "#7DD3FC", group: "municipality",
    describe: "Streaming 3D Tiles pilot for Chonburi city centre — generated from OSM footprints with real height extrusion. Replaces extruded GeoJSON with OGC-standard 3D Tiles." },
  { id: "neighborhood-buildings", label: "Skyline (tall ≥30 m)",      swatch: "#7DD3FC", group: "municipality",
    describe: "Tall buildings (≥ 30 m) in and around the municipality. Renders flat in 2D, extrudes in 3D for the skyline silhouette." },
  { id: "districts",              label: "District / sub-district",   swatch: "#FFFFFF", group: "municipality",
    describe: "Chonburi province sub-districts (tambons): Bang Pla Soi, Mueang, Saen Suk, Don Hua Lo." },
  { id: "flood-prone-areas",      label: "Flood-prone areas",         swatch: "#EF4444", group: "environment",
    describe: "Historical coastal flood-prone zones based on Department of Disaster Prevention records." },

  // ─── Maritime (NEW) ────────────────────────────────────────────────────
  { id: "maritime-overlay",       label: "OpenSeaMap overlay",        swatch: "#22D3EE", group: "maritime",
    describe: "OpenSeaMap raster overlay — shows shipping lanes, depth contours, anchorage zones, mooring buoys for the Gulf of Thailand." },
  { id: "port-infrastructure",    label: "Port infrastructure",        swatch: "#F59E0B", group: "maritime",
    describe: "Laem Chabang port + Si Racha tanker anchorage + Chonburi harbour piers (from OSM way[harbour], landuse=port)." },
  { id: "ferry-terminals",        label: "Ferry / pier terminals",     swatch: "#FBBF24", group: "maritime",
    describe: "Pier and ferry terminal POIs (Bang Saen, Si Racha, Koh Si Chang ferry)." },
  { id: "navigation-aids",        label: "Lighthouses + nav aids",     swatch: "#FACC15", group: "maritime",
    describe: "Lighthouses, beacons, navigation buoys around the Eastern Seaboard." },
  { id: "ais-vessels",            label: "AIS vessels (live)",         swatch: "#10B981", group: "maritime",
    describe: "Live vessel positions from AIS (Automatic Identification System) — cargo, tanker, fishing, passenger. Requires AISSTREAM_TOKEN; placeholder otherwise." },
  { id: "distance-grid",          label: "Distance grid (1·5·10 km)",  swatch: "#0EA5E9", group: "municipality",
    describe: "Concentric rings at 1 km / 5 km / 10 km from the municipal centroid. Reads as 'how far can the mayor / fire / ambulance get to'." },

  // ─── Mobility ──────────────────────────────────────────────────────────
  { id: "road-network",      label: "Road network (classified)", swatch: "#FB7185", group: "mobility",
    describe: "OSM road network coloured + scaled by class: motorway/primary thick warm, secondary/tertiary medium cyan, residential/lane thin." },
  { id: "traffic-heatmap",   label: "Traffic — by hour",       swatch: "#F87171", group: "mobility",
    describe: "Modelled traffic intensity weighted by hour-of-day + weekday/weekend. Drives the orange/red glow on arterials." },
  { id: "transit-stations",  label: "Bus / transit stops",     swatch: "#38BDF8", group: "mobility",
    describe: "Bus stops + transit nodes inside the municipality from OSM." },
  { id: "transit-lines",     label: "Transit lines (where mapped)", swatch: "#057B43", group: "mobility",
    describe: "Polyline tracks for any rail / metro lines reaching the EEC corridor (e.g. proposed BTS extension)." },
  { id: "cctv-cameras",      label: "CCTV cameras",            swatch: "#E5E7EB", group: "mobility",
    describe: "Public traffic cameras from Longdo inside the Chonburi bbox. Click for the live JPG/HLS stream." },

  // ─── Incidents ─────────────────────────────────────────────────────────
  { id: "incidents-itic",    label: "iTIC traffic events",     swatch: "#F59E0B", group: "incidents",
    describe: "Live iTIC / Longdo traffic events: accidents, closures, breakdowns. Bbox-filtered to Chonburi." },
  { id: "incidents-city-reports", label: "Citizen reports (Traffy)", swatch: "#A78BFA", group: "incidents",
    describe: "Live citizen complaints from Traffy Fondue — Thailand's nationwide 311 channel." },

  // ─── Open data ─────────────────────────────────────────────────────────
  { id: "datago-points",     label: "data.go.th points",        swatch: "#C084FC", group: "open-data",
    describe: "Government POIs from data.go.th filtered to Chonburi: schools, hospitals, health centres, government offices, temples, markets." },

  // ─── Civic (OSM, province-wide) ────────────────────────────────────────
  { id: "civic-points",      label: "Civic POIs (color-coded)", swatch: "#EF4444", group: "municipality",
    describe: "Hospitals (✚ red) · clinics (pink) · schools (🅢 violet) · police (P cyan) · fire stations (🜂 orange) · government (cerulean) · temples (卐 gold) · markets (▦ green) · post offices · substations · water works. Hover for name. From OSM province-wide." },
  { id: "waterways",         label: "Canals + rivers + drains",  swatch: "#0EA5E9", group: "municipality",
    describe: "Hydrology network: rivers (sky blue, thick), canals (cerulean, medium), streams (pale sky, thin), drains/ditches (teal). Critical for flood-prevention planning + identifying drainage backbone." },
  { id: "fisheries",         label: "Fishing + aquaculture zones", swatch: "#FBBF24", group: "maritime",
    describe: "Coastal fishing economy: Ang Sila oysters · Bang Saen shrimp · Bang Phra mussels · Chonburi Bay artisanal · Koh Si Chang offshore. Click for boat count + yield." },
  { id: "flood-risk-zones",  label: "Coastal flood-risk zones",   swatch: "#EF4444", group: "environment",
    describe: "Hand-authored polygons of historical flood-prone areas (king-tide, storm-surge, drainage-backflow). Hover for severity + household count. Replace with municipal GIS when supplied." },

  // ─── Imagery ───────────────────────────────────────────────────────────
  { id: "satellite-esri",    label: "Satellite (Esri HD)",      swatch: "#60A5FA", group: "imagery",
    describe: "Esri World Imagery — high-res aerial / satellite mosaic. Good detail up to zoom 19." },
  { id: "satellite-terrain", label: "OpenTopoMap (zoom < 14)",  swatch: "#A3E635", group: "imagery",
    describe: "OpenTopoMap with contour lines and hillshade. Useful at regional zoom." },
  { id: "satellite-viirs-truecolor", label: "VIIRS true-color", swatch: "#A5F3FC", group: "imagery",
    describe: "VIIRS NOAA-20 corrected reflectance — daily, sharper than MODIS." },
  { id: "satellite-night",   label: "VIIRS night lights",       swatch: "#FACC15", group: "imagery",
    describe: "VIIRS Day/Night Band — Earth at night. The Eastern Seaboard glows along Sukhumvit and the port belt." },
  { id: "satellite-true-color", label: "MODIS true-color",      swatch: "#93C5FD", group: "imagery",
    describe: "MODIS Terra corrected reflectance — daily 250 m global mosaic. Best at zoom < 10." },
  { id: "satellite-himawari", label: "Himawari IR",             swatch: "#C7D2FE", group: "imagery",
    describe: "Himawari-9 Band 13 infrared — geostationary cloud loop, 10-min refresh. Best for monsoon fronts over the Gulf." },
  { id: "satellite-imerg",   label: "IMERG rainfall",           swatch: "#06B6D4", group: "imagery",
    describe: "NASA IMERG half-hourly global precipitation rate. Watch monsoon cells move across the Gulf." },
  { id: "satellite-ndvi",    label: "NDVI greenery",            swatch: "#34D399", group: "imagery",
    describe: "MODIS NDVI 8-day composite — vegetation greenness." },
  { id: "satellite-lst",     label: "Land surface temp",        swatch: "#F97316", group: "imagery",
    describe: "MODIS LST (day) — urban heat island. Chonburi city core typically reads 3–5 °C hotter than surrounding shrimp ponds." },
  { id: "satellite-aerosol", label: "Aerosol optical depth",    swatch: "#F472B6", group: "imagery",
    describe: "MODIS MAIAC AOD — proxy for PM2.5 + haze / industrial plumes from Laem Chabang." },
  { id: "satellite-no2",     label: "NO₂ pollution (OMI)",      swatch: "#EF4444", group: "imagery",
    describe: "OMI tropospheric NO₂ — traffic + power-plant nitrogen dioxide. Bright along the Sukhumvit corridor." },
  { id: "satellite-flood",   label: "Flood detection",          swatch: "#38BDF8", group: "imagery",
    describe: "MODIS 3-day combined flood detection — water surfaces flagged by satellite. Critical during monsoon." },
];
