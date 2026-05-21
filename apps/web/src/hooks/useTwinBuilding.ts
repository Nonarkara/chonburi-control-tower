import { useEffect, useState } from "react";

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

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

export function useTwinBuilding(buildingId: string | null) {
  const [data, setData] = useState<TwinBuildingData>({ object: null, related: [], state: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!buildingId) {
      setData({ object: null, related: [], state: [] });
      return;
    }

    const id = buildingId; // narrowed to string — null guard is above
    let cancelled = false;
    setLoading(true);

    async function fetchTwin() {
      try {
        // Fetch object, related items, and latest state in parallel
        const [objRes, relRes, stateRes] = await Promise.all([
          fetch(`${API_BASE}/api/twin/objects/${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)),
          fetch(`${API_BASE}/api/twin/objects/${encodeURIComponent(id)}/related`).then((r) => (r.ok ? r.json() : { items: [] })),
          fetch(`${API_BASE}/api/twin/state?objectId=${encodeURIComponent(id)}&limit=10`).then((r) => (r.ok ? r.json() : { items: [] })),
        ]);

        if (!cancelled) {
          setData({
            object: objRes,
            related: relRes.items ?? [],
            state: stateRes.items ?? [],
          });
        }
      } catch {
        if (!cancelled) setData({ object: null, related: [], state: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTwin();
    return () => {
      cancelled = true;
    };
  }, [buildingId]);

  return { ...data, loading };
}
