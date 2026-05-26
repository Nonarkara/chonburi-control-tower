import { useEffect } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Manual — pop-up reference for every control, color code, and acronym
 * on the dashboard. Triggered from the top-bar "?" button.
 */
export function Manual({ open, onClose }: Props) {
  const containerRef = useFocusTrap(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="manual-backdrop" onClick={onClose}>
      <div
        ref={containerRef}
        className="manual"
        role="dialog"
        aria-modal="true"
        aria-label="Chonburi Control Tower — manual"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="manual-head">
          <div className="col">
            <span className="eyebrow mono">Manual · CTM-01</span>
            <h2 className="manual-title">How to read this dashboard</h2>
          </div>
          <button onClick={onClose} className="mono manual-close" aria-label="Close manual">
            [ESC] CLOSE
          </button>
        </header>

        <div className="manual-body">

          {/* ── At a glance ── */}
          <section className="manual-section">
            <h3 className="manual-h3">At a glance</h3>
            <p>
              One screen, one municipality. The map is the dashboard's spine — everything else feeds it.
              Pick a <strong>lens</strong> on the right to switch the data story; toggle individual
              layers below it; click any building, pipe, or POI for details.
              Hover any control for a tooltip.
            </p>
            <ul className="manual-flow">
              <li><span className="mono">①</span> Top bar — brand, live-feed health (37+ feeds), controls (2D/3D, theme, sources, manual)</li>
              <li><span className="mono">②</span> World strip — Chonburi weather + 6 user-set city clocks</li>
              <li><span className="mono">③</span> News ticker — top headlines, scrolls horizontally; ⏸ button pauses it</li>
              <li><span className="mono">④</span> Left rail — device check-in, speed test, municipal brief, KPIs; INT lens shows Situation Digest</li>
              <li><span className="mono">⑤</span> Map — 20,877-building city twin (2D, 3D, or 3DS substructure). INT lens shows red alert badges here.</li>
              <li><span className="mono">⑥</span> Right rail — Google Trends + full news desk + Facebook municipal feed</li>
              <li><span className="mono">⑦</span> Bottom — version pill, traffic hour slider, counts</li>
            </ul>
          </section>

          {/* ── Lenses ── */}
          <section className="manual-section">
            <h3 className="manual-h3">Lens buttons (right rail, top)</h3>
            <p>One click picks a curated set of layers. Hover any lens for the full description.</p>
            <table className="manual-table">
              <thead><tr><th>Code</th><th>Name</th><th>What it shows</th></tr></thead>
              <tbody>
                <tr><td className="mono">EXEC</td><td>Executive</td><td>Strategic overview — satellite + Laem Chabang port + transit + GISTDA POIs. Focused on Chonburi Town Municipality (~46 km²).</td></tr>
                <tr><td className="mono">OPS</td><td>Operations</td><td>Default day-to-day view — buildings, road network, civic POIs, live traffic, incidents, CCTV, news pins.</td></tr>
                <tr><td className="mono">MOB</td><td>Mobility</td><td>Traffic heatmap, iTIC events, transit stations + lines, ferry terminals, AIS vessels, CCTV.</td></tr>
                <tr><td className="mono">MAR</td><td>Maritime</td><td>Gulf of Thailand — Laem Chabang port, OpenSeaMap overlay, AIS live vessels, navigation aids, 1/5/10 km distance grid.</td></tr>
                <tr><td className="mono">ENV</td><td>Environment</td><td>Esri satellite + flood-prone areas + GISTDA solar rooftop irradiance.</td></tr>
                <tr><td className="mono">EAR</td><td>Earth</td><td>NASA satellite stack + MERRA-2 LIVE READINGS — IMERG rainfall, MODIS flood + LST + NDVI + AOD, OMI NO₂, land use.</td></tr>
                <tr><td className="mono">SAF</td><td>Safety</td><td>Flood-risk zones + citizen reports (Traffy) + iTIC + hospitals/fire/police + waterways + CCTV + MODIS flood detection.</td></tr>
                <tr><td className="mono">INT</td><td>Intelligence</td><td><strong>NEW</strong> — TimesFM forecast rows are clickable → activates map layer. Red alert badges float above map on threshold breach. Situation Digest in left rail.</td></tr>
                <tr><td className="mono">VIB</td><td>Vibes</td><td>Presentation view — MODIS true-color satellite + maritime overlay. No data overlays.</td></tr>
              </tbody>
            </table>
          </section>

          {/* ── View modes ── */}
          <section className="manual-section">
            <h3 className="manual-h3">View modes (top bar, "2D" button)</h3>
            <p>The button cycles three states:</p>
            <table className="manual-table">
              <thead><tr><th>Mode</th><th>What changes</th></tr></thead>
              <tbody>
                <tr><td className="mono">2D</td><td>Top-down. Pitch 0°, bearing 0°. Building footprints flat.</td></tr>
                <tr><td className="mono">3D</td><td>Tilted (pitch 60°, bearing −18°). 20,877 buildings extruded to real heights — gold (temple/mosque), blue (civic), coral (hospital), magenta→amber height ramp otherwise. Heritage buildings show coloured roof caps.</td></tr>
                <tr><td className="mono">3DS</td><td>Substructure (SimCity-2000-style). Superstructure ghosts to 35 % opacity; utility pipes drop to burial depth (electricity ≈ 2 m, water ≈ 3 m, storm drains ≈ 4 m). Pitch 62°.</td></tr>
              </tbody>
            </table>
          </section>

          {/* ── Layer color codes ── */}
          <section className="manual-section">
            <h3 className="manual-h3">Color codes on the map</h3>
            <div className="manual-grid-2">
              <div>
                <h4 className="manual-h4">Buildings (3D)</h4>
                <p className="caption">Height-graded ramp — magenta to amber as floors climb.</p>
                <ul className="manual-swatches">
                  <li><span className="sw" style={{ background: "rgb(120,60,110)" }}/> &lt; 15 m (low-rise)</li>
                  <li><span className="sw" style={{ background: "rgb(180,70,130)" }}/> 15–30 m (mid-rise)</li>
                  <li><span className="sw" style={{ background: "rgb(220,130,150)" }}/> 30–50 m (high-rise)</li>
                  <li><span className="sw" style={{ background: "rgb(240,200,130)" }}/> ≥ 50 m (tower)</li>
                </ul>
              </div>
              <div>
                <h4 className="manual-h4">Utilities</h4>
                <ul className="manual-swatches">
                  <li><span className="sw" style={{ background: "var(--accent)" }}/> Electricity — amber (HV 115 kV thick, MV 22 kV thin)</li>
                  <li><span className="sw" style={{ background: "var(--data)" }}/> Water mains — cyan (main thick, lateral thin)</li>
                  <li><span className="sw" style={{ background: "var(--good)" }}/> Storm drainage — emerald (flow → Centenary basin)</li>
                  <li><span className="sw" style={{ background: "rgb(34,211,238)" }}/> WiFi — cyan dot (green / amber / red by Mbps)</li>
                </ul>
              </div>
              <div>
                <h4 className="manual-h4">Incidents</h4>
                <ul className="manual-swatches">
                  <li><span className="sw" style={{ background: "var(--crit)" }}/> Accident · fire</li>
                  <li><span className="sw" style={{ background: "var(--warn)" }}/> Traffic congestion · construction</li>
                  <li><span className="sw" style={{ background: "rgb(56,189,248)" }}/> Flooding · drainage</li>
                  <li><span className="sw" style={{ background: "rgb(167,139,250)" }}/> Sidewalk · waste · trees</li>
                </ul>
              </div>
              <div>
                <h4 className="manual-h4">Air quality (US AQI)</h4>
                <ul className="manual-swatches">
                  <li><span className="sw" style={{ background: "var(--good)" }}/> 0–50 Good</li>
                  <li><span className="sw" style={{ background: "var(--warn)" }}/> 51–100 Moderate</li>
                  <li><span className="sw" style={{ background: "var(--bad)" }}/> 101–200 Unhealthy</li>
                  <li><span className="sw" style={{ background: "var(--crit)" }}/> &gt; 200 Hazardous</li>
                </ul>
              </div>
              <div>
                <h4 className="manual-h4">Transit lines</h4>
                <ul className="manual-swatches">
                  <li><span className="sw" style={{ background: "#EF4444" }}/> Bus line 1 — runs Saturday</li>
                  <li><span className="sw" style={{ background: "#38BDF8" }}/> Bus line 2 — runs Saturday</li>
                  <li><span className="sw" style={{ background: "#34D399" }}/> Bus line 3 — weekday only</li>
                  <li><span className="sw" style={{ background: "#FBBF24" }}/> Bus line 4 — weekday only</li>
                  <li><span className="sw" style={{ background: "#A78BFA" }}/> Bus line 5 — weekday only</li>
                </ul>
              </div>
              <div>
                <h4 className="manual-h4">Feed health (top-bar chips)</h4>
                <ul className="manual-swatches">
                  <li><span className="sw" style={{ background: "var(--good)" }}/> Live — fresh from upstream</li>
                  <li><span className="sw" style={{ background: "var(--accent)" }}/> Cache — served from a recent fetch</li>
                  <li><span className="sw" style={{ background: "var(--bad)" }}/> Unavailable — upstream errored</li>
                  <li><span className="sw" style={{ background: "var(--text-3)" }}/> Loading — first fetch in flight</li>
                </ul>
              </div>
            </div>
          </section>

          {/* ── Acronyms ── */}
          <section className="manual-section">
            <h3 className="manual-h3">Acronyms</h3>
            <div className="manual-grid-2 manual-acro">
              <dl>
                <dt>CTM-01</dt><dd>Chonburi Town Center v1 — this dashboard.</dd>
                <dt>EEC</dt><dd>Eastern Economic Corridor — Thailand's special economic zone anchored by Laem Chabang port + U-Tapao airport. Chonburi is the hub city.</dd>
                <dt>depa</dt><dd>Digital Economy Promotion Agency — co-sponsor of this project (logo top-left).</dd>
                <dt>GISTDA</dt><dd>Geo-Informatics and Space Technology Development Agency — Thai government agency; source of POI Digital Twin, Solar LOD2, and Land Use layers.</dd>
                <dt>PEA</dt><dd>Provincial Electricity Authority — electricity provider for Chonburi (not MEA, which serves Bangkok).</dd>
                <dt>OSM</dt><dd>OpenStreetMap — source of building footprints, roads, transit stations.</dd>
                <dt>GIBS</dt><dd>NASA Global Imagery Browse Services — every satellite layer (MODIS, VIIRS, IMERG, OMI, Himawari, etc.).</dd>
                <dt>AIS</dt><dd>Automatic Identification System — maritime vessel tracking. Live vessel dots on the MAR lens.</dd>
                <dt>TimesFM</dt><dd>Google Time-Series Foundation Model (2.0, 200M params) — zero-shot hourly forecasts for 5 metrics shown in Predictive Intelligence panel. In INT lens, each metric row is clickable → activates its map layer.</dd>
                <dt>MERRA-2</dt><dd>NASA Modern-Era Retrospective analysis for Research and Applications — satellite + model reanalysis. Source of the LIVE READINGS strip in EAR lens (temp, precip, solar, sky clearness). ~3-day publication latency, no API key.</dd>
              </dl>
              <dl>
                <dt>AQI</dt><dd>Air Quality Index (US EPA scale) — derived from PM2.5 + PM10.</dd>
                <dt>PM2.5</dt><dd>Particulate matter ≤ 2.5 µm — the haze you breathe. WHO 24-hr guideline is 15 µg/m³.</dd>
                <dt>iTIC</dt><dd>Intelligent Traffic Information Center / Longdo — live traffic events (Eastern Seaboard + national).</dd>
                <dt>Traffy</dt><dd>Traffy Fondue — citizen complaint platform; Thailand's nationwide 311 channel.</dd>
                <dt>NDVI</dt><dd>Normalized Difference Vegetation Index — satellite-derived greenness.</dd>
                <dt>LST</dt><dd>Land Surface Temperature — satellite-derived ground temp; shows urban heat islands.</dd>
                <dt>AOD</dt><dd>Aerosol Optical Depth — satellite proxy for haze + PM2.5.</dd>
                <dt>OMI / VIIRS / MODIS / IMERG</dt><dd>NASA satellite instruments. OMI → NO₂; VIIRS → night lights, true-color; MODIS → daily Earth observation; IMERG → half-hourly rainfall.</dd>
                <dt>RTT</dt><dd>Round-Trip Time — how long a network packet takes to bounce. Lower = snappier.</dd>
                <dt>Mbps</dt><dd>Megabits per second — network download speed.</dd>
                <dt>p10/p50/p90</dt><dd>Percentile confidence bands in the forecast sparklines. p50 = median forecast; p10–p90 = 80% confidence interval.</dd>
              </dl>
            </div>
          </section>

          {/* ── Interactive controls ── */}
          <section className="manual-section">
            <h3 className="manual-h3">Interactive controls</h3>
            <table className="manual-table">
              <thead><tr><th>Control</th><th>Where</th><th>What it does</th></tr></thead>
              <tbody>
                <tr><td><span className="mono">↻</span></td><td>News + Trends header</td><td>Force-refresh that feed, bypassing the cache.</td></tr>
                <tr><td><span className="mono">2D / 3D / 3DS</span></td><td>Top bar</td><td>Cycle view mode. 3DS is the underground cutaway.</td></tr>
                <tr><td><span className="mono">☾ / ☀</span></td><td>Top bar</td><td>Light / dark theme toggle. Follows system pref by default.</td></tr>
                <tr><td><span className="mono">SOURCES · N</span></td><td>Top bar</td><td>Opens the data-source catalog — every API + status.</td></tr>
                <tr><td><span className="mono">?</span></td><td>Top bar</td><td>This manual.</td></tr>
                <tr><td><span className="mono">+ ADD CLOCK</span></td><td>World strip</td><td>Click an empty slot, search any city, watch its local time. 6 slots.</td></tr>
                <tr><td><span className="mono">REQUEST GPS FIX</span></td><td>Left rail</td><td>Logs the device on the map (browser permission required). Dot follows you.</td></tr>
                <tr><td><span className="mono">RUN</span> (speed test)</td><td>Left rail</td><td>Times a 1.1 MB asset download. Reports Mbps + RTT + your location.</td></tr>
                <tr><td>Predictive metric row</td><td>Left rail (INT lens)</td><td>Click any RAIN / TIDE / INCIDENTS / AQI / VESSELS row → activates its map layer. Red badge floats on map if p50 exceeds threshold.</td></tr>
                <tr><td>Building search</td><td>Top of map</td><td>Type any building name (EN or Thai). Pick → camera flies to it.</td></tr>
                <tr><td>Building click</td><td>Map</td><td>Right-rail BuildingCard with name, levels, height, operator.</td></tr>
                <tr><td><span className="mono">+ / −</span></td><td>Bottom-right of map</td><td>Zoom in / out (works with pinch + trackpad too). Zoom is bounded to the municipality — scroll can't escape to Bangkok.</td></tr>
                <tr><td>Hour slider</td><td>Bottom bar</td><td>Scrubs the traffic heatmap across 24 hours. Weekday / Weekend toggle pairs with it.</td></tr>
              </tbody>
            </table>
          </section>

          {/* ── Indicative vs Authoritative ── */}
          <section className="manual-section">
            <h3 className="manual-h3">Authoritative vs Indicative</h3>
            <p>
              Every panel labels what's modeled and what's live. Tags like "approx",
              "modeled", "indicative", "sensor feed pending" mean we're rendering a
              plausible placeholder until municipal GIS data is connected.
              Anything tagged "live" came from an upstream API this minute. The
              Source Catalog (<span className="mono">SOURCES</span> button) shows the
              exact endpoint + cache age + status tier for every feed.
            </p>
          </section>

          <footer className="manual-foot caption">
            CTM-01 v0.1 · Chonburi Town Center · github.com/Nonarkara/chonburi-control-tower · For the full platform overview see the <strong>WP</strong> button.
          </footer>
        </div>
      </div>
    </div>
  );
}
