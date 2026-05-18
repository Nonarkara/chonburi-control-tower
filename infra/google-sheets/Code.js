/**
 * CCT-01 · Chula Control Tower — Google Sheets Live Data Feed
 * ─────────────────────────────────────────────────────────────
 * SETUP (one-time, ~2 minutes):
 *
 *   1. Open Google Sheets → sheets.new
 *   2. Rename the file: "CCT-01 · Chula Control Tower · Live Data"
 *   3. Menu → Extensions → Apps Script
 *   4. Delete the default code, paste THIS entire file, save
 *   5. Click ▷ Run → select "setup" → authorize when prompted
 *   6. That's it. All tabs are created automatically.
 *   7. Copy the Sheets URL and paste it into the dashboard SHEETS button.
 *
 * Refresh cadence:
 *   • Live feeds (Weather, AQ, News, Markets, Executive, …) auto-refresh
 *     every 5 minutes via a time-based trigger.
 *   • Static reference tabs (BTS/MRT stations, gates, buildings,
 *     PMCU lands, BMA POIs) are pulled once at setup, re-pullable via the
 *     CCT-01 menu → "Refresh static data".
 *   • Placeholder tabs (Enrollment, Energy, Waste, …) ship empty with
 *     proper headers, ready to receive feeds from official Chula
 *     pipelines once those are connected. See PLACEHOLDER_TABS below for
 *     the expected schema and the upstream contact for each.
 *
 * Data source: https://chula-api.nonarkara.org
 * Dashboard:   https://chula-control-tower-b0r.pages.dev
 */

var API = "https://chula-api.nonarkara.org";

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
  var w = d.weather || {};
  var tier = (d.meta && d.meta.fallbackTier) || "—";
  clearAndWrite(getSheet("Weather"),
    ["Fetched At", "Temp °C", "Feels Like °C", "Humidity %", "Wind km/h",
     "Rain Now mm", "Rain Today mm", "UV Index", "Condition", "Tier"],
    [[ts, val(w.temp_c), val(w.feels_like_c), val(w.humidity_pct),
       val(w.wind_kph), val(w.rain_now_mm), val(w.rain_today_mm),
       val(w.uv_index), val(w.condition), tier]]
  );
  return "1 row";
}

function refreshAirQuality(ts) {
  var d = get("/api/air-quality");
  var pts = d.features || [];
  var rows = pts.map(function(f) {
    var p = f.properties || {};
    return [ts, val(p.stationName), val(p.aqi), val(p.pm25), val(p.pm10),
            val(p.no2), val(p.o3), val(p.aqiCategory), val(p.source)];
  });
  clearAndWrite(getSheet("AirQuality"),
    ["Fetched At", "Station", "AQI (US)", "PM2.5 µg/m³", "PM10 µg/m³",
     "NO₂ µg/m³", "O₃ µg/m³", "Category", "Source"],
    rows.length ? rows : [[ts, "(no station data)", "—", "—", "—", "—", "—", "—", "—"]]
  );
  return rows.length + " stations";
}

function refreshAqTrend(ts) {
  var d = get("/api/air-quality/trend");
  var rows = (d.features || []).flatMap(function(stn) {
    var name = stn.station || "—";
    var current = stn.current || {};
    var forecast = stn.next8h || [];
    var out = [[ts, name, "now", val(current.aqi), val(current.pm25), val(stn.category)]];
    forecast.forEach(function(f) {
      out.push([ts, name, f.at, val(f.aqi), val(f.pm25), "—"]);
    });
    return out;
  });
  clearAndWrite(getSheet("AqiTrend"),
    ["Fetched At", "Station", "At", "AQI", "PM2.5", "Category"],
    rows.length ? rows : [[ts, "(no trend data)", "—", "—", "—", "—"]]
  );
  return rows.length + " hourly points";
}

