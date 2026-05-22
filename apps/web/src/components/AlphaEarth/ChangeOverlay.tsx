import { useEffect, useMemo, useState } from "react";
import { BitmapLayer } from "@deck.gl/layers";

const MANIFEST_URL = "/data/alphaearth/manifest.json";
const DATA_DIR = "/data/alphaearth/";

export interface AlphaEarthManifestEntry {
  id: string;
  image: string;
  sidecar: string;
  years: { a: number; b: number };
}

export interface AlphaEarthSidecar {
  image: string;
  bounds: { west: number; south: number; east: number; north: number };
  years: { a: number; b: number };
  stats: {
    p_low: number;
    p_high: number;
    ramp_low_pctile: number;
    ramp_high_pctile: number;
    pixel_count: number;
    max_l2: number;
    median_l2: number;
  };
  dataset: string;
}

export interface AlphaEarthState {
  loading: boolean;
  manifest: AlphaEarthManifestEntry[];
  active: { entry: AlphaEarthManifestEntry; sidecar: AlphaEarthSidecar } | null;
}

/**
 * Loads the AlphaEarth manifest + the newest sidecar JSON. The picked entry
 * drives both the deck.gl BitmapLayer (via useChangeOverlayLayer below) and
 * any UI surface that wants to label what year-pair is on screen.
 */
export function useAlphaEarthState(): AlphaEarthState {
  const [state, setState] = useState<AlphaEarthState>({
    loading: true,
    manifest: [],
    active: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(MANIFEST_URL);
        if (!res.ok) throw new Error(`manifest ${res.status}`);
        const manifest = (await res.json()) as AlphaEarthManifestEntry[];
        if (manifest.length === 0) {
          if (!cancelled) setState({ loading: false, manifest: [], active: null });
          return;
        }
        const newest = manifest[manifest.length - 1];
        const sidecarRes = await fetch(DATA_DIR + newest.sidecar);
        if (!sidecarRes.ok) throw new Error(`sidecar ${sidecarRes.status}`);
        const sidecar = (await sidecarRes.json()) as AlphaEarthSidecar;
        if (!cancelled) {
          setState({ loading: false, manifest, active: { entry: newest, sidecar } });
        }
      } catch {
        if (!cancelled) setState({ loading: false, manifest: [], active: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

interface LayerProps {
  visible: boolean;
  state: AlphaEarthState;
  opacity?: number;
}

export function useChangeOverlayLayer({ visible, state, opacity = 0.85 }: LayerProps) {
  return useMemo(() => {
    if (!visible || !state.active) return null;
    const { sidecar, entry } = state.active;
    const { west, south, east, north } = sidecar.bounds;
    return new BitmapLayer({
      id: "alphaearth-change",
      image: DATA_DIR + entry.image,
      bounds: [west, south, east, north],
      opacity,
      pickable: false,
      parameters: { depthTest: false },
    });
  }, [visible, state.active, opacity]);
}
