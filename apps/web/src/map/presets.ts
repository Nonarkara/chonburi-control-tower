export type LensId = "operations" | "mobility" | "environment" | "safety" | "vibes" | "utilities" | "executive";

export type LayerId =
  | "campus-boundary"
  | "campus-buildings"
  | "surrounding-buildings"
  | "cu-map-2015"
  | "cu-lands"
  | "bangkok-districts"
  | "flood-prone-areas"
  | "satellite-viirs-truecolor"
  | "satellite-night"
  | "satellite-imerg"
  | "satellite-aerosol"
  | "satellite-no2"
  | "bma-pois"
  | "bma-parks"
  | "bma-aq-stations"
  | "traffic-heatmap"
  | "incidents-itic"
  | "incidents-city-reports"
  | "cctv-cameras"
  | "cu-shuttle-routes"
  | "cu-shuttle-1"
  | "cu-shuttle-2"
  | "cu-shuttle-3"
  | "cu-shuttle-4"
  | "cu-shuttle-5"
  | "cu-shuttle-stops"
  | "cu-shuttle-vehicles"
  | "transit-stations"
  | "transit-lines"
  | "campus-gates"
  | "road-network"
  | "neighborhood-buildings"
  | "satellite-ndvi"
  | "satellite-true-color"
  | "satellite-esri"
  | "satellite-lst"
  | "satellite-flood"
  | "satellite-himawari"
  | "satellite-terrain"
  | "utility-electricity"
  | "utility-water"
  | "utility-drainage"
  | "utility-wifi-heat"
  | "utility-wifi-points";

export interface Lens {
  id: LensId;
  label: string;
  /** Full name + 1-line explanation rendered as the button's hover tooltip. */
  describe: string;
  layers: LayerId[];
}

export const LENSES: Lens[] = [
  {
    id: "executive",
    label: "EXEC",
    describe:
      "Executive — strategic view. Campus boundary + CU lands + neighborhood skyline + Esri satellite + BMA POIs + AQ stations + transit. For president and leadership team.",
    layers: [
      "campus-boundary",
      "campus-buildings",
      "neighborhood-buildings",
      "campus-gates",
      "cu-lands",
      "bangkok-districts",
      "satellite-esri",
      "bma-pois",
      "bma-aq-stations",
      "transit-stations",
      "transit-lines",
      "road-network",
    ],
  },
  {
    id: "operations",
    label: "OPS",
    describe: "Operations — campus + surrounding buildings + CU lands, road network, live traffic, incidents, shuttle vehicles, campus gates, BMA POIs and AQ. The default day-to-day view.",
    layers: [
      "campus-boundary",
      "campus-buildings",
      "surrounding-buildings",
      "cu-lands",
      "road-network",
      "campus-gates",
      "traffic-heatmap",
      "incidents-city-reports",
      "incidents-itic",
      "cu-shuttle-1",
      "cu-shuttle-2",
      "cu-shuttle-vehicles",
      "bma-pois",
      "bma-aq-stations",
    ],
  },
  {
    id: "mobility",
    label: "MOB",
    describe: "Mobility — road network, BTS/MRT lines + stations, traffic heatmap, iTIC events, all 5 CU shuttle lines + stops + live vehicles, campus gates, Longdo CCTV. For dispatch + routing decisions.",
    layers: [
      "campus-boundary",
      "campus-buildings",
      "cu-lands",
      "road-network",
      "transit-lines",
      "transit-stations",
      "campus-gates",
      "traffic-heatmap",
      "incidents-itic",
      "cu-shuttle-1",
      "cu-shuttle-2",
      "cu-shuttle-3",
      "cu-shuttle-4",
      "cu-shuttle-5",
      "cu-shuttle-stops",
      "cu-shuttle-vehicles",
      "cctv-cameras",
    ],
  },
  {
    id: "environment",
    label: "ENV",
    describe: "Environment — Esri high-res satellite, BMA green spaces, BMA AQ monitoring. Other satellites (NDVI, LST, NO2) are opt-in once you zoom out.",
    // Only the high-res satellite at city zoom — MODIS/Himawari globals
    // smear at zoom > 10 and are opt-in via toggle when you zoom out.
    layers: [
      "campus-boundary",
      "campus-buildings",
      "cu-lands",
      "satellite-esri",
      "bma-parks",
      "bma-aq-stations",
    ],
  },
  {
    id: "safety",
    label: "SAF",
    describe: "Safety — citizen reports (Traffy / CR), iTIC traffic events, BMA hospitals + fire + police POIs, CCTV, flood-prone areas, and MODIS flood detection if there is any.",
    layers: [
      "campus-boundary",
      "campus-buildings",
      "surrounding-buildings",
      "cu-lands",
      "incidents-city-reports",
      "incidents-itic",
      "flood-prone-areas",
      "satellite-flood",
      "cctv-cameras",
      "bma-pois",
    ],
  },
  {
    id: "vibes",
    label: "VIB",
    describe: "Vibes — pretty view. CU lands + MODIS true-color satellite. Use this when presenting the campus's place in Bangkok at a glance.",
    layers: ["campus-boundary", "cu-lands", "satellite-true-color"],
  },
  {
    id: "utilities",
    label: "UTL",
    describe: "Utilities — underground electricity (MEA substations + 115/22 kV feeders), water mains (MWA), storm drainage with retention basin, and the WiFi survey heatmap.",
    layers: [
      "campus-boundary",
      "campus-buildings",
      "utility-electricity",
      "utility-water",
      "utility-drainage",
      "utility-wifi-heat",
      "utility-wifi-points",
    ],
  },
];