function refreshIncidents(ts) {
  var cr = get("/api/incidents/city-reports");
  var itic = get("/api/incidents/itic");

  function toRow(src) {
    return function(f) {
      var p = f.properties || {};
      var c = f.geometry && f.geometry.coordinates;
      return [ts, src, val(p.type), val(p.status),
              (p.description || "").slice(0, 300),
              c ? c[1] : "—", c ? c[0] : "—",
              val(p.reportedAt || p.timestamp)];
    };
  }

  var rows = (cr.features || []).map(toRow("City Reporter"))
    .concat((itic.features || []).map(toRow("iTIC/Longdo")));

  clearAndWrite(getSheet("Incidents"),
    ["Fetched At", "Source", "Type", "Status", "Description", "Lat", "Lng", "Reported At"],
    rows.length ? rows : [[ts, "(none)", "—", "—", "No open incidents near campus", "—", "—", "—"]]
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

// PR-facing rolling archive — every unique Chula-related story this server
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

function refreshShuttle(ts) {
  var d = get("/api/transit/cu-shuttle");
  var buses = d.vehicles || d.features || [];
  var rows = buses.map(function(b) {
    var p = b.properties || b;
    var c = b.geometry && b.geometry.coordinates;
    return [ts, val(p.lineId || p.routeId), val(p.lineName), val(p.vehicleId),
            c ? c[1] : "—", c ? c[0] : "—",
            val(p.speed), val(p.heading), val(p.updatedAt || p.timestamp)];
  });
  clearAndWrite(getSheet("ShuttleLive"),
    ["Fetched At", "Line ID", "Line Name", "Vehicle ID", "Lat", "Lng",
     "Speed km/h", "Heading", "Updated At"],
    rows.length ? rows : [[ts, "—", "—", "—", "—", "—", "—", "—", "(no live vehicles)"]]
  );
  return rows.length + " vehicles";
}

function refreshTrends(ts) {
  var d = get("/api/trends");
  var rows = (d.series || d.features || []).map(function(s) {
    return [ts, val(s.keyword), val(s.value), val(s.geo || "TH"), val(s.updatedAt)];
  });
  clearAndWrite(getSheet("Trends"),
    ["Fetched At", "Keyword", "Score 0–100", "Geo", "Updated At"],
    rows.length ? rows : [[ts, "Chulalongkorn", "—", "TH", "—"]]
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
    rows.push([ts, "enrollment", "total", "Total students", e.total]);
    rows.push([ts, "enrollment", "undergrad", "Undergraduate", e.undergraduate]);
    rows.push([ts, "enrollment", "graduate", "Graduate", e.graduate]);
    rows.push([ts, "enrollment", "international", "International", e.international + " (" + e.internationalPct + "%)"]);
    rows.push([ts, "enrollment", "faculties", "Faculties", e.faculties]);
    rows.push([ts, "enrollment", "ratio", "Student:Faculty", e.studentFacultyRatio]);
  }
  // Research
  if (ex.research) {
    var r = ex.research;
    rows.push([ts, "research", "publications", "Publications 2024", r.publications2024]);
    rows.push([ts, "research", "citations", "Citations 2024", r.citations2024]);
    rows.push([ts, "research", "hIndex", "h-index", r.hIndex]);
    rows.push([ts, "research", "topFields", "Top fields", (r.topFields || []).join(", ")]);
    rows.push([ts, "research", "fundingMThb", "Funding M฿", r.researchFundingMThb]);
    rows.push([ts, "research", "patents", "Patents filed", r.patentsFiled]);
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
               "QS #" + p.qsWorldRank + " · THE #" + p.theWorldRank + " · " + p.studentsTotal + " students"]);
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
  var rows = (d.features || []).map(function(f) {
    var p = f.properties || {};
    var c = f.geometry && f.geometry.coordinates;
    return [ts, val(p.id), val(p.name), val(p.vendor),
            c ? c[1] : "—", c ? c[0] : "—", val(p.imageUrl)];
  });
  clearAndWrite(getSheet("CCTV"),
    ["Fetched At", "ID", "Name", "Vendor", "Lat", "Lng", "Stream URL"],
    rows.length ? rows : [[ts, "—", "(no cameras)", "—", "—", "—", "—"]]
  );
  return rows.length + " cameras";
}

// ── STATIC adapters — pulled once at setup, refreshable via menu ──────

function refreshTransitStations(ts) {
  // Static GeoJSON in the web app, but exposing through API isn't wired —
  // we pull from the published Pages site instead so this works without
  // depending on /apps/api routes for static files.
  var url = "https://chula-control-tower-b0r.pages.dev/geo/transit-stations.geojson";
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error("transit-stations HTTP " + res.getResponseCode());
  var d = JSON.parse(res.getContentText());
  var rows = (d.features || []).map(function(f) {
    var p = f.properties || {};
    var c = f.geometry && f.geometry.coordinates;
    return [ts, val(p.system), val(p.name), val(p.nameEn || p.name),
            val(p.code), val(p.line), c ? c[1] : "—", c ? c[0] : "—"];
  });
  clearAndWrite(getSheet("TransitStations"),
    ["Fetched At", "System", "Name", "Name (EN)", "Code", "Line", "Lat", "Lng"],
    rows
  );
  return rows.length + " stations";
}

function refreshCampusGates(ts) {
  var url = "https://chula-control-tower-b0r.pages.dev/geo/chula-gates.geojson";
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error("gates HTTP " + res.getResponseCode());
  var d = JSON.parse(res.getContentText());
  var rows = (d.features || []).map(function(f) {
    var p = f.properties || {};
    var c = f.geometry && f.geometry.coordinates;
    return [ts, val(p.kind), val(p.name), val(p.nameTh), p.named ? "yes" : "no",
            c ? c[1] : "—", c ? c[0] : "—"];
  });
  clearAndWrite(getSheet("CampusGates"),
    ["Fetched At", "Kind", "Name (EN)", "Name (TH)", "Named", "Lat", "Lng"],
    rows
  );
  return rows.length + " gates";
}

function refreshCULands(ts) {
  var url = "https://chula-control-tower-b0r.pages.dev/geo/cu-lands.geojson";
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error("cu-lands HTTP " + res.getResponseCode());
  var d = JSON.parse(res.getContentText());
  var rows = (d.features || []).map(function(f) {
    var p = f.properties || {};
    var name = p.name || {};
    return [ts, val(p.id), val(name.en), val(name.th),
            val(p.kind), val(p.operator), val(p.describe)];
  });
  clearAndWrite(getSheet("CULands"),
    ["Fetched At", "ID", "Name (EN)", "Name (TH)", "Kind", "Operator", "Describe"],
    rows
  );
  return rows.length + " lands";
}

function refreshShuttleRoutes(ts) {
  var url = "https://chula-control-tower-b0r.pages.dev/geo/cu-shuttle-routes.geojson";
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error("shuttle-routes HTTP " + res.getResponseCode());
  var d = JSON.parse(res.getContentText());
  var rows = (d.features || []).map(function(f) {
    var p = f.properties || {};
    return [ts, val(p.route), val(p.ref), val(p.label), val(p.color)];
  });
  clearAndWrite(getSheet("ShuttleRoutes"),
    ["Fetched At", "Route", "Ref", "Label", "Color"],
    rows
  );
  return rows.length + " routes";
}

function refreshBmaPois(ts) {
  var d = get("/api/bma/pois");
  var rows = (d.features || []).map(function(f) {
    var p = f.properties || {};
    var c = f.geometry && f.geometry.coordinates;
    return [ts, val(p.id), val(p.kind), val(p.name),
            c ? c[1] : "—", c ? c[0] : "—", val(p.description)];
  });
  clearAndWrite(getSheet("BMAPOIs"),
    ["Fetched At", "ID", "Kind", "Name", "Lat", "Lng", "Description"],
    rows
  );
  return rows.length + " POIs";
}

// ── Adapter registry ──────────────────────────────────────────────────

var LIVE_ADAPTERS = [
  ["weather",         refreshWeather],
  ["airquality",      refreshAirQuality],
  ["aqi-trend",       refreshAqTrend],
  ["incidents",       refreshIncidents],
  ["news",            refreshNews],
  ["news-archive",    refreshNewsArchive],
  ["news-digest",     refreshNewsDigest],
  ["shuttle-live",    refreshShuttle],
  ["trends",          refreshTrends],
  ["markets",         refreshMarkets],
  ["executive",       refreshExecutive],
  ["cctv",            refreshCctv],
];

var STATIC_ADAPTERS = [
  ["transit-stations", refreshTransitStations],
  ["campus-gates",     refreshCampusGates],
  ["cu-lands",         refreshCULands],
  ["shuttle-routes",   refreshShuttleRoutes],
  ["bma-pois",         refreshBmaPois],
];

// ── Placeholder tabs for future official Chula pipelines ──────────────
// Each entry creates a tab with a typed header row. The first data row is
// stamped with PENDING_PIPELINE + the contact for the upstream data owner,
// so when the pipeline is connected the operator knows exactly which
// office, file format, and refresh cadence to wire up.

var PLACEHOLDER_TABS = [
  {
    name: "Enrollment",
    owner: "Office of the Registrar (สำนักงานทะเบียน)",
    contact: "reg@chula.ac.th · cadence: each term + nightly delta",
    headers: ["Fetched At", "Faculty", "Program", "Level", "Year", "Headcount", "Female %", "Intl %"],
  },
  {
    name: "Faculty",
    owner: "Human Resources Office (ฝ่ายทรัพยากรบุคคล)",
    contact: "hr@chula.ac.th · cadence: monthly snapshot",
    headers: ["Fetched At", "Faculty", "Title", "Rank", "FTE", "PhD %", "Female %"],
  },
  {
    name: "Energy",
    owner: "CU SMART CITY / MEA microgrid (CU Energy Research Institute)",
    contact: "eri@chula.ac.th · cadence: 15-min meter pull, daily roll-up",
    headers: ["Fetched At", "Building", "kWh (last 15 min)", "kWh (today)",
              "Solar kWh (today)", "BESS SOC %", "Peak kW (today)"],
  },
  {
    name: "Water",
    owner: "PMCU + MWA bulk-meter feed",
    contact: "pmcu@chula.ac.th · cadence: hourly",
    headers: ["Fetched At", "Building", "m³ (last hour)", "m³ (today)",
              "Pressure bar", "Flow L/min", "Reclaimed %"],
  },
  {
    name: "Waste",
    owner: "Chula Sustainability Office",
    contact: "sustainability@chula.ac.th · cadence: daily pickup logs",
    headers: ["Fetched At", "Stream", "kg (today)", "kg (week)",
              "Recycled %", "Composted %", "Landfill kg"],
  },
  {
    name: "Access",
    owner: "Office of Physical Resources (security card readers)",
    contact: "opr@chula.ac.th · cadence: 5-min aggregate (privacy: counts only)",
    headers: ["Fetched At", "Gate", "Hour", "Inbound swipes", "Outbound swipes",
              "Unique IDs (hashed)"],
  },
  {
    name: "Rooms",
    owner: "Faculty room-booking systems (myCourseville / CU-NEX)",
    contact: "cu-nex@chula.ac.th · cadence: 15-min booking snapshot",
    headers: ["Fetched At", "Building", "Room", "Capacity",
              "Booked Now", "Today Utilization %", "Next Session"],
  },
  {
    name: "Library",
    owner: "CU Office of Academic Resources (CUIR + Walai)",
    contact: "library@car.chula.ac.th · cadence: hourly",
    headers: ["Fetched At", "Branch", "Entries (today)", "Active users",
              "Loans (today)", "eBook downloads", "Wait list"],
  },
  {
    name: "Parking",
    owner: "PMCU parking operations (PA · PB · PC · PD lots)",
    contact: "pmcu@chula.ac.th · cadence: 5-min gate counts",
    headers: ["Fetched At", "Lot", "Capacity", "Occupied", "Available",
              "% Full", "Inflow (last hour)", "Outflow (last hour)"],
  },
  {
    name: "Ridership",
    owner: "CU POP Bus onboard counters",
    contact: "popbus@chula.ac.th · cadence: per-trip aggregate",
    headers: ["Fetched At", "Line", "Trip", "Boardings", "Alightings",
              "Avg Load %", "Run Time (min)", "Headway (min)"],
  },
  {
    name: "Hospital",
    owner: "King Chulalongkorn Memorial Hospital (KCMH)",
    contact: "kcmh-it@chula.ac.th · cadence: 15-min queue snapshot",
    headers: ["Fetched At", "Department", "Patients in queue", "Avg wait (min)",
              "ED census", "Beds available", "ICU available"],
  },
  {
    name: "Sustainability",
    owner: "CU Sustainability Office (THE Impact + UI GreenMetric reporting)",
    contact: "sustainability@chula.ac.th · cadence: monthly",
    headers: ["Fetched At", "Metric", "Value", "Unit", "Target", "Baseline year",
              "Trend"],
  },
  {
    name: "Donors",
    owner: "Office of Alumni Affairs (สมาคมนิสิตเก่าจุฬาฯ)",
    contact: "alumni@chula.ac.th · cadence: weekly fundraising summary",
    headers: ["Fetched At", "Period", "Gifts received", "Total ฿",
              "Donors", "Average gift ฿", "Top campaign"],
  },
  {
    name: "Publications",
    owner: "Office of Research Affairs (Scopus / Web of Science / Dimensions feed)",
    contact: "research@chula.ac.th · cadence: weekly Scopus pull",
    headers: ["Fetched At", "Faculty", "Year", "Publications", "Citations",
              "h-index", "Top field", "Q1 share %"],
  },
  {
    name: "Patents",
    owner: "Technology Licensing Office (TLO) — Chulalongkorn University",
    contact: "tlo@chula.ac.th · cadence: monthly DIP feed",
    headers: ["Fetched At", "Application No", "Title", "Faculty", "Inventors",
              "Status", "Filing date", "Grant date"],
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
  SpreadsheetApp.getActiveSpreadsheet().toast("Static reference tabs refreshed.", "CCT-01", 6);
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
    "CCT-01 live feed active. Live tabs refresh every 5 min. Static tabs refreshed once; re-pull via CCT-01 menu.",
    "Setup complete ✓", 12
  );
}

function adapterTabName(id) {
  return {
    "weather":          "Weather",
    "airquality":       "AirQuality",
    "aqi-trend":        "AqiTrend",
    "incidents":        "Incidents",
    "news":             "News",
    "news-archive":     "NewsArchive",
    "news-digest":      "NewsDigest",
    "shuttle-live":     "ShuttleLive",
    "trends":           "Trends",
    "markets":          "Markets",
    "executive":        "Executive",
    "cctv":             "CCTV",
    "transit-stations": "TransitStations",
    "campus-gates":     "CampusGates",
    "cu-lands":         "CULands",
    "shuttle-routes":   "ShuttleRoutes",
    "bma-pois":         "BMAPOIs",
  }[id] || id;
}

function seedReadme(ss) {
  var sh = ss.getSheetByName("README");
  sh.clearContents();
  var meta = [
    ["CCT-01 · Chula Control Tower · Live Data", ""],
    ["", ""],
    ["Dashboard", "https://chula-control-tower-b0r.pages.dev"],
    ["Data API",  "https://chula-api.nonarkara.org"],
    ["Live refresh",  "Every 5 min (Apps Script time trigger)"],
    ["Static refresh","On setup + via CCT-01 menu → Refresh static data"],
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
  meta.push(["—— Future official Chula pipelines (placeholder tabs) ——", ""]);
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
    .createMenu("CCT-01")
    .addItem("↻ Refresh live data now", "refreshAll")
    .addItem("↻ Refresh static data (gates, lines, lands…)", "refreshStatic")
    .addSeparator()
    .addItem("⚙ Re-run setup", "setup")
    .addToUi();
}
