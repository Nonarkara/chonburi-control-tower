import { useCallback, useEffect, useState } from "react";

export interface DevicePresence {
  state: "idle" | "asking" | "granted" | "denied" | "unsupported" | "error";
  // last known fix
  lng: number | null;
  lat: number | null;
  accuracyM: number | null;
  altitudeM: number | null;
  headingDeg: number | null;
  speedMs: number | null;
  fixedAt: string | null;
  // browser network metadata
  network: {
    type: string | null;        // "wifi" | "cellular" | "ethernet" | "unknown" | "none"
    effective: string | null;   // "4g" / "3g" / etc — Network Information API
    downlinkMbps: number | null;
    rttMs: number | null;
    saveData: boolean | null;
  };
  // derived: are we inside the municipality area?
  insideArea: boolean | null;
  err: string | null;
}

const EMPTY: DevicePresence = {
  state: "idle",
  lng: null, lat: null,
  accuracyM: null, altitudeM: null, headingDeg: null, speedMs: null,
  fixedAt: null,
  network: { type: null, effective: null, downlinkMbps: null, rttMs: null, saveData: null },
  insideArea: null,
  err: null,
};

// Outer Chonburi Town Municipality bbox.
const OUTER = {
  minLng: 100.940, minLat: 13.320,
  maxLng: 101.030, maxLat: 13.410,
};
const inOuterBox = (lng: number, lat: number) =>
  lng >= OUTER.minLng && lng <= OUTER.maxLng &&
  lat >= OUTER.minLat && lat <= OUTER.maxLat;

function readNetwork(): DevicePresence["network"] {
  const c = (navigator as Navigator & { connection?: {
    type?: string; effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean;
  } }).connection;
  if (!c) return EMPTY.network;
  return {
    type: c.type ?? null,
    effective: c.effectiveType ?? null,
    downlinkMbps: c.downlink ?? null,
    rttMs: c.rtt ?? null,
    saveData: c.saveData ?? null,
  };
}

/**
 * Hook for logging this computer into the dashboard by GPS:
 *
 *  - Calls `request()` to ask the browser for permission (geolocation).
 *  - Once granted it watches position continuously so the on-map dot
 *    tracks the device.
 *  - Pulls Network Information API metadata (connection type / 4g / wifi
 *    / Mbps / RTT) and refreshes when it changes.
 *  - Derives `insideArea` from the outer bbox so the UI can flag a
 *    visitor vs an in-area operator.
 */
export function useDevicePresence(): {
  presence: DevicePresence;
  request: () => void;
  clear: () => void;
} {
  const [presence, setPresence] = useState<DevicePresence>(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      return { ...EMPTY, state: "unsupported", err: "geolocation not supported" };
    }
    return EMPTY;
  });

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    setPresence((p) => ({ ...p, state: "asking", err: null }));
    navigator.geolocation.getCurrentPosition(
      () => {
        // permission accepted — start a watch
        setPresence((p) => ({ ...p, state: "granted", network: readNetwork() }));
      },
      (err) => {
        setPresence((p) => ({
          ...p,
          state: err.code === 1 ? "denied" : "error",
          err: err.message,
        }));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8_000 },
    );
  }, []);

  const clear = useCallback(() => setPresence(EMPTY), []);

  // Continuous watch — only runs after state === "granted"
  useEffect(() => {
    if (presence.state !== "granted") return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { longitude, latitude, accuracy, altitude, heading, speed } = pos.coords;
        setPresence((p) => ({
          ...p,
          lng: longitude,
          lat: latitude,
          accuracyM: accuracy ?? null,
          altitudeM: altitude ?? null,
          headingDeg: heading ?? null,
          speedMs: speed ?? null,
          fixedAt: new Date(pos.timestamp).toISOString(),
          insideArea: inOuterBox(longitude, latitude),
          network: readNetwork(),
        }));
      },
      (err) => setPresence((p) => ({ ...p, state: "error", err: err.message })),
      { enableHighAccuracy: true, maximumAge: 0 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [presence.state]);

  // React to network changes (some browsers fire 'change' on navigator.connection)
  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: EventTarget }).connection;
    if (!conn || !("addEventListener" in conn)) return;
    const onChange = () => setPresence((p) => ({ ...p, network: readNetwork() }));
    conn.addEventListener("change", onChange);
    return () => conn.removeEventListener("change", onChange);
  }, []);

  return { presence, request, clear };
}
