import { useEffect, useState } from "react";
import { API_BASE } from "../lib/apiBase";

export interface TwinRelatedItem {
  relation: { id: string; predicate: string; properties?: Record<string, unknown> };
  object: { id: string; kind: string; name: string; lat: number; lng: number; properties: Record<string, unknown> };
  direction: "out" | "in";
}

export interface TwinStatePoint {
  time: string;
  objectId: string;
  metric: string;
  value: number;
  source: string;
  properties?: Record<string, unknown>;
}

interface TwinBuildingData {
  object: { id: string; kind: string; name: string; properties: Record<string, unknown> } | null;
  related: TwinRelatedItem[];
  state: TwinStatePoint[];
}

export function useTwinBuilding(buildingId: string | null) {
  const [data, setData] = useState<TwinBuildingData>({ object: null, related: [], state: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!buildingId) {
      setData({ object: null, related: [], state: [] });
      return;
    }

    const ctrl = new AbortController();
    const { signal } = ctrl;
    const id = buildingId;
    setLoading(true);

    async function fetchTwin() {
      try {
        // Fetch object, related items, and latest state in parallel.
        // AbortController ensures stale requests are cancelled if buildingId changes.
        const [objRes, relRes, stateRes] = await Promise.all([
          fetch(`${API_BASE}/api/twin/objects/${encodeURIComponent(id)}`, { signal }).then((r) => (r.ok ? r.json() : null)),
          fetch(`${API_BASE}/api/twin/objects/${encodeURIComponent(id)}/related`, { signal }).then((r) => (r.ok ? r.json() : { items: [] })),
          fetch(`${API_BASE}/api/twin/state?objectId=${encodeURIComponent(id)}&limit=10`, { signal }).then((r) => (r.ok ? r.json() : { items: [] })),
        ]);

        if (!signal.aborted) {
          setData({
            object: objRes,
            related: relRes.items ?? [],
            state: stateRes.items ?? [],
          });
        }
      } catch (err) {
        if (signal.aborted) return;
        setData({ object: null, related: [], state: [] });
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }

    fetchTwin();
    return () => {
      ctrl.abort();
    };
  }, [buildingId]);

  return { ...data, loading };
}
