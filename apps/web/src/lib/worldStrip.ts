/**
 * Pure display helpers for the WorldStrip component —
 * extracted for unit testing.
 */

import type { PrecipNowcast } from "@chonburi/shared";

/**
 * Convert a wind bearing (0–360°) to a compass direction label.
 * Returns "—" for null.
 */
export function windDirLabel(deg: number | null): string {
  if (deg == null) return "—";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
  return dirs[Math.round(deg / 45) % 8];
}

export interface UvBand {
  label: string;
  color: string;
}

/**
 * Classify a UV index into a severity band with display label and CSS colour token.
 *
 * WHO UV index scale:
 *   < 3  → low
 *   < 6  → moderate
 *   < 8  → high
 *   < 11 → very high
 *   ≥ 11 → extreme
 */
export function uvBand(uv: number | null): UvBand {
  if (uv == null) return { label: "—", color: "var(--text-3)" };
  if (uv < 3)  return { label: "low",       color: "var(--good)" };
  if (uv < 6)  return { label: "moderate",  color: "var(--warn)" };
  if (uv < 8)  return { label: "high",      color: "var(--bad)" };
  if (uv < 11) return { label: "very high", color: "var(--bad)" };
  return { label: "extreme", color: "var(--crit)" };
}

/**
 * Returns a CSS colour token based on whether `n` exceeds warn/bad thresholds.
 * Used to colour pulse-count badges in the WorldStrip.
 */
export function pulseColor(n: number, warn: number, bad: number): string {
  if (n >= bad) return "var(--bad)";
  if (n >= warn) return "var(--warn)";
  return "var(--text)";
}

export interface AqiBand {
  label: string;
  color: string;
}

/**
 * Classify an AQI value into a display band with label and CSS colour token.
 * Follows US EPA standard breakpoints (0–50 good, 51–100 moderate, etc.).
 */
export function aqiBand(aqi: number | null): AqiBand {
  if (aqi == null) return { label: "—", color: "var(--text-3)" };
  if (aqi <= 50)  return { label: "good",          color: "var(--good)" };
  if (aqi <= 100) return { label: "moderate",       color: "var(--warn)" };
  if (aqi <= 150) return { label: "unhealthy SG",   color: "var(--bad)" };
  if (aqi <= 200) return { label: "unhealthy",      color: "var(--bad)" };
  return                  { label: "hazardous",     color: "var(--crit)" };
}

export interface RainBadge {
  label: string;
  sub: string;
  color: string;
}

/**
 * Derive a compact rain badge (label + subtitle + colour) from a PrecipNowcast object.
 * Used in the WorldStrip host block to show current / upcoming rain status.
 */
export function rainBadge(p: PrecipNowcast | null): RainBadge {
  if (!p) return { label: "—", sub: "rain nowcast loading", color: "var(--text-3)" };
  if (p.intensity === "dry") {
    return { label: "DRY 2H", sub: `${p.total2hMm.toFixed(1)} mm forecast`, color: "var(--good)" };
  }
  const mins = p.minutesToSignificant;
  if (p.intensity === "heavy") {
    return {
      label: mins != null ? `RAIN ${mins}m` : "RAIN NOW",
      sub: `peak ${p.peakMm} mm · ${p.total2hMm.toFixed(1)} mm / 2h`,
      color: "var(--bad)",
    };
  }
  if (p.intensity === "moderate") {
    return {
      label: mins != null ? `RAIN ${mins}m` : "RAIN NOW",
      sub: `peak ${p.peakMm} mm · ${p.total2hMm.toFixed(1)} mm / 2h`,
      color: "var(--warn)",
    };
  }
  // light
  return {
    label: mins != null ? `DRIZZLE ${mins}m` : "DRIZZLE",
    sub: `peak ${p.peakMm} mm · ${p.total2hMm.toFixed(1)} mm / 2h`,
    color: "var(--data)",
  };
}

/**
 * Format an ISO timestamp string as "HH:MM" in the given IANA timezone.
 * Returns "—" for null or invalid input.
 */
export function hmFromIso(iso: string | null, tz = "Asia/Bangkok"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export interface TimeInTz {
  hms: string;   // "HH:MM:SS"
  hm: string;    // "HH:MM"
  offset: string; // e.g. "GMT+7"
}

/**
 * Format the current time (a Date) in the given IANA timezone.
 * Returns hms (with seconds), hm (without), and the short UTC-offset string.
 */
export function timeInTz(tz: string, now: Date): TimeInTz {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hms = `${get("hour")}:${get("minute")}:${get("second")}`;
  const hm = `${get("hour")}:${get("minute")}`;
  const offFmt = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "shortOffset" });
  const offset = offFmt.formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "";
  return { hms, hm, offset };
}
