/**
 * CTM-01 · Chonburi Control Tower — Google Sheets Live Data Feed
 * ─────────────────────────────────────────────────────────────
 * SETUP (one-time, ~2 minutes):
 *
 *   1. Open Google Sheets → sheets.new
 *   2. Rename the file: "CTM-01 · Chonburi Town Center · EarthAlpha + Live Data"
 *   3. Menu → Extensions → Apps Script
 *   4. Delete the default code, paste THIS entire file, save
 *   5. Click ▷ Run → select "setup" → authorize when prompted
 *   6. That's it. All tabs are created automatically.
 *   7. Copy the Sheets URL and paste it into the dashboard SHEETS button.
 *
 * Refresh cadence:
 *   • Live feeds (Weather, AQ, News, Markets, Executive, …) auto-refresh
 *     every 5 minutes via a time-based trigger.
 *   • Static reference tabs (buildings, roads, waterways, fisheries,
 *     flood-risk areas, ports, piers, navigation aids) are pulled once at
 *     setup, re-pullable via the CTM-01 menu → "Refresh static data".
 *   • EarthAlphaObservations is a typed collection sheet for this area:
 *     operators can validate satellite/GISTDA observations, add field notes,
 *     and mark which map layers or municipal actions are affected.
 *
 * Data source: https://chonburi-api.nonarkara.org
 * Dashboard:   https://chonburi.nonarkara.org
 */

var API = "https://chonburi-api.nonarkara.org";
var WEB = "https://chonburi.nonarkara.org";

var HEADER_BG = "#0f0f1a";
var HEADER_COLOR = "#e83898";
var PENDING_BG = "#1c1c2e";
var PENDING_COLOR = "#fbbf24";

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

// ── HTTP helper ───────────────────────────────────────────────────────
function get(path) {
  var opts = { muteHttpExceptions: true, followRedirects: true };
  var res = UrlFetchApp.fetch(API + path, opts);
  if (res.getResponseCode() !== 200) {
    throw new Error("HTTP " + res.getResponseCode() + " from " + path);
  }
  return JSON.parse(res.getContentText());
}

function getStaticGeo(path) {
  var opts = { muteHttpExceptions: true, followRedirects: true };
  var res = UrlFetchApp.fetch(WEB + path, opts);
  if (res.getResponseCode() !== 200) {
    throw new Error("HTTP " + res.getResponseCode() + " from " + path);
  }
  return JSON.parse(res.getContentText());
}

// ── Sheet helpers ─────────────────────────────────────────────────────
function writeHeader(sh, headers) {
  var r = sh.getRange(1, 1, 1, headers.length);
  r.setValues([headers]);
  r.setFontWeight("bold");
  r.setBackground(HEADER_BG);
  r.setFontColor(HEADER_COLOR);
  sh.setFrozenRows(1);
}

