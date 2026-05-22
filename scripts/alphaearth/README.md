# AlphaEarth pipeline — Chonburi pilot

Pre-computes year-over-year AlphaEarth Satellite Embedding change rasters for the Chonburi Town Municipality bounding box and writes a colourised PNG + bounds JSON into `apps/web/public/data/alphaearth/`. The dashboard reads those files via a `BitmapLayer` — no Earth Engine calls at runtime.

Read [`docs/ALPHAEARTH_NOTES.md`](../../docs/ALPHAEARTH_NOTES.md) first for what AlphaEarth is, what it can / can't do, and the model-version upgrade story. This file documents the pilot pipeline only.

---

## One-time setup

```bash
# 1. Install dependencies
python3 -m pip install --user -r scripts/alphaearth/requirements.txt

# 2. Register a Google Earth Engine project (free, browser flow)
#    https://earthengine.google.com/  →  Sign up  →  Create project
#    Note the project ID (e.g. ee-yourname-chonburi)

# 3. Authenticate the CLI to that project
earthengine authenticate
export EE_PROJECT=ee-yourname-chonburi
```

The credentials land at `~/.config/earthengine/credentials` and persist across runs. The `EE_PROJECT` env var is required for new accounts created after 2025-04.

### Production / CI (service account)

```bash
# Create a service account in the EE-enabled Google Cloud project,
# download its JSON key, and:
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa-key.json
export EE_PROJECT=ee-yourname-chonburi
```

The pipeline auto-detects `GOOGLE_APPLICATION_CREDENTIALS` and falls back to user credentials if it is unset. Neither path is committed to this repo.

---

## Re-bake the Chonburi rasters

```bash
# 1. Fetch the raw 64-band embedding GeoTIFFs for the two years
python3 scripts/alphaearth/fetch_embeddings.py --aoi chonburi --years 2023 2024

# 2. Compute the per-pixel L2 distance + write the colourised PNG + sidecar
python3 scripts/alphaearth/compute_change.py \
    --year-a apps/web/public/data/alphaearth/raw/alphaearth-chonburi-2023.tif \
    --year-b apps/web/public/data/alphaearth/raw/alphaearth-chonburi-2024.tif \
    --out apps/web/public/data/alphaearth/change-chonburi-2023-2024.png
```

The first step takes ~30 s per year for the Chonburi AOI (~16 km² at 10 m). The second step is local-only and takes < 5 s. Each PNG is < 500 KB.

After the run, `apps/web/public/data/alphaearth/` will contain:

```
manifest.json                          # auto-maintained list of available rasters
change-chonburi-2023-2024.png          # colourised RGBA, transparent where change is low
change-chonburi-2023-2024.json         # bounds + percentile stats + dataset version
raw/alphaearth-chonburi-2023.tif       # 64-band raw embedding (kept for re-computing)
raw/alphaearth-chonburi-2024.tif
```

The dashboard loads the `manifest.json` on boot and renders the active overlay via `apps/web/src/components/AlphaEarth/`.

The raw GeoTIFFs (`raw/`) are **not** committed — `apps/web/public/data/alphaearth/raw/` is gitignored. The colourised PNGs and JSON sidecars **are** committed because they are the runtime artefacts the deployed dashboard depends on.

---

## Extending to other AOIs

To add a new AOI (e.g. Padawan Kuching, BMA), edit `AOIS` in `fetch_embeddings.py` with the bounding box, then run:

```bash
python3 scripts/alphaearth/fetch_embeddings.py --aoi kuching --years 2023 2024
python3 scripts/alphaearth/compute_change.py \
    --year-a apps/web/public/data/alphaearth/raw/alphaearth-kuching-2023.tif \
    --year-b apps/web/public/data/alphaearth/raw/alphaearth-kuching-2024.tif \
    --out apps/web/public/data/alphaearth/change-kuching-2023-2024.png
```

For a custom bounding box without naming it, use `--bbox WEST SOUTH EAST NORTH` instead of `--aoi`.

---

## Re-running annually

When the AlphaEarth collection publishes a new year (typically Q1 of the following calendar year), re-run:

```bash
python3 scripts/alphaearth/fetch_embeddings.py --aoi chonburi --years 2024 2025
python3 scripts/alphaearth/compute_change.py \
    --year-a apps/web/public/data/alphaearth/raw/alphaearth-chonburi-2024.tif \
    --year-b apps/web/public/data/alphaearth/raw/alphaearth-chonburi-2025.tif \
    --out apps/web/public/data/alphaearth/change-chonburi-2024-2025.png
```

Then commit the updated `apps/web/public/data/alphaearth/*.png` + `*.json` + `manifest.json`. The component picks the newest entry by default.
