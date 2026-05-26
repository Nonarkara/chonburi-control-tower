import { useEffect, useMemo, useState } from "react";
import { Tile3DLayer } from "@deck.gl/geo-layers";

interface Props {
  visible: boolean;
  tilesetUrl?: string;
}

export function useTile3DLayer({ visible, tilesetUrl }: Props) {
  const [tilesetLoaded, setTilesetLoaded] = useState(false);

  useEffect(() => {
    if (!visible || !tilesetUrl) return;
    setTilesetLoaded(false);
  }, [visible, tilesetUrl]);

  // Memoize the layer instance so the reference is stable across renders —
  // a new object every render would force deck.gl to re-diff all tile state.
  return useMemo(() => {
    if (!visible || !tilesetUrl) return null;
    return new Tile3DLayer({
      id: "tile-3d-layer",
      data: tilesetUrl,
      onTilesetLoad: (ts: unknown) => {
        setTilesetLoaded(true);
        if (import.meta.env.DEV) console.log("[Tile3DLayer] Tileset loaded", ts);
      },
      onTileLoad: (tile: unknown) => { void tile; },
      onTileError: (err: unknown) => {
        if (import.meta.env.DEV) console.error("[Tile3DLayer] Tile error", err);
      },
      getFillColor: [210, 215, 225, 235] as [number, number, number, number],
      getLineColor: [180, 190, 210, 160] as [number, number, number, number],
      pointSize: 1,
      getPointColor: [255, 255, 255],
      pickable: true,
      opacity: 0.95,
      // Higher MSE = fewer tiles loaded simultaneously → smoother panning.
      maximumScreenSpaceError: 16,
      _: { tilesetLoaded },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, tilesetUrl, tilesetLoaded]);
}