function clearAndWrite(sh, headers, rows) {
  sh.clearContents();
  writeHeader(sh, headers);
  if (rows.length) {
    sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function val(v) {
  return v == null ? "—" : v;
}

// ── LIVE adapters — refreshed every 5 min ─────────────────────────────

function refreshWeather(ts) {
  var d = get("/api/weather");
  var w = (d.features && d.features[0]) || d.weather || {};
  var tier = (d.meta && d.meta.fallbackTier) || "—";
  clearAndWrite(getSheet("Weather"),
    ["Fetched At", "Observed At", "Temp °C", "Feels Like °C", "Humidity %", "Wind km/h",
     "Precip mm", "Condition", "Tier"],
    [[ts, val(w.observedAt), val(w.tempC), val(w.feelsLikeC), val(w.humidity),
       val(w.windKmh), val(w.precipMm), val(w.condition), tier]]
  );
  return "1 row";
}

function refreshAirQuality(ts) {
  var d = get("/api/air-quality");
  var pts = d.features || [];
  var rows = pts.map(function(p) {
    return [ts, val(p.observedAt), val(p.station), val(p.aqi), val(p.pm25),
            val(p.category), val(p.lat), val(p.lng), val(p.source)];
  });
  clearAndWrite(getSheet("AirQuality"),
    ["Fetched At", "Observed At", "Station", "AQI (US)", "PM2.5 µg/m³",
     "Category", "Lat", "Lng", "Source"],
    rows.length ? rows : [[ts, "—", "(no station data)", "—", "—", "—", "—", "—", "—"]]
  );
  return rows.length + " stations";
}

function refreshAqTrend(ts) {
  var d = get("/api/air-quality/trend");
  var rows = [];
  (d.features || []).forEach(function(stn) {
    var name = stn.station || "—";
    var current = stn.current || {};
    var forecast = stn.next8h || [];
    rows.push([ts, name, "now", val(current.observedAt), val(current.aqi), val(current.pm25), val(stn.category), val(stn.source)]);
    forecast.forEach(function(f) {
      rows.push([ts, name, "forecast", f.at, val(f.aqi), val(f.pm25), "—", val(stn.source)]);
    });
  });
  clearAndWrite(getSheet("AqiTrend"),
    ["Fetched At", "Station", "Kind", "At", "AQI", "PM2.5", "Category", "Source"],
    rows.length ? rows : [[ts, "(no trend data)", "—", "—", "—", "—", "—", "—"]]
  );
  return rows.length + " hourly points";
}

function refreshIncidents(ts) {
  var cr = get("/api/incidents/city-reports");
  var itic = get("/api/incidents/itic");

  function toRow(src) {
    return function(p) {
      return [ts, src, val(p.category), val(p.severity), val(p.status),
              val(p.title), (p.description || "").slice(0, 300),
              val(p.lat), val(p.lng), val(p.reportedAt), val(p.reporterPlatform)];
    };
  }

  var rows = (cr.features || []).map(toRow("City Reporter"))
    .concat((itic.features || []).map(toRow("iTIC/Longdo")));

  clearAndWrite(getSheet("Incidents"),
    ["Fetched At", "Source", "Category", "Severity", "Status", "Title", "Description", "Lat", "Lng", "Reported At", "Platform"],
    rows.length ? rows : [[ts, "(none)", "—", "—", "—", "No open incidents near Chonburi", "—", "—", "—", "—", "—"]]
  );
  return rows.length + " events";
}

function refreshNews(ts) {
  var d = get("/api/news");
  var rows = (d.features || []).slice(0, 80).map(function(item) {
    return [ts, val(item.publishedAt),
            (item.title || "").slice(0, 250),
            val(item.source), val(item.sourceUrl), val(item.score)];
  });
  clearAndWrite(getSheet("News"),
    ["Fetched At", "Published At", "Headline", "Source", "URL", "Score"],
    rows.length ? rows : [[ts, "—", "(no news)", "—", "—", "—"]]
  );
  return rows.length + " headlines";
}

// PR-facing rolling archive — every unique Chonburi-related story this server
// has ever seen, newest first. Capped at 1000 to keep the sheet responsive;
// the canonical store is /api/news/archive on the API.
function refreshNewsArchive(ts) {
  var d = get("/api/news/archive?limit=1000");
  var rows = (d.records || []).map(function(r) {
    return [ts, val(r.firstSeenAt), val(r.publishedAt),
            val(r.language), (r.title || "").slice(0, 280),
            val(r.source), val(r.url), val(r.score)];
  });
  clearAndWrite(getSheet("NewsArchive"),
    ["Fetched At", "First Seen", "Published At", "Lang",
     "Headline", "Source", "URL", "Score"],
    rows.length ? rows : [[ts, "—", "—", "—", "(archive empty — building)", "—", "—", "—"]]
  );
  return rows.length + " archived";
}

function refreshNewsDigest(ts) {
  var d = get("/api/news/digest?period=7d");
  var rows = [];
  rows.push([ts, "period", "Window", d.period, d.windowStart]);
  rows.push([ts, "totals", "Archive total", d.totalArchived, "all-time"]);
  rows.push([ts, "totals", "In window", d.totalInWindow, "last " + d.period]);
  (d.bySource || []).forEach(function(s) {
    rows.push([ts, "by-source", s.source, s.count, ""]);
  });
  (d.byLanguage || []).forEach(function(l) {
    rows.push([ts, "by-language", l.language, l.count, ""]);
  });
  (d.byDay || []).forEach(function(day) {
    rows.push([ts, "by-day", day.day, day.count, ""]);
  });
  (d.topHeadlines || []).forEach(function(h) {
    rows.push([ts, "top-headline", h.source, (h.title || "").slice(0, 200), h.url]);
  });
  clearAndWrite(getSheet("NewsDigest"),
    ["Fetched At", "Section", "Key", "Value", "Detail"],
    rows.length ? rows : [[ts, "—", "—", "(digest empty)", "—"]]
  );
  return rows.length + " digest rows";
}

function refreshTrends(ts) {
  var d = get("/api/trends");
  var rows = [];
  (d.features || []).forEach(function(s) {
    (s.interestOverTime || []).forEach(function(pt) {
      rows.push([ts, val(s.lang), val(s.keyword), val(s.geo || "TH"), "interest", val(pt.time), val(pt.value), "—"]);
    });
    (s.relatedTop || []).forEach(function(q) {
      rows.push([ts, val(s.lang), val(s.keyword), val(s.geo || "TH"), "related-top", val(q.query), val(q.value), val(q.link)]);
    });
    (s.relatedRising || []).forEach(function(q) {
      rows.push([ts, val(s.lang), val(s.keyword), val(s.geo || "TH"), "related-rising", val(q.query), val(q.value), val(q.link)]);
    });
  });
  clearAndWrite(getSheet("Trends"),
    ["Fetched At", "Lang", "Keyword", "Geo", "Kind", "Time / Query", "Score", "Link"],
    rows.length ? rows : [[ts, "—", "Chonburi EEC", "TH", "—", "—", "—", "—"]]
  );
  return rows.length + " keywords";
}

function refreshMarkets(ts) {
  var d = get("/api/markets");
  var snap = (d.features && d.features[0]) || {};
  var ticks = snap.ticks || [];
  var thb = snap.thb || [];
  var rows = ticks.map(function(t) {
    return [ts, val(t.symbol), val(t.name), val(t.group),
            val(t.value), val(t.changePct), val(t.asOf)];
  });
  thb.forEach(function(p) {
    rows.push([ts, "THB/" + p.vs, "THB per " + p.vs, "forex",
               val(p.rate), "—", ts]);
  });
  clearAndWrite(getSheet("Markets"),
    ["Fetched At", "Symbol", "Name", "Group", "Value", "Change %", "As Of"],
    rows.length ? rows : [[ts, "—", "(no market data)", "—", "—", "—", "—"]]
  );
  return rows.length + " ticks";
}

function refreshExecutive(ts) {
  var d = get("/api/executive");
  var ex = (d.features && d.features[0]) || {};
  var rows = [];
  // Rankings
  (ex.rankings || []).forEach(function(r) {
    rows.push([ts, "rankings", r.system, r.label,
               r.year + " · #" + r.rank + " / " + r.total + " (" + r.trend + ")"]);
  });
  // Enrollment
  if (ex.enrollment) {
    var e = ex.enrollment;
    rows.push([ts, "population", "total", "Municipal population estimate", e.total]);
    rows.push([ts, "population", "registeredHouseholds", "Registered households", e.undergraduate || "—"]);
    rows.push([ts, "population", "workers", "Worker / visitor load", e.graduate || "—"]);
    rows.push([ts, "population", "visitors", "Visitor share", e.international + " (" + e.internationalPct + "%)"]);
    rows.push([ts, "population", "districts", "Municipal districts / zones", e.faculties || "—"]);
    rows.push([ts, "population", "ratio", "Service load ratio", e.studentFacultyRatio]);
  }
  // Research
  if (ex.research) {
    var r = ex.research;
    rows.push([ts, "planning", "reports", "Planning / municipal reports", r.publications2024]);
    rows.push([ts, "planning", "citations", "Referenced datasets", r.citations2024]);
    rows.push([ts, "planning", "hIndex", "Evidence index", r.hIndex]);
    rows.push([ts, "planning", "topFields", "Focus areas", (r.topFields || []).join(", ")]);
    rows.push([ts, "planning", "fundingMThb", "Project funding M฿", r.researchFundingMThb]);
    rows.push([ts, "planning", "patents", "Innovation filings", r.patentsFiled]);
  }
  // Finance
  if (ex.finance) {
    var f = ex.finance;
    rows.push([ts, "finance", "budget", "Annual budget B฿", f.annualBudgetBThb]);
    rows.push([ts, "finance", "grants", "Research grants M฿", f.researchGrantsMThb]);
    rows.push([ts, "finance", "endowment", "Endowment B฿", f.endowmentBThb]);
    if (f.note) rows.push([ts, "finance", "note", "", f.note]);
  }
  // Initiatives
  (ex.initiatives || []).forEach(function(i) {
    rows.push([ts, "initiative", i.id, i.name,
               i.status + " · " + i.progressPct + "% · owner: " + i.owner + " · due " + i.deadline]);
  });
  // Peers
  (ex.peers || []).forEach(function(p) {
    rows.push([ts, "peer", p.name, p.country,
               "population/context " + p.studentsTotal]);
  });
  // Alerts
  (ex.alerts || []).forEach(function(a) {
    rows.push([ts, "alert", a.level + "/" + a.category, a.title,
               a.message + " (issued " + a.issuedAt + ", src: " + a.source + ")"]);
  });
  clearAndWrite(getSheet("Executive"),
    ["Fetched At", "Section", "Key", "Label", "Value"],
    rows.length ? rows : [[ts, "—", "—", "(no exec data)", "—"]]
  );
  return rows.length + " rows";
}

function refreshCctv(ts) {
  var d = get("/api/cctv/longdo");
  var rows = (d.features || []).map(function(p) {
    return [ts, val(p.id), val(p.name), val(p.vendor),
            val(p.lat), val(p.lng), val(p.imageUrl || p.streamUrl)];
  });
  clearAndWrite(getSheet("CCTV"),
    ["Fetched At", "ID", "Name", "Vendor", "Lat", "Lng", "Stream URL"],
    rows.length ? rows : [[ts, "—", "(no cameras)", "—", "—", "—", "—"]]
  );
  return rows.length + " cameras";
}

function refreshPrecipNowcast(ts) {
  var d = get("/api/precip-nowcast");
  var p = (d.features && d.features[0]) || {};
  var rows = [[ts, "summary", "now", val(p.nowMm), val(p.total2hMm), val(p.peakMm), val(p.peakAt), val(p.firstSignificantAt), val(p.intensity)]];
  (p.points || []).forEach(function(pt) {
    rows.push([ts, "point", val(pt.at), val(pt.mm), "—", "—", "—", "—", val(pt.prob)]);
  });
  clearAndWrite(getSheet("PrecipNowcast"),
    ["Fetched At", "Kind", "At", "mm", "Total 2h mm", "Peak mm", "Peak At", "First Significant At", "Intensity / Probability"],
    rows
  );
  return rows.length + " nowcast rows";
}

function refreshMarine(ts) {
  var d = get("/api/marine");
  var m = (d.features && d.features[0]) || {};
  var rows = [[ts, "current", val(m.observedAt), val(m.waveHeightM), val(m.waveDirectionDeg), val(m.wavePeriodS),
               val(m.windKmh), val(m.windGustsKmh), val(m.sstC), val(m.currentKmh),
               val(m.smallBoatSafe), val(m.fishingTrawlerSafe), val(m.ferrySafe), val(m.thermalStress), val(m.surgePeakNext24hM)]];
  (m.next24h || []).forEach(function(pt) {
    rows.push([ts, "forecast", val(pt.at), val(pt.waveHeightM), "—", "—",
               val(pt.windKmh), "—", val(pt.sstC), "—", "—", "—", "—", "—", "—"]);
  });
  clearAndWrite(getSheet("Marine"),
    ["Fetched At", "Kind", "Observed/Forecast At", "Wave m", "Wave Deg", "Wave Period s",
     "Wind km/h", "Gust km/h", "SST °C", "Current km/h", "Small Boat Safe",
     "Fishing Safe", "Ferry Safe", "Thermal Stress", "Surge Peak 24h m"],
    rows
  );
  return rows.length + " marine rows";
}

function refreshTides(ts) {
  var d = get("/api/tides");
  var t = (d.features && d.features[0]) || {};
  var rows = [[ts, "current", val(t.observedAt), val(t.heightM), val(t.rising),
               val(t.springNeap), val(t.springTide), val(t.moonPhaseName), val(t.chartDatumNote)]];
  if (t.nextHigh) rows.push([ts, "next-high", val(t.nextHigh.at), val(t.nextHigh.heightM), "—", "—", "—", "—", "—"]);
  if (t.nextLow) rows.push([ts, "next-low", val(t.nextLow.at), val(t.nextLow.heightM), "—", "—", "—", "—", "—"]);
  (t.next24h || []).slice(0, 144).forEach(function(pt) {
    rows.push([ts, "forecast", val(pt.at), val(pt.heightM), "—", "—", "—", "—", "—"]);
  });
  clearAndWrite(getSheet("Tides"),
    ["Fetched At", "Kind", "At", "Height m", "Rising", "Spring/Neap", "Spring Tide", "Moon Phase", "Datum Note"],
    rows
  );
  return rows.length + " tide rows";
}

function refreshAis(ts) {
  var d = get("/api/maritime/ais");
  var rows = (d.features || []).map(function(v) {
    return [ts, val(v.mmsi), val(v.name), val(v.type), val(v.lat), val(v.lng),
            val(v.speed), val(v.course), val(v.flag), val(v.lastUpdate)];
  });
  clearAndWrite(getSheet("AIS"),
    ["Fetched At", "MMSI", "Name", "Type", "Lat", "Lng", "Speed kn", "Course", "Flag", "Updated At"],
    rows.length ? rows : [[ts, "—", "(no AIS vessels)", "—", "—", "—", "—", "—", "—", "—"]]
  );
  return rows.length + " vessels";
}

function refreshDatagoPoints(ts) {
  var d = get("/api/datago/points");
  var rows = (d.features || []).map(function(p) {
    return [ts, val(p.id), val(p.category), val(p.name), val(p.nameEn),
            val(p.lat), val(p.lng), val(p.source), val(p.attribution)];
  });
  clearAndWrite(getSheet("DatagoPoints"),
    ["Fetched At", "ID", "Category", "Name (TH)", "Name (EN)", "Lat", "Lng", "Source", "Attribution"],
    rows.length ? rows : [[ts, "—", "(no points)", "—", "—", "—", "—", "—", "—"]]
  );
  return rows.length + " points";
}

function refreshGistdaPoi(ts) {
  var d = get("/api/gistda/poi");
  var rows = (d.features || []).map(function(p) {
    return [ts, val(p.id), val(p.category), val(p.subcat), val(p.name), val(p.nameEn),
            val(p.road), val(p.roadEn), val(p.lat), val(p.lng), val(p.disabled)];
  });
  clearAndWrite(getSheet("GISTDA_POI"),
    ["Fetched At", "ID", "Category", "Subcategory", "Name (TH)", "Name (EN)", "Road (TH)", "Road (EN)", "Lat", "Lng", "Disabled Access"],
    rows.length ? rows : [[ts, "—", "(no GISTDA POIs)", "—", "—", "—", "—", "—", "—", "—", "—"]]
  );
  return rows.length + " POIs";
}

function refreshGistdaSolar(ts) {
  var d = get("/api/gistda/solar");
  var rows = (d.features || []).map(function(b) {
    return [ts, val(b.id), val(b.month), val(b.monthNum), val(b.solarIrr),
            val(b.height), val(b.area), val(b.roofType), val(b.buildType), val(b.lat), val(b.lng)];
  });
  clearAndWrite(getSheet("GISTDA_Solar"),
    ["Fetched At", "ID", "Month", "Month No", "Solar kWh/m²", "Height m", "Area m²", "Roof Type", "Building Type", "Lat", "Lng"],
    rows.length ? rows : [[ts, "—", "(no GISTDA solar buildings)", "—", "—", "—", "—", "—", "—", "—", "—"]]
  );
  return rows.length + " solar roofs";
}

function refreshGistdaLandUse(ts) {
  var d = get("/api/gistda/landuse");
  var rows = (d.features || []).map(function(p) {
    return [ts, val(p.id), val(p.code), val(p.name), val(p.nameEn), val(p.area), val(p.lat), val(p.lng)];
  });
  clearAndWrite(getSheet("GISTDA_LandUse"),
    ["Fetched At", "ID", "Code", "Name (TH)", "Name (EN)", "Area m²", "Lat", "Lng"],
    rows.length ? rows : [[ts, "—", "(no land use parcels)", "—", "—", "—", "—", "—"]]
  );
  return rows.length + " parcels";
}

// ── STATIC adapters — pulled once at setup, refreshable via menu ──────

function flattenCoords(coords, out) {
  if (!coords) return out;
  if (typeof coords[0] === "number" && typeof coords[1] === "number") {
    out.push(coords);
    return out;
  }
  coords.forEach(function(c) { flattenCoords(c, out); });
  return out;
}

function featureCenter(f) {
  var pts = flattenCoords(f.geometry && f.geometry.coordinates, []);
  if (!pts.length) return ["—", "—"];
  var lng = 0, lat = 0;
  pts.forEach(function(p) { lng += Number(p[0]); lat += Number(p[1]); });
  return [lat / pts.length, lng / pts.length];
}

function refreshStaticBuildings(ts) {
  var d = getStaticGeo("/geo/chonburi-buildings.geojson");
  var rows = (d.features || []).map(function(f) {
    var p = f.properties || {};
    var c = featureCenter(f);
    return [ts, val(p.osmId || p.id), val(p.nameEn || p.name || p.nameTh), val(p.kind || p.type),
            val(p.height), val(p.levels), c[0], c[1]];
  });
  clearAndWrite(getSheet("Buildings"),
    ["Fetched At", "ID", "Name", "Kind", "Height m", "Levels", "Centroid Lat", "Centroid Lng"],
    rows
  );
  return rows.length + " buildings";
}

function refreshStaticRoads(ts) {
  var d = getStaticGeo("/geo/chonburi-roads.geojson");
  var rows = (d.features || []).map(function(f) {
    var p = f.properties || {};
    var c = featureCenter(f);
    return [ts, val(p.id || p.osm_id), val(p.name || p["name:en"] || p["name:th"]),
            val(p.highway || p.class), val(p.oneway), c[0], c[1]];
  });
  clearAndWrite(getSheet("Roads"),
    ["Fetched At", "ID", "Name", "Class", "Oneway", "Center Lat", "Center Lng"],
    rows
  );
  return rows.length + " road segments";
}

function refreshStaticCivic(ts) {
  var d = getStaticGeo("/geo/chonburi-civic.geojson");
  var rows = (d.features || []).map(function(f) {
    var p = f.properties || {};
    var c = featureCenter(f);
    return [ts, val(p.id || p.osm_id), val(p.kind || p.amenity || p.office),
            val(p.name || p["name:en"] || p["name:th"]), val(p.operator), c[0], c[1]];
  });
  clearAndWrite(getSheet("CivicPOIs"),
    ["Fetched At", "ID", "Kind", "Name", "Operator", "Lat", "Lng"],
    rows
  );
  return rows.length + " civic POIs";
}

function refreshStaticWaterways(ts) {
  var d = getStaticGeo("/geo/chonburi-waterways.geojson");
  var rows = (d.features || []).map(function(f) {
    var p = f.properties || {};
    var c = featureCenter(f);
    return [ts, val(p.id || p.osm_id), val(p.waterway), val(p.name || p["name:en"] || p["name:th"]),
            val(p.intermittent), c[0], c[1]];
  });
  clearAndWrite(getSheet("Waterways"),
    ["Fetched At", "ID", "Waterway", "Name", "Intermittent", "Center Lat", "Center Lng"],
    rows
  );
  return rows.length + " waterways";
}

function refreshStaticFisheries(ts) {
  var d = getStaticGeo("/geo/chonburi-fisheries.geojson");
  var rows = (d.features || []).map(function(f) {
    var p = f.properties || {};
    var c = featureCenter(f);
    return [ts, val(p.id), val(p.name), val(p.kind), val(p.boats), val(p.yearly_yield_t), c[0], c[1]];
  });
  clearAndWrite(getSheet("Fisheries"),
    ["Fetched At", "ID", "Name", "Kind", "Boats", "Yield t/yr", "Center Lat", "Center Lng"],
    rows
  );
  return rows.length + " fishery zones";
}

function refreshStaticFloodRisk(ts) {
  var d = getStaticGeo("/geo/chonburi-flood-risk.geojson");
  var rows = (d.features || []).map(function(f) {
    var p = f.properties || {};
    var c = featureCenter(f);
    return [ts, val(p.id), val(p.name), val(p.severity), val(p.type), val(p.households), c[0], c[1]];
  });
  clearAndWrite(getSheet("FloodRisk"),
    ["Fetched At", "ID", "Name", "Severity", "Type", "Households", "Center Lat", "Center Lng"],
    rows
  );
  return rows.length + " flood-risk zones";
}

function refreshStaticPorts(ts) {
  var d = getStaticGeo("/geo/chonburi-ports.geojson");
  var rows = (d.features || []).map(function(f) {
    var p = f.properties || {};
    var c = featureCenter(f);
    return [ts, val(p.id || p.osm_id), val(p.name || p["name:en"] || p["name:th"]),
            val(p.harbour || p.man_made || p.landuse), c[0], c[1]];
  });
  clearAndWrite(getSheet("Ports"),
    ["Fetched At", "ID", "Name", "Kind", "Center Lat", "Center Lng"],
    rows
  );
  return rows.length + " port features";
}

function refreshStaticFerries(ts) {
  var d = getStaticGeo("/geo/chonburi-ferries.geojson");
  var rows = (d.features || []).map(function(f) {
    var p = f.properties || {};
    var c = featureCenter(f);
    return [ts, val(p.id || p.osm_id), val(p.name || p["name:en"] || p["name:th"]), val(p.amenity || p.ferry), c[0], c[1]];
  });
  clearAndWrite(getSheet("Ferries"),
    ["Fetched At", "ID", "Name", "Kind", "Lat", "Lng"],
    rows
  );
  return rows.length + " ferry points";
}

function refreshStaticNavigationAids(ts) {
  var d = getStaticGeo("/geo/chonburi-nav-aids.geojson");
  var rows = (d.features || []).map(function(f) {
    var p = f.properties || {};
    var c = featureCenter(f);
    return [ts, val(p.id || p.osm_id), val(p.name || p["name:en"] || p["name:th"]), val(p["seamark:type"] || p.man_made), c[0], c[1]];
  });
  clearAndWrite(getSheet("NavigationAids"),
    ["Fetched At", "ID", "Name", "Kind", "Lat", "Lng"],
    rows
  );
  return rows.length + " navigation aids";
}

function refreshSatelliteCatalog(ts) {
  var rows = [
    [ts, "Esri HD", "satellite-esri", "high-res city context", "mosaic", "basemap"],
    [ts, "VIIRS true-color", "satellite-viirs-truecolor", "daily regional true color", "24h", "imagery"],
    [ts, "MODIS true-color", "satellite-true-color", "daily wide-area context", "24h", "imagery"],
    [ts, "VIIRS night lights", "satellite-night", "urban extent and fishing fleet lights", "24h", "activity"],
    [ts, "IMERG rainfall", "satellite-imerg", "monsoon cells and runoff timing", "6h", "flood"],
    [ts, "Himawari IR", "satellite-himawari", "storm-front approach over Gulf", "10min", "weather"],
    [ts, "NDVI", "satellite-ndvi", "green cover and crop/aquaculture context", "8d", "vegetation"],
    [ts, "Land surface temp", "satellite-lst", "urban heat island", "24h", "heat"],
    [ts, "Aerosol optical depth", "satellite-aerosol", "haze and industrial plume proxy", "24h", "air"],
    [ts, "NO2", "satellite-no2", "traffic and power-plant pollution proxy", "24h", "air"],
    [ts, "MODIS flood", "satellite-flood", "post-rain flooded-surface detection", "3d", "flood"],
  ];
  clearAndWrite(getSheet("SatelliteCatalog"),
    ["Fetched At", "Layer", "Layer ID", "Use", "Typical Delay", "Decision Domain"],
    rows
  );
  return rows.length + " satellite layers";
}

// ── Adapter registry ──────────────────────────────────────────────────

var LIVE_ADAPTERS = [
  ["weather",         refreshWeather],
  ["precip-nowcast",  refreshPrecipNowcast],
  ["airquality",      refreshAirQuality],
  ["aqi-trend",       refreshAqTrend],
  ["incidents",       refreshIncidents],
  ["news",            refreshNews],
  ["news-archive",    refreshNewsArchive],
  ["news-digest",     refreshNewsDigest],
  ["marine",          refreshMarine],
  ["tides",           refreshTides],
  ["ais",             refreshAis],
  ["datago-points",   refreshDatagoPoints],
  ["gistda-poi",      refreshGistdaPoi],
  ["gistda-solar",    refreshGistdaSolar],
  ["gistda-landuse",  refreshGistdaLandUse],
  ["trends",          refreshTrends],
  ["markets",         refreshMarkets],
  ["executive",       refreshExecutive],
  ["cctv",            refreshCctv],
];

var STATIC_ADAPTERS = [
  ["buildings",        refreshStaticBuildings],
  ["roads",            refreshStaticRoads],
  ["civic-pois",       refreshStaticCivic],
  ["waterways",        refreshStaticWaterways],
  ["fisheries",        refreshStaticFisheries],
  ["flood-risk",       refreshStaticFloodRisk],
  ["ports",            refreshStaticPorts],
  ["ferries",          refreshStaticFerries],
  ["navigation-aids",  refreshStaticNavigationAids],
  ["satellite-catalog",refreshSatelliteCatalog],
];

// ── Placeholder tabs for future official municipal pipelines ─────────
// Each entry creates a tab with a typed header row. The first data row is
// stamped with PENDING_PIPELINE + the contact for the upstream data owner,
// so when the pipeline is connected the operator knows exactly which
// office, file format, and refresh cadence to wire up.

var PLACEHOLDER_TABS = [
  {
    name: "EarthAlphaObservations",
    owner: "Municipal GIS / disaster-prevention desk",
    contact: "cadence: per imagery review or field validation",
    headers: ["Logged At", "Observation ID", "Layer", "Location", "Lat", "Lng", "Signal", "Confidence", "Action Owner", "Status", "Notes"],
  },
  {
    name: "Energy",
    owner: "Municipal engineering / PEA / solar project office",
    contact: "cadence: 15-min meter pull, daily roll-up",
    headers: ["Fetched At", "Asset", "Zone", "kWh (last 15 min)", "kWh (today)",
              "Solar kWh (today)", "BESS SOC %", "Peak kW (today)"],
  },
  {
    name: "Water",
    owner: "Municipal waterworks",
    contact: "cadence: hourly zone meter pull",
    headers: ["Fetched At", "Zone", "m³ (last hour)", "m³ (today)",
              "Pressure bar", "Flow L/min", "Leak Flag"],
  },
  {
    name: "Waste",
    owner: "Municipal sanitation division",
    contact: "cadence: daily pickup logs",
    headers: ["Fetched At", "Route", "Stream", "kg (today)", "kg (week)",
              "Recycled %", "Composted %", "Landfill kg"],
  },
  {
    name: "Access",
    owner: "Municipal facilities / security",
    contact: "cadence: 5-min aggregate",
    headers: ["Fetched At", "Facility", "Gate", "Hour", "Inbound Count", "Outbound Count", "Notes"],
  },
  {
    name: "Library",
    owner: "Municipal library",
    contact: "cadence: hourly or daily",
    headers: ["Fetched At", "Branch", "Entries (today)", "Active users",
              "Loans (today)", "eBook downloads", "Wait list"],
  },
  {
    name: "Parking",
    owner: "Municipal parking operations",
    contact: "cadence: 5-min gate counts",
    headers: ["Fetched At", "Lot", "Capacity", "Occupied", "Available",
              "% Full", "Inflow (last hour)", "Outflow (last hour)"],
  },
  {
    name: "Ridership",
    owner: "Public transport operators",
    contact: "cadence: per-trip aggregate",
    headers: ["Fetched At", "Route", "Trip", "Boardings", "Alightings",
              "Avg Load %", "Run Time (min)", "Headway (min)"],
  },
  {
    name: "Hospital",
    owner: "Chonburi Hospital / public health office",
    contact: "cadence: 15-min queue snapshot",
    headers: ["Fetched At", "Department", "Patients in queue", "Avg wait (min)",
              "ED census", "Beds available", "ICU available"],
  },
  {
    name: "Sustainability",
    owner: "Municipal environment division",
    contact: "cadence: monthly",
    headers: ["Fetched At", "Metric", "Value", "Unit", "Target", "Baseline year",
              "Trend"],
  },
  {
    name: "Projects",
    owner: "Mayor's office / public works",
    contact: "cadence: weekly capital works update",
    headers: ["Fetched At", "Project", "District", "Owner", "Budget THB",
              "Progress %", "Risk", "Due Date"],
  },
];

// ── Refresh entry points ──────────────────────────────────────────────

function refreshAll() {
  var ts = new Date().toISOString();
  var log = [];
  LIVE_ADAPTERS.forEach(function(pair) {
    var name = pair[0], fn = pair[1];
    try {
      var count = fn(ts);
      log.push([ts, name, "OK", count]);
    } catch (e) {
      log.push([ts, name, "ERROR", String(e.message || e).slice(0, 200)]);
    }
  });
  appendLog(log);
}

function refreshStatic() {
  var ts = new Date().toISOString();
  var log = [];
  STATIC_ADAPTERS.forEach(function(pair) {
    var name = pair[0], fn = pair[1];
    try {
      var count = fn(ts);
      log.push([ts, name, "OK (static)", count]);
    } catch (e) {
      log.push([ts, name, "ERROR", String(e.message || e).slice(0, 200)]);
    }
  });
  appendLog(log);
  SpreadsheetApp.getActiveSpreadsheet().toast("Static reference tabs refreshed.", "CTM-01", 6);
}

// ── Log ───────────────────────────────────────────────────────────────

function appendLog(entries) {
  var sh = getSheet("Log");
  if (!sh) return;
  if (sh.getLastRow() === 0) {
    writeHeader(sh, ["Timestamp", "Adapter", "Status", "Detail"]);
  }
  var last = sh.getLastRow();
  if (last > 1000) sh.deleteRows(2, last - 1000);
  if (entries.length) {
    sh.getRange(sh.getLastRow() + 1, 1, entries.length, 4).setValues(entries);
  }
}

// ── Setup ─────────────────────────────────────────────────────────────

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s1 = ss.getSheetByName("Sheet1");
  if (s1) s1.setName("README");

  // Build the full tab list dynamically from the registries above.
  var liveTabNames = LIVE_ADAPTERS.map(function(p) { return adapterTabName(p[0]); });
  var staticTabNames = STATIC_ADAPTERS.map(function(p) { return adapterTabName(p[0]); });
  var placeholderTabNames = PLACEHOLDER_TABS.map(function(t) { return t.name; });
  var allTabs = ["README"]
    .concat(liveTabNames)
    .concat(staticTabNames)
    .concat(placeholderTabNames)
    .concat(["Log"]);
  allTabs.forEach(function(n) {
    if (!ss.getSheetByName(n)) ss.insertSheet(n);
  });

  seedReadme(ss);
  seedPlaceholders();

  // Install 5-minute trigger (replace any existing)
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "refreshAll") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("refreshAll").timeBased().everyMinutes(5).create();

  refreshAll();
  refreshStatic();

  ss.toast(
    "CTM-01 live feed active. Live tabs refresh every 5 min. Static tabs refreshed once; re-pull via CTM-01 menu.",
    "Setup complete ✓", 12
  );
}