export type LayerGroup = "campus" | "mobility" | "incidents" | "utility" | "imagery" | "environment";

export const LAYER_GROUP_LABEL: Record<LayerGroup, string> = {
  campus:    "Campus",
  mobility:  "Mobility",
  incidents: "Incidents",
  utility:   "Utility",
  imagery:   "Imagery",
  environment: "Environment",
};

export const ALL_LAYERS: {
  id: LayerId;
  label: string;
  swatch: string;
  group: LayerGroup;
  /** Hover tooltip text — what this layer shows and where the data comes from. */
  describe: string;
}[] = [
  // Campus
  { id: "campus-boundary",   label: "Campus boundary",         swatch: "#B7307A", group: "campus",
    describe: "Chulalongkorn University official perimeter from OSM (MultiPolygon, 8 sub-areas)." },
  { id: "campus-buildings",  label: "Campus buildings (OSM)",  swatch: "#B7307A", group: "campus",
    describe: "All 270 building footprints inside campus, with height from OSM building:levels (or our heuristic). Click any building for name + levels; 3D mode extrudes them." },
  { id: "cu-map-2015",       label: "CU paper map (2015)",     swatch: "#F472B6", group: "campus",
    describe: "The official 2015 PMCU printed campus map, georeferenced as a raster overlay (Bunthadthong → Ratchadamri, Rama I → Si Lom)." },
  { id: "cu-lands",          label: "CU lands (Siam/Samyan)",  swatch: "#B7307A", group: "campus",
    describe: "PMCU portfolio polygons: Siamscape, Siam Sq One, Samyan Mitrtown, Samyan Market, Chamchuri Sq, MBK, Stadium One, Suphachalasai, Nimibutr, Centenary Park, Thapthim Shrine, Chula Hospital." },
  { id: "bma-pois",          label: "BMA POIs (hosp/fire/…)",  swatch: "#EF4444", group: "campus",
    describe: "107 BMA points-of-interest in the campus bbox: hospitals, fire stations, police, health centers, BMA offices, markets. From bmagis.bangkok.go.th." },
  { id: "bma-parks",         label: "BMA parks / green space", swatch: "#34D399", group: "campus",
    describe: "196 named green spaces from the BMA Public Park dataset — includes rooftop gardens, pocket parks, and expressway green strips around campus." },
  { id: "bma-aq-stations",   label: "BMA AQ monitoring",       swatch: "#22D3EE", group: "campus",
    describe: "Official BMA air-quality monitoring station — currently the Chamchuri / Sam Yan MRT station with live PM2.5." },
  // Mobility
  { id: "traffic-heatmap",   label: "Traffic — by hour",       swatch: "#F87171", group: "mobility",
    describe: "Modelled traffic intensity along OSM road centrelines, weighted by hour-of-day + weekday/weekend. Drives the orange/red glow on arterials. Will accept live probe data when wired." },
  { id: "cu-shuttle-routes", label: "CU Shuttle — all routes", swatch: "#EF4444", group: "mobility",
    describe: "All 5 CU POP Bus lines rendered together — free 100% electric shuttle, ~3 M passenger trips/year (Samyan Smart City data)." },
  { id: "cu-shuttle-1",      label: "Shuttle Line 1 (Sat ✓)",  swatch: "#EF4444", group: "mobility",
    describe: "POP Bus Line 1 (red): Sala Phra Kieo → Political Sci → Patumwan Demo → Veterinary → Chalerm Phao → Lido → Pharmacy → Triamudom → Architecture → Arts → Engineering. Runs Saturday." },
  { id: "cu-shuttle-2",      label: "Shuttle Line 2 (Sat ✓)",  swatch: "#38BDF8", group: "mobility",
    describe: "POP Bus Line 2 (blue): Sala Phra Kieo → Econ → Sci → Education → CU Demo → Chamchuri 9 → Chula Stadium → Dhamma → Allied Health → BTS Nat. Stadium → loop. Runs Saturday." },
  { id: "cu-shuttle-3",      label: "Shuttle Line 3 (Sat ✗)",  swatch: "#34D399", group: "mobility",
    describe: "POP Bus Line 3 (green): Sala Phra Kieo → Pol Sci → Medicine → Econ → Sci → Architecture → Arts → Engineering. Weekday only." },
  { id: "cu-shuttle-4",      label: "Shuttle Line 4 (Sat ✗)",  swatch: "#FBBF24", group: "mobility",
    describe: "POP Bus Line 4 (yellow): the long faculty loop via Lido + Pharmacy + Education + U-Center + Law. Weekday only." },
  { id: "cu-shuttle-5",      label: "Shuttle Line 5 (Sat ✗)",  swatch: "#A78BFA", group: "mobility",
    describe: "POP Bus Line 5 (purple): CU iHouse ↔ Dhamma ↔ Faculty cluster ↔ Samyan Market ↔ I'm Park ↔ back. Weekday only." },
  { id: "cu-shuttle-stops",  label: "CU Shuttle stops",        swatch: "#FBBF24", group: "mobility",
    describe: "47 named shuttle stops — Sala Phra Kieo, Osot Sala, Triamudom, Samyan Market, BTS National Stadium, etc." },
  { id: "cu-shuttle-vehicles", label: "CU Shuttle — live",     swatch: "#22D3EE", group: "mobility",
    describe: "Live shuttle vehicle positions. Currently scenario data; the API tries the CU IT realtime endpoint first when a token is available." },
  { id: "transit-stations",  label: "BTS / MRT stations",      swatch: "#38BDF8", group: "mobility",
    describe: "15 nearby rail stations: BTS National Stadium, Siam, Ratchadamri; MRT Sam Yan, Hua Lamphong, Si Lom, Wat Mangkon. Walking distance to campus gates." },
  { id: "transit-lines",     label: "BTS / MRT lines",         swatch: "#057B43", group: "mobility",
    describe: "Polyline tracks for BTS Sukhumvit + Silom, MRT Blue, and the Gold APM around the campus. Coloured per system per Bangkok's official line palette." },
  { id: "road-network",      label: "Road network (classified)", swatch: "#FB7185", group: "mobility",
    describe: "OSM road network coloured + scaled by class: motorway/primary thick warm, secondary/tertiary medium cyan, residential/lane thin neutral. Drives orientation around the campus." },
  { id: "campus-gates",      label: "Campus gates / entrances", swatch: "#FBBF24", group: "campus",
    describe: "Every gate and entrance on the campus perimeter. Named ones — ประตูพญาไท 1/2/3, อังรีดูนังต์ 1/2, ประตูดำ — render larger; minor gates smaller." },
  { id: "neighborhood-buildings", label: "Skyline (≥30 m around)", swatch: "#7DD3FC", group: "campus",
    describe: "461 tall buildings (≥30 m) in Pathumwan / Silom / Ratchaprasong. Renders flat in 2D, extrudes in 3D so you can read the campus's place in the Bangkok skyline." },
  { id: "cctv-cameras",      label: "CCTV cameras",            swatch: "#E5E7EB", group: "mobility",
    describe: "Public traffic cameras from Longdo (BMA + other operators) inside the campus bbox. Click for the live JPG/HLS stream." },
  // Incidents
  { id: "incidents-itic",    label: "iTIC traffic events",     swatch: "#F59E0B", group: "incidents",
    describe: "Live iTIC / Longdo traffic events: accidents, closures, breakdowns, construction. Filtered to campus bbox." },
  { id: "incidents-city-reports", label: "City Reporter / Traffy", swatch: "#A78BFA", group: "incidents",
    describe: "Live citizen complaints from Traffy Fondue (BMA's 311 channel): road damage, lighting, drainage, waste, etc. Bbox-filtered." },
  // Imagery (city-scale)
  { id: "satellite-esri",    label: "Satellite (Esri HD)",      swatch: "#60A5FA", group: "imagery",
    describe: "Esri World Imagery — high-res aerial / satellite mosaic. Good detail up to zoom 19. The default 'real world' view." },
  { id: "satellite-terrain", label: "OpenTopoMap (zoom < 14)",  swatch: "#A3E635", group: "imagery",
    describe: "OpenTopoMap with contour lines and hillshade. Useful at regional zoom (auto-hidden ≥ 14 where its contours fight building outlines)." },
  // Imagery (regional / sexy)
  { id: "satellite-viirs-truecolor", label: "VIIRS true-color (sharper)", swatch: "#A5F3FC", group: "imagery",
    describe: "VIIRS NOAA-20 corrected reflectance — newer + sharper than MODIS, daily. Beautiful clouds + city outlines at regional zoom." },
  { id: "satellite-night",   label: "VIIRS night lights",          swatch: "#FACC15", group: "imagery",
    describe: "VIIRS Day/Night Band — Earth at night. Bangkok shows up as a glittering golden constellation against the Gulf. Best at zoom < 10." },
  { id: "satellite-true-color", label: "MODIS true-color (regional)", swatch: "#93C5FD", group: "imagery",
    describe: "MODIS Terra corrected reflectance — daily 250 m global mosaic. Auto-hidden at zoom ≥ 10 where it smears." },
  { id: "satellite-himawari", label: "Himawari IR (regional)",   swatch: "#C7D2FE", group: "imagery",
    describe: "Himawari-9 Band 13 infrared — geostationary cloud loop refreshed every 10 min. Best for catching incoming storm fronts. Regional zoom only." },
  { id: "satellite-imerg",   label: "IMERG rainfall (live)",       swatch: "#06B6D4", group: "imagery",
    describe: "NASA IMERG global precipitation rate — half-hourly, color-coded rainfall intensity. Watch monsoon cells move across the Gulf of Thailand." },
  { id: "satellite-ndvi",    label: "NDVI greenery (regional)", swatch: "#34D399", group: "imagery",
    describe: "MODIS NDVI 8-day composite — vegetation greenness. Useful for tracking campus + park canopy over time. Regional zoom." },
  { id: "satellite-lst",     label: "Land surface temp (regional)", swatch: "#F97316", group: "imagery",
    describe: "MODIS Land Surface Temperature (day) — shows urban heat islands. Bangkok core typically reads 4–7 °C hotter than surrounding fields." },
  { id: "satellite-aerosol", label: "Aerosol optical depth",       swatch: "#F472B6", group: "imagery",
    describe: "MODIS MAIAC AOD — direct satellite proxy for PM2.5 + smoke / haze layers. Lights up Bangkok during burning season + dust events." },
  { id: "satellite-no2",     label: "NO₂ pollution (OMI)",         swatch: "#EF4444", group: "imagery",
    describe: "OMI tropospheric NO₂ — atmospheric nitrogen dioxide from traffic + power plants. Traffic corridors light up over Bangkok arterials." },
  { id: "satellite-flood",   label: "Flood detection (regional)",   swatch: "#38BDF8", group: "imagery",
    describe: "MODIS 3-day combined flood detection — water surfaces flagged by satellite. Critical during monsoon flooding of Klong Saen Saep system." },
  // Environment / Risk
  { id: "bangkok-districts", label: "Bangkok district lines",      swatch: "#FFFFFF", group: "environment",
    describe: "Approximate boundaries of Bangkok districts around campus: Pathum Wan, Bang Rak, Sathon, Ratchathewi, Khlong Toei, Watthana." },
  { id: "flood-prone-areas", label: "Flood-prone areas (historical)", swatch: "#EF4444", group: "environment",
    describe: "Historical flood-prone zones around campus based on known Bangkok flood patterns: Saen Saep overflow, Samyan intersection, Rama IV underpasses, Hua Lamphong basin." },
  // Underground utilities (electricity / water / drainage) + WiFi survey
  { id: "utility-electricity", label: "Electricity (MEA · approx)", swatch: "#F59E0B", group: "utility",
    describe: "REAL: Pathumwan + Samyan substations from the CU-MEA agreement, plus solar PV cluster nodes (20 MW microgrid target) + BESS. APPROX: HV 115 kV and MV 22 kV feeders following the road network." },
  { id: "utility-water",     label: "Water mains (MWA · approx)",   swatch: "#38BDF8", group: "utility",
    describe: "Approximated MWA potable supply: 400 mm perimeter loop + 200/250/300 mm laterals. Drops to PMCU as-built when supplied." },
  { id: "utility-drainage",  label: "Storm drainage (approx)",      swatch: "#10B981", group: "utility",
    describe: "Storm collectors routed by the real Centenary Park retention basin (3,785 m³, 3° gradient, Landprocess 2017). Overflow → BMA mains under Rama IV." },
  { id: "utility-wifi-heat", label: "WiFi heatmap (Mbps)",          swatch: "#22D3EE", group: "utility",
    describe: "Mbps-weighted heatmap across 15 ChulaWiFi-2 survey points. Green = fast, red = slow." },
  { id: "utility-wifi-points", label: "WiFi survey points",         swatch: "#22D3EE", group: "utility",
    describe: "Per-faculty WiFi sample points (baseline + browser-timed). Click for Mbps + RTT." },
  // Campus expanded
  { id: "surrounding-buildings", label: "Surrounding buildings (1km)", swatch: "#7C8DB0", group: "campus",
    describe: "58 major building footprints within ~1.5 km of campus (Siam Paragon, Central World, Samyan Mitrtown, State Tower, etc.). Heights estimated from Google Earth shadow analysis." },
];
