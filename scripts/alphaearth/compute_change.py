#!/usr/bin/env python3
"""
Compute per-pixel L2 distance between two AlphaEarth GeoTIFFs (consecutive years)
and write a colourised PNG + bounds JSON sidecar that the dashboard can render
directly as a deck.gl BitmapLayer.

Usage:
    python3 compute_change.py \
        --year-a apps/web/public/data/alphaearth/raw/alphaearth-chonburi-2023.tif \
        --year-b apps/web/public/data/alphaearth/raw/alphaearth-chonburi-2024.tif \
        --out apps/web/public/data/alphaearth/change-chonburi-2023-2024.png
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import numpy as np
except ImportError:
    print("numpy not installed. Run: python3 -m pip install --user numpy", file=sys.stderr)
    sys.exit(2)

try:
    import rasterio
except ImportError:
    print("rasterio not installed. Run: python3 -m pip install --user rasterio", file=sys.stderr)
    sys.exit(2)

try:
    from PIL import Image
except ImportError:
    print("Pillow not installed. Run: python3 -m pip install --user pillow", file=sys.stderr)
    sys.exit(2)


# Amber → red ramp anchored on the dashboard's --amber token. Low change is
# transparent so the basemap reads through. The ramp is intentionally narrow
# (single hue family) per Visual-DNA rule #1 — one accent, always.
RAMP = [
    (0.00, (245, 158,  11,   0)),  # transparent
    (0.50, (245, 158,  11,  60)),
    (0.75, (245, 158,  11, 140)),
    (0.90, (234, 124,   0, 200)),
    (1.00, (220,  60,   0, 240)),
]


def ramp_color(t: float) -> tuple[int, int, int, int]:
    """Interpolate the colour ramp at position t in [0, 1]."""
    for (t0, c0), (t1, c1) in zip(RAMP, RAMP[1:]):
        if t <= t1:
            k = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
            return tuple(int(round(c0[i] + k * (c1[i] - c0[i]))) for i in range(4))  # type: ignore[return-value]
    return RAMP[-1][1]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year-a", type=Path, required=True, help="Earlier year GeoTIFF")
    parser.add_argument("--year-b", type=Path, required=True, help="Later year GeoTIFF")
    parser.add_argument("--out", type=Path, required=True, help="Output PNG path")
    parser.add_argument(
        "--p-low", type=float, default=50.0,
        help="Lower percentile that maps to ramp 0.0 (default 50 — below-median change is transparent)",
    )
    parser.add_argument(
        "--p-high", type=float, default=99.0,
        help="Upper percentile that maps to ramp 1.0 (default 99 — saturate at the 99th percentile)",
    )
    args = parser.parse_args()

    with rasterio.open(args.year_a) as src_a, rasterio.open(args.year_b) as src_b:
        if src_a.shape != src_b.shape:
            raise SystemExit(
                f"Shape mismatch: {args.year_a.name} {src_a.shape} vs "
                f"{args.year_b.name} {src_b.shape}"
            )
        if src_a.count != src_b.count:
            raise SystemExit(
                f"Band count mismatch: {src_a.count} vs {src_b.count}"
            )

        bounds = src_a.bounds  # west, south, east, north
        a = src_a.read().astype(np.float32)  # (bands, H, W)
        b = src_b.read().astype(np.float32)

    # Per-pixel L2 distance across all 64 bands
    diff = a - b
    l2 = np.sqrt(np.einsum("bij,bij->ij", diff, diff))

    p_lo = float(np.percentile(l2, args.p_low))
    p_hi = float(np.percentile(l2, args.p_high))
    span = max(p_hi - p_lo, 1e-9)
    t = np.clip((l2 - p_lo) / span, 0.0, 1.0)

    h, w = t.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    # Vectorised colour-ramp lookup via 256-step table
    table = np.array([ramp_color(i / 255.0) for i in range(256)], dtype=np.uint8)
    idx = (t * 255).astype(np.uint8)
    rgba[:] = table[idx]

    args.out.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, mode="RGBA").save(args.out, "PNG", optimize=True)

    # Sidecar JSON the React component reads
    match = re.search(r"(\d{4})", args.year_a.stem)
    year_a = int(match.group(1)) if match else 0
    match = re.search(r"(\d{4})", args.year_b.stem)
    year_b = int(match.group(1)) if match else 0

    sidecar = args.out.with_suffix(".json")
    sidecar.write_text(
        json.dumps(
            {
                "image": args.out.name,
                "bounds": {
                    "west": bounds.left,
                    "south": bounds.bottom,
                    "east": bounds.right,
                    "north": bounds.top,
                },
                "years": {"a": year_a, "b": year_b},
                "stats": {
                    "p_low": p_lo,
                    "p_high": p_hi,
                    "ramp_low_pctile": args.p_low,
                    "ramp_high_pctile": args.p_high,
                    "pixel_count": int(t.size),
                    "max_l2": float(l2.max()),
                    "median_l2": float(np.median(l2)),
                },
                "dataset": "GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL",
            },
            indent=2,
        )
    )

    # Update / create manifest
    manifest_path = args.out.parent / "manifest.json"
    existing: list[dict] = []
    if manifest_path.exists():
        try:
            existing = json.loads(manifest_path.read_text())
        except json.JSONDecodeError:
            existing = []
    existing = [e for e in existing if e.get("image") != args.out.name]
    existing.append(
        {
            "id": args.out.stem,
            "image": args.out.name,
            "sidecar": sidecar.name,
            "years": {"a": year_a, "b": year_b},
        }
    )
    existing.sort(key=lambda e: e.get("id", ""))
    manifest_path.write_text(json.dumps(existing, indent=2))

    out_kb = args.out.stat().st_size / 1024
    print(f"wrote {args.out} ({out_kb:.0f} KB) + {sidecar.name} + manifest.json")
    print(f"  L2 range: 0 → {l2.max():.3f}   median: {np.median(l2):.3f}")
    print(f"  ramp:     p{args.p_low:.0f}={p_lo:.3f} → p{args.p_high:.0f}={p_hi:.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
