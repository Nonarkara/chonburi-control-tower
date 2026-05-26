import { useEffect, useState } from "react";
import { API_BASE } from "../lib/apiBase";

export type SystemStatus = "healthy" | "degraded" | "down" | "unknown";

export interface AdapterHealth {
  name: string;
  status: SystemStatus;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  consecutiveFailures: number;
  totalCalls: number;
  totalErrors: number;
  ageMinutes: number | null;
}

interface HealthResponse {
  system: {
    status: SystemStatus;
    healthy: number;
    degraded: number;
    down: number;
    total: number;
  };
  adapters: AdapterHealth[];
  mqtt: { connected: boolean; messageCount: number; lastError: string | null };
  at: string;
}

export function useSystemHealth(pollMs = 30_000) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchHealth() {
      try {
        const res = await fetch(`${API_BASE}/api/health/detailed`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as HealthResponse;
        if (!cancelled) {
          setHealth(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }
    fetchHealth();
    const id = setInterval(fetchHealth, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs]);

  return { health, error };
}
