import { useEffect, useRef, useState } from "react";

/**
 * In-browser WiFi/network speed gauge.
 *
 * We don't pull a heavyweight Speedtest SDK — instead we time the download
 * of a known asset (~1.1 MB) and compute Mbps. RTT is taken from
 * `navigator.connection.rtt` when available, otherwise the time-to-first-byte
 * of the fetch.
 *
 * Result is stored in localStorage so the WiFi layer can refresh against
 * the user's measured speed at next reload.
 */

const ASSET_URL = "/maps/cu-map-2015.png"; // ~1.1 MB image we already ship

interface Measurement {
  mbps: number;
  rttMs: number;
  at: string;
  lng: number | null;
  lat: number | null;
  source: "browser-timed";
}

const STORAGE_KEY = "chonburi:speedtest";

function readSaved(): Measurement | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Measurement;
  } catch {
    return null;
  }
}

function geolocate(): Promise<{ lng: number; lat: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
      () => resolve(null),
      { maximumAge: 60_000, timeout: 6_000 },
    );
  });
}

export function SpeedTestPanel() {
  const [last, setLast] = useState<Measurement | null>(() => readSaved());
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (last) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(last));
  }, [last]);

  const run = async () => {
    if (running) return;
    setRunning(true);
    setErr(null);
    const t0 = performance.now();
    try {
      // Add a cache-buster so we measure network, not a 304.
      const url = `${ASSET_URL}?_=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const blob = await res.blob();
      const t1 = performance.now();
      const elapsedMs = Math.max(1, t1 - t0);
      const bits = blob.size * 8;
      const mbps = bits / (elapsedMs / 1000) / 1_000_000;

      // RTT: prefer Network Information API, else ttfb-ish ≈ 100 ms heuristic
      const navConn = (navigator as Navigator & { connection?: { rtt?: number } }).connection;
      const rttMs = navConn?.rtt ?? 30;

      const where = await geolocate();
      const m: Measurement = {
        mbps: Number(mbps.toFixed(1)),
        rttMs,
        at: new Date().toISOString(),
        lng: where?.lng ?? null,
        lat: where?.lat ?? null,
        source: "browser-timed",
      };
      if (mounted.current) setLast(m);
    } catch (e) {
      if (mounted.current) setErr(e instanceof Error ? e.message : String(e));
    } finally {
      if (mounted.current) setRunning(false);
    }
  };

  return (
    <div className="speedtest-panel">
      <div className="speedtest-head">
        <span className="eyebrow mono">WiFi · speed test</span>
        <button
          type="button"
          className="speedtest-go mono"
          onClick={run}
          disabled={running}
          aria-label="Run a download-timing speed test"
        >
          {running ? "…" : "RUN"}
        </button>
      </div>
      <div className="speedtest-row">
        <div className="speedtest-stat">
          <span className="lbl">DOWN</span>
          <span className="val mono">{last ? `${last.mbps}` : "—"}</span>
          <span className="sub mono">Mbps</span>
        </div>
        <div className="speedtest-stat">
          <span className="lbl">RTT</span>
          <span className="val mono">{last ? last.rttMs : "—"}</span>
          <span className="sub mono">ms</span>
        </div>
        <div className="speedtest-stat">
          <span className="lbl">FIX</span>
          <span className="val mono" style={{ fontSize: "0.74rem", letterSpacing: 0 }}>
            {last?.lng != null && last?.lat != null
              ? `${last.lat.toFixed(4)}, ${last.lng.toFixed(4)}`
              : "—"}
          </span>
        </div>
      </div>
      {err && <div className="speedtest-err mono">⚠ {err}</div>}
      {last && (
        <div className="speedtest-foot mono">
          {new Date(last.at).toLocaleTimeString("en-GB")} · {last.source}
        </div>
      )}
    </div>
  );
}
