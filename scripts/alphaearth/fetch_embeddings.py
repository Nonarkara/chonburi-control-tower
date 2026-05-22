#!/usr/bin/env python3
"""
Fetch AlphaEarth Satellite Embedding rasters for a bounding box + year range
and export them to local GeoTIFF files.

Usage:
    python3 fetch_embeddings.py --aoi chonburi --years 2023 2024
    python3 fetch_embeddings.py --bbox 100.965 13.342 101.005 13.380 \
        --years 2023 2024 --out apps/web/public/data/alphaearth

The Earth Engine collection ID and one-line auth setup are documented in
scripts/alphaearth/README.md.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

try:
    import ee
except ImportError:
    print(
        "earthengine-api is not installed. Run:\n"
        "  python3 -m pip install --user earthengine-api\n"
        "Then authenticate with:\n"
        "  python3 -m ee.cli.eecli authenticate    # or `earthengine authenticate`",
        file=sys.stderr,
    )
    sys.exit(2)


EMBEDDING_DATASET = "GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL"

# Named AOIs. Keep these in sync with the dashboards' default-view bounding boxes
# so the rasters always align with what the user sees on the basemap.
AOIS: dict[str, tuple[float, float, float, float]] = {
    # west, south, east, north — matches CHONBURI.outerBounds in
    # packages/shared/src/campus.ts
    "chonburi": (100.965, 13.342, 101.005, 13.380),
}


def init_ee() -> None:
    """Initialise Earth Engine using either a service-account key or the user
    credentials saved by `earthengine authenticate`."""
    svc_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    project = os.environ.get("EE_PROJECT")
    if svc_json:
        with open(svc_json) as fh:
            email = json.load(fh)["client_email"]
        credentials = ee.ServiceAccountCredentials(email, svc_json)
        ee.Initialize(credentials=credentials, project=project)
    else:
        ee.Initialize(project=project)


def fetch_year_geotiff(
    bbox: tuple[float, float, float, float],
    year: int,
    out_path: Path,
    scale: int = 10,
) -> None:
    """Fetch one year's 64-band embedding raster as a GeoTIFF via Earth
    Engine's getDownloadURL. For city-scale AOIs the file fits comfortably
    under the 50 MB single-download limit."""
    west, south, east, north = bbox
    region = ee.Geometry.Rectangle([west, south, east, north])

    img = (
        ee.ImageCollection(EMBEDDING_DATASET)
        .filterDate(f"{year}-01-01", f"{year + 1}-01-01")
        .filterBounds(region)
        .first()
    )
    if img is None:
        raise RuntimeError(f"No embedding image found for {year} in bbox {bbox}")

    img = ee.Image(img).clip(region)

    url = img.getDownloadURL(
        {
            "scale": scale,
            "region": region,
            "format": "GEO_TIFF",
            "crs": "EPSG:4326",
        }
    )

    print(f"  fetching {year} → {out_path.name}")
    urllib.request.urlretrieve(url, out_path)
    size_kb = out_path.stat().st_size / 1024
    print(f"    {size_kb:.0f} KB")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--aoi", choices=sorted(AOIS), help="Named AOI (defined in this script)"
    )
    group.add_argument(
        "--bbox",
        nargs=4,
        type=float,
        metavar=("WEST", "SOUTH", "EAST", "NORTH"),
        help="Custom bounding box in lat/lng (EPSG:4326)",
    )
    parser.add_argument(
        "--years", nargs="+", type=int, required=True, help="Year(s) to fetch"
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("apps/web/public/data/alphaearth/raw"),
        help="Output directory for GeoTIFFs",
    )
    parser.add_argument(
        "--scale", type=int, default=10, help="Pixel scale in metres (default 10)"
    )
    args = parser.parse_args()

    bbox = AOIS[args.aoi] if args.aoi else tuple(args.bbox)
    aoi_label = args.aoi or f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}"

    out_dir = args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    init_ee()

    print(f"AOI: {aoi_label}  bbox: {bbox}  scale: {args.scale} m")
    for year in args.years:
        out_path = out_dir / f"alphaearth-{args.aoi or 'custom'}-{year}.tif"
        if out_path.exists():
            print(f"  {year} already exists at {out_path}, skipping")
            continue
        fetch_year_geotiff(bbox, year, out_path, args.scale)

    print(f"\nDone. {len(args.years)} year(s) written to {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
