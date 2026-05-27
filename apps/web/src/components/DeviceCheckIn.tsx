import type { DevicePresence } from "../hooks/useDevicePresence";
import { fmtCoord, fmtAccuracy, networkLabel } from "../lib/device";

interface Props {
  presence: DevicePresence;
  onRequest: () => void;
  onClear: () => void;
}

/**
 * DeviceCheckIn — left-rail panel that prompts the user to log this
 * computer into the dashboard by GPS only. After permission, shows the
 * fix, accuracy, network, and whether the device is inside the municipal
 * bounding box.
 */
export function DeviceCheckIn({ presence, onRequest, onClear }: Props) {
  const { state, lng, lat, accuracyM, fixedAt, network, insideArea } = presence;

  return (
    <section className="device-card">
      <header className="device-card-head">
        <span className="eyebrow mono">Device check-in · GPS only</span>
        {state === "granted" ? (
          <button type="button" onClick={onClear} className="mono device-clear" aria-label="Clear GPS fix">
            CLEAR
          </button>
        ) : null}
      </header>

      {state !== "granted" && (
        <div className="device-empty">
          <p className="device-explain">
            Log this computer into the system by GPS. We read your fix locally
            (the browser permission popup gates it) — nothing is sent anywhere.
            Used to anchor the WiFi survey + identify which building you're in.
          </p>
          <button
            type="button"
            onClick={onRequest}
            disabled={state === "asking"}
            className="device-go mono"
          >
            {state === "asking"
              ? "WAITING FOR BROWSER…"
              : state === "denied"
                ? "PERMISSION DENIED — RETRY"
                : state === "unsupported"
                  ? "GEOLOCATION UNSUPPORTED"
                  : state === "error"
                    ? "RETRY"
                    : "REQUEST GPS FIX"}
          </button>
          {presence.err && <div className="device-err mono">⚠ {presence.err}</div>}
        </div>
      )}

      {state === "granted" && (
        <div className="device-detail">
          <div className="device-row">
            <span className="lbl">FIX</span>
            <span className="val mono">
              {fmtCoord(lat)}, {fmtCoord(lng)}
            </span>
          </div>
          <div className="device-row">
            <span className="lbl">ACCURACY</span>
            <span className="val mono">{fmtAccuracy(accuracyM)}</span>
          </div>
          <div className="device-row">
            <span className="lbl">NETWORK</span>
            <span className="val">{networkLabel(network)}</span>
          </div>
          {(network.downlinkMbps != null || network.rttMs != null) && (
            <div className="device-row">
              <span className="lbl">LINK</span>
              <span className="val mono">
                {network.downlinkMbps != null ? `${network.downlinkMbps} Mbps` : "—"}
                {network.rttMs != null ? ` · ${network.rttMs} ms` : ""}
              </span>
            </div>
          )}
          <div className="device-row">
            <span className="lbl">AREA</span>
            <span
              className="val mono"
              style={{ color: insideArea ? "var(--good)" : "var(--bad)" }}
            >
              {insideArea == null ? "—" : insideArea ? "✓ IN AREA" : "OUT OF AREA"}
            </span>
          </div>
          {fixedAt && (
            <div className="device-foot mono">
              FIX {new Date(fixedAt).toLocaleTimeString("en-GB")} · watching
            </div>
          )}
        </div>
      )}
    </section>
  );
}
