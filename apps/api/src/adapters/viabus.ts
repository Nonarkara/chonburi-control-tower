/**
 * ViaBus — Thai bus tracking platform. They run the CU POP Bus realtime GPS
 * feed (and most Bangkok municipal buses). Their public API is not openly
 * documented; access is granted per partnership.
 *
 * To wire this up:
 *   1. Email partnership@viabus.co (or contact via https://viabus.co)
 *      Mention: CU Smart City project, Samyan/Patumwan campus, needs
 *      realtime vehicle position + route status for CU POP Bus lines 1–5.
 *   2. Set VIABUS_TOKEN in the API env (Cloudflare Workers secret or
 *      apps/api .env for the Node runtime).
 *   3. Optionally set VIABUS_BASE_URL if they give you a custom host.
 *
 * Endpoint shape (best-guess from observed traffic in their app — confirm
 * with the contract you receive):
 *
 *   GET {VIABUS_BASE_URL}/v1/operators/cu-pop-bus/vehicles
 *     → { vehicles: [{ id, line, lat, lng, bearing, speedKmh, occupancy, updatedAt }] }
 *
 *   GET {VIABUS_BASE_URL}/v1/operators/cu-pop-bus/routes/{lineId}/status
 *     → { line, vehiclesInService, headwayMinutes, lastUpdate }
 *
 * Returns null if no token configured OR upstream fails — caller (cuShuttle)
 * then falls back to its own endpoint guesses + scenario data.
 */

import { fetchJsonOrNull } from "./common.js";

export interface ViabusVehicle {
  id: string;
  line: string;
  lat: number;
  lng: number;
  bearing?: number;
  speedKmh?: number;
  occupancy?: "low" | "medium" | "high" | "unknown";
  updatedAt: string;
}

const DEFAULT_BASE = "https://api.viabus.co";
const OPERATOR_SLUG = "cu-pop-bus";

export async function fetchViabusCuShuttle(env: {
  VIABUS_TOKEN?: string;
  VIABUS_BASE_URL?: string;
}): Promise<ViabusVehicle[] | null> {
  const token = env.VIABUS_TOKEN;
  if (!token) return null;
  const base = env.VIABUS_BASE_URL || DEFAULT_BASE;

  const url = `${base.replace(/\/$/, "")}/v1/operators/${OPERATOR_SLUG}/vehicles`;
  const payload = await fetchJsonOrNull<{ vehicles?: ViabusVehicle[] }>(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!payload?.vehicles || payload.vehicles.length === 0) return null;
  return payload.vehicles;
}
