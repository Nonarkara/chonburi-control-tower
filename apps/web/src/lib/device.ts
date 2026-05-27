/**
 * Pure display helpers for device GPS/network presence —
 * extracted from DeviceCheckIn.tsx for unit testing.
 */

export interface NetworkInfo {
  type: string | null;
  effective: string | null;
  downlinkMbps?: number | null;
  rttMs?: number | null;
  saveData?: boolean | null;
}

/**
 * Format a lat/lng coordinate to fixed decimal places.
 * Returns "—" when value is null.
 */
export function fmtCoord(v: number | null, digits = 5): string {
  return v == null ? "—" : v.toFixed(digits);
}

/**
 * Format a GPS accuracy reading in metres.
 * Returns "—" for null, "< 1 m" for sub-metre, "±N m" otherwise.
 */
export function fmtAccuracy(m: number | null): string {
  if (m == null) return "—";
  if (m < 1) return "< 1 m";
  return `±${Math.round(m)} m`;
}

/**
 * Produce a human-readable network connection label from Network Information API data.
 *
 * Priority: named type (wifi/ethernet/none) → cellular + effective → effective only → "Unknown"
 */
export function networkLabel(net: NetworkInfo): string {
  if (net.type === "wifi") return "Wi-Fi";
  if (net.type === "ethernet") return "Ethernet";
  if (net.type === "cellular" || net.effective) {
    return net.effective ? `Cellular · ${net.effective.toUpperCase()}` : "Cellular";
  }
  if (net.type === "none") return "Offline";
  return net.effective ? net.effective.toUpperCase() : "Unknown";
}
