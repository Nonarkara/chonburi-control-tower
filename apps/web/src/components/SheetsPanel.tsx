import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "chonburi:sheets-url-v1";

// Build-time default — set VITE_SHEETS_URL in apps/web/.env.production to make
// the SHEETS button open the live data sheet on first click, no setup needed.
const DEFAULT_URL = (import.meta.env.VITE_SHEETS_URL as string | undefined) ?? "";

interface Props {
  open: boolean;
  onClose: () => void;
}

function loadUrl(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_URL; } catch { return DEFAULT_URL; }
}
function saveUrl(url: string) {
  try { localStorage.setItem(STORAGE_KEY, url); } catch {}
}
export function loadSheetsUrl(): string { return loadUrl(); }

/**
 * First-time: paste the Google Sheets URL → saves to localStorage.
 * Subsequent visits: opens the sheet directly.
 * Rendered from TopBar's SHEETS button.
 */
export function SheetsPanel({ open, onClose }: Props) {
  const [url, setUrl] = useState(() => loadUrl());
  const [input, setInput] = useState(() => loadUrl());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isValid = (() => {
    try {
      const u = new URL(input.trim());
      return u.hostname === "docs.google.com" && u.pathname.includes("/spreadsheets/");
    } catch { return false; }
  })();

  const save = () => {
    const trimmed = input.trim();
    saveUrl(trimmed);
    setUrl(trimmed);
    window.open(trimmed, "_blank", "noopener,noreferrer");
    onClose();
  };

  const openExisting = () => {
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div className="manual-backdrop" onClick={onClose}>
      <div
        className="sheets-panel"
        role="dialog"
        aria-label="Google Sheets integration"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="manual-head">
          <div className="col">
            <span className="eyebrow mono">Live Data Export · Google Sheets</span>
            <h2 className="manual-title">CTM-01 Live Data Feed</h2>
          </div>
          <button onClick={onClose} className="mono manual-close" aria-label="Close">
            [ESC] CLOSE
          </button>
        </header>

        <div className="sheets-body">
          {!url ? (
            /* ── First-time setup ── */
            <>
              <div className="sheets-setup">
                <div className="sheets-step">
                  <span className="sheets-num mono">01</span>
                  <div>
                    <strong>Open a new Google Sheet</strong>
                    <p>Go to <a href="https://sheets.new" target="_blank" rel="noopener noreferrer">sheets.new</a> and rename the file <span className="mono">"CTM-01 · Chonburi Town Center · EarthAlpha + Live Data"</span>. No need to add tabs by hand — the script creates everything.</p>
                  </div>
                </div>
                <div className="sheets-step">
                  <span className="sheets-num mono">02</span>
                  <div>
                    <strong>Open Apps Script + paste the code</strong>
                    <p>Extensions → Apps Script. Delete the default code. Paste everything from <span className="mono">infra/google-sheets/Code.js</span> in the repo.</p>
                    <a
                      href="https://github.com/Nonarkara/chonburi-control-tower/blob/main/infra/google-sheets/Code.js"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sheets-link mono"
                    >
                      View Code.js on GitHub →
                    </a>
                  </div>
                </div>
                <div className="sheets-step">
                  <span className="sheets-num mono">03</span>
                  <div>
                    <strong>Run setup once</strong>
                    <p>Click Run → select <span className="mono">setup</span> → authorize. The script creates live tabs, EarthAlpha/GISTDA tabs, static Chonburi reference tabs (buildings, roads, waterways, fisheries, flood risk, ports), and typed tabs for future official municipal pipelines.</p>
                  </div>
                </div>
                <div className="sheets-step">
                  <span className="sheets-num mono">04</span>
                  <div>
                    <strong>Paste the Sheets URL below</strong>
                    <p>Copy the URL from your browser (looks like <span className="mono">https://docs.google.com/spreadsheets/d/…/edit</span>) and paste it here. The SHEETS button will open it directly from now on.</p>
                  </div>
                </div>
              </div>

              <div className="sheets-input-row">
                <input
                  ref={inputRef}
                  type="url"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/…/edit"
                  className="sheets-url-input"
                />
                <button
                  onClick={save}
                  disabled={!isValid}
                  className="mono sheets-save"
                >
                  SAVE &amp; OPEN
                </button>
              </div>
            </>
          ) : (
            /* ── Already configured ── */
            <>
              <div className="sheets-configured">
                <div className="sheets-ok-row">
                  <span className="dot live" />
                  <span className="mono">Live feed configured — refreshes every 5 min via Apps Script</span>
                </div>
                <div className="sheets-url-display mono">{url}</div>
                <div className="sheets-actions">
                  <button onClick={openExisting} className="mono sheets-open">
                    OPEN IN GOOGLE SHEETS →
                  </button>
                  <button
                    onClick={() => { setUrl(""); setInput(""); saveUrl(""); }}
                    className="mono sheets-reset"
                  >
                    CHANGE URL
                  </button>
                </div>
              </div>
              <div className="sheets-info">
                <p className="caption">Live tabs — refreshed every 5 minutes from <span className="mono">chonburi-api.nonarkara.org</span>:</p>
                <ul className="sheets-endpoints mono">
                  {[
                    ["Weather",      "/api/weather"],
                    ["PrecipNowcast","/api/precip-nowcast"],
                    ["AirQuality",   "/api/air-quality"],
                    ["AqiTrend",     "/api/air-quality/trend"],
                    ["Incidents",    "/api/incidents/city-reports + /api/incidents/itic"],
                    ["News",         "/api/news"],
                    ["Marine",       "/api/marine"],
                    ["Tides",        "/api/tides"],
                    ["AIS",          "/api/maritime/ais"],
                    ["GISTDA_POI",   "/api/gistda/poi"],
                    ["GISTDA_Solar", "/api/gistda/solar"],
                    ["GISTDA_LandUse","/api/gistda/landuse"],
                    ["DatagoPoints", "/api/datago/points"],
                    ["Trends",       "/api/trends"],
                    ["Markets",      "/api/markets"],
                    ["Executive",    "/api/executive"],
                    ["CCTV",         "/api/cctv/longdo"],
                  ].map(([name, path]) => (
                    <li key={name}>
                      <span>{name}</span>
                      <span className="muted">{path}</span>
                    </li>
                  ))}
                </ul>
                <p className="caption" style={{ marginTop: 14 }}>Static + future tabs — ready for official municipal pipelines:</p>
                <ul className="sheets-endpoints mono">
                  {[
                    ["Buildings",      "Static city footprint inventory"],
                    ["Roads",          "Static road network and classes"],
                    ["Waterways",      "Canals, rivers, drains"],
                    ["Fisheries",      "Aquaculture and fishery zones"],
                    ["FloodRisk",      "Known coastal and drainage risk areas"],
                    ["EarthAlphaObservations", "Area observations, satellite review notes, validation queue"],
                    ["Energy",         "Municipal grid, rooftop solar, BESS"],
                    ["Water",          "Municipal waterworks by zone"],
                    ["Waste",          "Waste collection streams"],
                    ["Access",         "Facilities and checkpoint counts"],
                    ["Library",        "Municipal library"],
                    ["Parking",        "Municipal parking zones"],
                    ["Ridership",      "Public transit counts"],
                    ["Hospital",       "Chonburi Hospital — ED wait, OPD volume"],
                    ["Sustainability", "Carbon, water reuse, green metrics"],
                    ["Projects",       "Capital works and mitigation projects"],
                  ].map(([name, desc]) => (
                    <li key={name}>
                      <span>{name}</span>
                      <span className="muted">{desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