function adapterTabName(id) {
  return {
    "weather":          "Weather",
    "precip-nowcast":   "PrecipNowcast",
    "airquality":       "AirQuality",
    "aqi-trend":        "AqiTrend",
    "incidents":        "Incidents",
    "news":             "News",
    "news-archive":     "NewsArchive",
    "news-digest":      "NewsDigest",
    "marine":           "Marine",
    "tides":            "Tides",
    "ais":              "AIS",
    "datago-points":    "DatagoPoints",
    "gistda-poi":       "GISTDA_POI",
    "gistda-solar":     "GISTDA_Solar",
    "gistda-landuse":   "GISTDA_LandUse",
    "trends":           "Trends",
    "markets":          "Markets",
    "executive":        "Executive",
    "cctv":             "CCTV",
    "buildings":        "Buildings",
    "roads":            "Roads",
    "civic-pois":       "CivicPOIs",
    "waterways":        "Waterways",
    "fisheries":        "Fisheries",
    "flood-risk":       "FloodRisk",
    "ports":            "Ports",
    "ferries":          "Ferries",
    "navigation-aids":  "NavigationAids",
    "satellite-catalog":"SatelliteCatalog",
  }[id] || id;
}

function seedReadme(ss) {
  var sh = ss.getSheetByName("README");
  sh.clearContents();
  var meta = [
    ["CTM-01 · Chonburi Control Tower · EarthAlpha + Live Data", ""],
    ["", ""],
    ["Dashboard", WEB],
    ["Data API",  API],
    ["Live refresh",  "Every 5 min (Apps Script time trigger)"],
    ["Static refresh","On setup + via CTM-01 menu → Refresh static data"],
    ["Created",   new Date().toISOString()],
    ["", ""],
    ["Tab", "Source / Contents"],
  ];
  LIVE_ADAPTERS.forEach(function(p) {
    meta.push([adapterTabName(p[0]), "LIVE · /api/" + p[0] + " (every 5 min)"]);
  });
  STATIC_ADAPTERS.forEach(function(p) {
    meta.push([adapterTabName(p[0]), "STATIC · pulled at setup, re-pullable from menu"]);
  });
  meta.push(["", ""]);
  meta.push(["—— Future official municipal pipelines + EarthAlpha observations ——", ""]);
  PLACEHOLDER_TABS.forEach(function(t) {
    meta.push([t.name, "PENDING · " + t.owner + " · " + t.contact]);
  });
  meta.push(["", ""]);
  meta.push(["Log", "Per-refresh status (last 1000 rows)"]);
  sh.getRange(1, 1, meta.length, 2).setValues(meta);
  sh.getRange(1, 1, 1, 2).setFontWeight("bold").setFontSize(14).setBackground(HEADER_BG).setFontColor(HEADER_COLOR);
  // Bold the table-header rows
  sh.getRange(9, 1, 1, 2).setFontWeight("bold").setBackground("#1c1c2e").setFontColor("#9ca3af");
  var sepRow = 9 + LIVE_ADAPTERS.length + STATIC_ADAPTERS.length + 2;
  sh.getRange(sepRow, 1, 1, 2).setFontWeight("bold").setBackground(PENDING_BG).setFontColor(PENDING_COLOR);
  sh.setColumnWidth(1, 220);
  sh.setColumnWidth(2, 620);
}

function seedPlaceholders() {
  PLACEHOLDER_TABS.forEach(function(t) {
    var sh = getSheet(t.name);
    if (!sh) return;
    if (sh.getLastRow() > 1) return; // don't clobber data once a pipeline starts feeding
    sh.clearContents();
    writeHeader(sh, t.headers);
    var row = new Array(t.headers.length);
    row[0] = "PENDING_PIPELINE";
    row[1] = t.owner;
    for (var i = 2; i < t.headers.length; i++) row[i] = "—";
    row[t.headers.length - 1] = t.contact;
    sh.getRange(2, 1, 1, t.headers.length).setValues([row]);
    sh.getRange(2, 1, 1, t.headers.length).setBackground(PENDING_BG).setFontColor(PENDING_COLOR);
  });
}

// ── Menu ──────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("CTM-01")
    .addItem("↻ Refresh live data now", "refreshAll")
    .addItem("↻ Refresh static data (buildings, waterways, ports…)", "refreshStatic")
    .addSeparator()
    .addItem("⚙ Re-run setup", "setup")
    .addToUi();
}
