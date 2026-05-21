import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Manual — pop-up reference for every control, color code, and acronym
 * on the dashboard. Triggered from the top-bar "?" button.
 */
export function Manual({ open, onClose }: Props) {
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
        className="manual"
        role="dialog"
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
              <li><span className="mono">①</span> Top bar — brand, live-feed health, controls (2D/3D, theme, sources, manual)</li>
              <li><span className="mono">②</span> World strip — Chonburi weather + 6 user-set city clocks</li>
              <li><span className="mono">③</span> News ticker — top headlines, scrolls horizontally; hover to pause</li>
              <li><span className="mono">④</span> Left rail — device check-in, speed test, municipal brief, KPIs</li>
              <li><span className="mono">⑤</span> Map — the city twin (2D, 3D, or 3DS substructure)</li>
              <li><span className="mono">⑥</span> Right rail — Google Trends + full news desk</li>
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
                <tr><td className="mono">OPS</td><td>Operations</td><td>Default day-to-day view — municipal boundary, buildings, road network, civic POIs, waterways, live traffic, incidents, CCTV, AIS vessels.</td></tr>
                <tr><td className="mono">MOB</td><td>Mobility</td><td>Traffic heatmap, iTIC events, all 5 shuttle lines, BTS/MRT, CCTV.</td></tr>
                <tr><td className="mono">ENV</td><td>Environment</td><td>Esri high-res satellite + green spaces + AQ. Regional satellites opt-in.</td></tr>
                <tr><td className="mono">SAF</td><td>Safety</td><td>Citizen reports + iTIC + hospital/fire/police POIs + CCTV + flood.</td></tr>
                <tr><td className="mono">VIB</td><td>Vibes</td><td>Pretty view — municipal boundary + MODIS true-color satellite for presentations.</td></tr>
                <tr><td className="mono">UTL</td><td>Utilities</td><td>Underground stack — electricity, water, drainage + WiFi heatmap.</td></tr>
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
                <tr><td className="mono">3D</td><td>Tilted (pitch 50°, bearing −18°). Buildings extruded to their real heights — buildings across Chonburi city + EEC industrial zones, plus neighborhood towers ≥30 m (Pathumwan / Silom / Ratchaprasong skyline) when "Skyline" layer is on.</td></tr>
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
                <dt>BRIEF</dt><dd>Municipal brief panel — Chonburi arterial load, parking zones, transport fleet, active development pipeline.</dd>
                <dt>BMA</dt><dd>Bangkok Metropolitan Administration — city government. Source of POIs, parks, AQ stations, drainage.</dd>
                <dt>MEA</dt><dd>Metropolitan Electricity Authority — MEA serves Bangkok; Chonburi served by PEA (Provincial Electricity Authority).</dd>
                <dt>MWA</dt><dd>Metropolitan Waterworks Authority — owns the water mains.</dd>
                <dt>depa</dt><dd>Digital Economy Promotion Agency — co-sponsor of this project (logo top-left).</dd>
                <dt>SLIC</dt><dd>Smart Liveable Cities index — sibling project (logo top-left).</dd>
                <dt>OSM</dt><dd>OpenStreetMap — source of every building footprint, road, transit station, shuttle route shown here.</dd>
                <dt>GIBS</dt><dd>NASA Global Imagery Browse Services — every satellite layer (MODIS, VIIRS, IMERG, OMI, etc.).</dd>
              </dl>
              <dl>
                <dt>AQI</dt><dd>Air Quality Index (US EPA scale) — derived from PM2.5 + PM10.</dd>
                <dt>PM2.5</dt><dd>Particulate matter ≤ 2.5 µm — the haze you breathe. WHO 24-hr guideline is 15 µg/m³.</dd>
                <dt>iTIC</dt><dd>Intelligent Traffic Information Center / Longdo — live traffic events (Eastern Seaboard + national).</dd>
                <dt>Traffy CR</dt><dd>Traffy Fondue + City Reporter — citizen complaint feed (BMA's 311).</dd>
                <dt>NDVI</dt><dd>Normalized Difference Vegetation Index — satellite-derived greenness.</dd>
                <dt>LST</dt><dd>Land Surface Temperature — satellite-derived ground temp; shows urban heat islands.</dd>
                <dt>AOD</dt><dd>Aerosol Optical Depth — satellite proxy for haze + PM.</dd>
                <dt>OMI / VIIRS / MODIS / IMERG</dt><dd>NASA satellite instruments. OMI → NO₂; VIIRS → night lights, true-color; MODIS → daily Earth observation; IMERG → half-hourly rainfall.</dd>
                <dt>BESS</dt><dd>Battery Energy Storage System — 4 MWh unit colocated with EEC substation.</dd>
                <dt>HV / MV / LV</dt><dd>High / Medium / Low Voltage — 115 kV transmission, 22 kV distribution, 230/400 V service.</dd>
                <dt>RTT</dt><dd>Round-Trip Time — how long a network packet takes to bounce. Lower = snappier.</dd>
                <dt>Mbps</dt><dd>Megabits per second — network download speed.</dd>
                <dt>BTS / MRT</dt><dd>Bangkok Skytrain / Metro — Chonburi has no metro yet; EEC high-speed rail link planned for 2028.</dd>
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
                <tr><td>Building search</td><td>Top of map</td><td>Type any building name (EN or Thai). Pick → camera flies to it.</td></tr>
                <tr><td>Building click</td><td>Map</td><td>Right-rail BuildingCard with name, levels, height, operator.</td></tr>
                <tr><td><span className="mono">+ / −</span></td><td>Bottom-right of map</td><td>Zoom in / out (works with pinch + trackpad too).</td></tr>
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
            v0.1 · Built over a weekend, ninja style. Code at github.com/Nonarkara/chonburi-control-tower.
          </footer>
        </div>
      </div>
    </div>
  );
}
