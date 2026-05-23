# DEVLOG

Append-only. Newest entry at the top.

---

## 2026-05-22 · v0.2.0 — AlphaEarth change-overlay pilot

### Shipped

- **Reference doc** — [`docs/ALPHAEARTH_NOTES.md`](ALPHAEARTH_NOTES.md). Single-source notes on what AlphaEarth is, capabilities + caveats, per-dashboard fit (Chonburi/BMA/SCITI/Kuching = HIGH; oil crisis/Phuket bus = MEDIUM; Chula = LOW), integration shape, cost, version-bump path. Read this before extending AlphaEarth to other dashboards.
- **Python pipeline** — [`scripts/alphaearth/`](../scripts/alphaearth/). Two scripts:
  - `fetch_embeddings.py` — pulls one year's 64-band Satellite Embedding GeoTIFF for a named AOI (or custom bbox). Chonburi bbox baked into `AOIS` matches `CHONBURI.outerBounds` so the rasters align with the basemap.
  - `compute_change.py` — reads two GeoTIFFs, computes per-pixel L2 distance, colourises to RGBA PNG on an amber ramp (single accent per Visual-DNA rule #1), writes a sidecar JSON with bounds + percentile stats, maintains `manifest.json`.
- **Dashboard integration** — new layer `alphaearth-change` plumbed through `presets.ts` → `App.tsx`. Component lives at [`apps/web/src/components/AlphaEarth/`](../apps/web/src/components/AlphaEarth/) with `useAlphaEarthState()` hook + `useChangeOverlayLayer()` hook + a small `AlphaEarthBadge` in the left sidebar showing the active year-pair / stats.
- **Layer position** — Environment lens by default; user-toggleable from the layer palette. Renders as a translucent BitmapLayer between buildings and utility lines.
- **Version stamp** — bottom-bar pill now reads from `package.json` via a `__APP_VERSION__` Vite define. Bumped both root and `@chonburi/web` from `0.1.0` → `0.2.0`.
- **Gitignore** — `apps/web/public/data/alphaearth/raw/` excluded (large 64-band GeoTIFFs, regenerable). EE credential paths excluded.

### Auth setup notes (for repeat bakes)

- Earth Engine authenticated via gcloud application-default credentials at `~/.config/gcloud/application_default_credentials.json`. EE's default OAuth client gets blocked by Google because it requests the Drive scope; gcloud's client is allowed.
- EE-registered Google Cloud project: **tkcx-494310**.
- Default fetch scale dropped from 10 m → **20 m**. AlphaEarth's 64-band embedding at 10 m exceeds EE's 50 MB single-download ceiling for a 4 km² AOI (≈ 100 MB). 20 m is ≈ 12 MB and visually identical at city-map zoom (14–18). To regenerate at 10 m, use the EE batch Export API to Cloud Storage instead.

To re-bake (annually, when a new year publishes):

```bash
export GOOGLE_APPLICATION_CREDENTIALS=""   # use ADC, not service account
python3 scripts/alphaearth/fetch_embeddings.py --aoi chonburi --years 2024 2025
python3 scripts/alphaearth/compute_change.py \
    --year-a apps/web/public/data/alphaearth/raw/alphaearth-chonburi-2024.tif \
    --year-b apps/web/public/data/alphaearth/raw/alphaearth-chonburi-2025.tif \
    --out apps/web/public/data/alphaearth/change-chonburi-2024-2025.png
git add apps/web/public/data/alphaearth/change-chonburi-2024-2025.{png,json} \
        apps/web/public/data/alphaearth/manifest.json
git commit -m "data: bake AlphaEarth change-chonburi-2024-2025"
```

### Open questions for the next pass

- **Which year-pair to bake first?** Default in the pipeline is 2023→2024. If 2024 has just published, 2024→2025 is the more interesting demo. Confirm before the first bake.
- **AOI list.** Pipeline currently knows only `chonburi`. When extending to BMA or Padawan Kuching, add bbox to `AOIS` in `fetch_embeddings.py`.
- **Selector UI.** If/when multiple year-pairs ship (`change-2022-2023`, `change-2023-2024`, …), the badge needs a dropdown to switch between them. Punt until there's > 1 entry in the manifest.
- **Per-pixel inspector.** A click handler that fetches the two underlying year vectors for the clicked pixel and shows the L2 + the dominant bands would make the layer interrogable. Not in the pilot scope.

### Notes

- Visualization chosen is **(a) year-over-year change-vector overlay**, not (b) similarity-cluster map. Rationale: cleaner narrative for the mayor ("here's where Chonburi changed most this year") vs. cluster map's "here are abstract land-type signatures" which needs more explanation per-cluster.
- Following Visual-DNA rule #1: single amber ramp, no second accent colour. Low-change pixels are fully transparent so the basemap reads through; ramp saturates at the 99th percentile so the overlay isn't washed out by a handful of construction-site outliers.
