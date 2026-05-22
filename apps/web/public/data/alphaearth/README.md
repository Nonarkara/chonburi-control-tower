# AlphaEarth runtime data

Files in this directory are loaded by the dashboard's AlphaEarth change-overlay layer at runtime. They are produced by the Python pipeline under [`scripts/alphaearth/`](../../../../scripts/alphaearth/).

- `manifest.json` — index of available change rasters, auto-maintained by `compute_change.py`.
- `change-*.png` — per-AOI per-year-pair colourised RGBA rasters.
- `change-*.json` — bounds + percentile statistics sidecar for each PNG.
- `raw/` — gitignored. Holds the 64-band source GeoTIFFs that `compute_change.py` reads.

To regenerate: see [`scripts/alphaearth/README.md`](../../../../scripts/alphaearth/README.md).
