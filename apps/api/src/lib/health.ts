// Adapter health tracking — circuit-breaker pattern + detailed status.
// Each adapter reports: last success, last error, consecutive failures,
// and a computed status (healthy / degraded / down).

export type AdapterStatus = "healthy" | "degraded" | "down" | "unknown";

export interface AdapterHealth {
  name: string;
  status: AdapterStatus;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  consecutiveFailures: number;
  totalCalls: number;
  totalErrors: number;
  ageMinutes: number | null;
}

const HEALTH = new Map<string, AdapterHealth>();

const DEGRADED_THRESHOLD = 3;   // consecutive failures → degraded
const DOWN_THRESHOLD = 5;       // consecutive failures → down
const STALE_MINUTES = 30;       // no success in 30 min → degraded regardless

export function getAdapterHealth(name: string): AdapterHealth {
  return (
    HEALTH.get(name) ?? {
      name,
      status: "unknown",
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      consecutiveFailures: 0,
      totalCalls: 0,
      totalErrors: 0,
      ageMinutes: null,
    }
  );
}

export function recordAdapterSuccess(name: string, ageMinutes?: number) {
  const h = getAdapterHealth(name);
  h.status = "healthy";
  h.lastSuccessAt = new Date().toISOString();
  h.consecutiveFailures = 0;
  h.totalCalls++;
  h.ageMinutes = ageMinutes ?? null;
  HEALTH.set(name, h);
}

export function recordAdapterError(name: string, message: string) {
  const h = getAdapterHealth(name);
  h.lastErrorAt = new Date().toISOString();
  h.lastErrorMessage = message;
  h.consecutiveFailures++;
  h.totalCalls++;
  h.totalErrors++;

  if (h.consecutiveFailures >= DOWN_THRESHOLD) {
    h.status = "down";
  } else if (h.consecutiveFailures >= DEGRADED_THRESHOLD) {
    h.status = "degraded";
  } else {
    // If previously healthy but stale, keep degraded
    const stale = h.ageMinutes !== null && h.ageMinutes > STALE_MINUTES;
    h.status = stale ? "degraded" : h.status === "down" ? "degraded" : "healthy";
  }
  HEALTH.set(name, h);
}

/** Mark an adapter as stale (no fresh data) without an explicit error. */
export function recordAdapterStale(name: string, ageMinutes: number) {
  const h = getAdapterHealth(name);
  h.ageMinutes = ageMinutes;
  if (ageMinutes > STALE_MINUTES && h.status === "healthy") {
    h.status = "degraded";
  }
  HEALTH.set(name, h);
}

export function getAllHealth(): AdapterHealth[] {
  return Array.from(HEALTH.values());
}

/** Overall system status derived from individual adapters. */
export function getSystemStatus(): { status: AdapterStatus; healthy: number; degraded: number; down: number; total: number } {
  const all = getAllHealth();
  const healthy = all.filter((a) => a.status === "healthy").length;
  const degraded = all.filter((a) => a.status === "degraded").length;
  const down = all.filter((a) => a.status === "down").length;
  const total = all.length;

  let status: AdapterStatus = "healthy";
  if (down > 0) status = "degraded";
  if (down > total * 0.3 || degraded + down > total * 0.5) status = "down";

  return { status, healthy, degraded, down, total };
}

/** Whether a given adapter is currently open for traffic (circuit closed). */
export function isCircuitOpen(name: string): boolean {
  const h = getAdapterHealth(name);
  return h.status !== "down";
}
