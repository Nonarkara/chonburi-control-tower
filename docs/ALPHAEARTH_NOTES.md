# AlphaEarth — Reference Notes

Internal cheat sheet for deciding which dashboards to extend AlphaEarth into. Maintained so the same research doesn't happen twice. First version: 2026-05-22.

---

## 1. What it is

**AlphaEarth Foundations** — Google DeepMind's Earth observation foundation model, released mid-2025 (paper: Brown et al. 2025). Released to the public via Google Earth Engine as the **"Satellite Embedding"** dataset (`GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL`).

For every **10 m × 10 m patch** of land on Earth, for every year from **2017 to present**, the model produces a **64-dimensional embedding vector** that distils what that patch "looks like" across many sensors. The embeddings are designed so that semantically similar places (a rice paddy, a shrimp pond, a coastal mangrove, a port apron) cluster together in vector space, and the same place's embedding moves through space as that place changes.

Inputs the model digests:

- **Sentinel-2** (10 m optical, 5-day revisit)
- **Sentinel-1** (10 m SAR, all-weather radar)
- **Landsat 8/9** (30 m optical, longer time baseline)
- **Climate reanalysis** (ERA5 — temperature, precipitation, wind)
- **GEDI / spaceborne LiDAR** (canopy height, terrain structure)
- **DEM** for topography

Output cadence is **annual** — one vector per pixel per calendar year — because the embedding is trained to summarise a full year of observations into one stable representation. Per-month or per-week embeddings are not exposed in the public release.

---

## 2. Access

**Earth Engine** is the only public access path.

- **Python API** (`earthengine-api` package) — preferred for batch pipelines, exports to Cloud Storage, scripted processing.
- **JavaScript Code Editor** at `code.earthengine.google.com` — fine for exploration and small AOIs.
- **BigQuery** — Earth Engine can export to BigQuery; once there, you can run SQL with `ML.DISTANCE`, `ML.MIN_MAX_SCALER`, etc. against the embeddings. Useful when the dashboard needs a queryable backend.

Authentication paths:

- **Personal use** — `earthengine authenticate` opens a browser, you sign in with a Google account that has Earth Engine access registered (free for research / non-commercial). The credential lands at `~/.config/earthengine/credentials` and persists.
- **Production / CI** — a Google Cloud service-account JSON key, with the Earth Engine API enabled on the project. Read via the `GOOGLE_APPLICATION_CREDENTIALS` env var; the Python script uses `ee.Initialize(credentials=ee.ServiceAccountCredentials(...))`.

Pricing: **free** at research scale. Commercial use (revenue-generating product) requires a paid Earth Engine commercial agreement via Google Cloud — pricing depends on compute hours and storage egress.

---

## 3. Capabilities matrix

| Property            | Value                                                              |
|---------------------|--------------------------------------------------------------------|
| Resolution          | 10 m × 10 m                                                        |
| Temporal cadence    | Annual (one vector per calendar year per pixel)                    |
| Time range          | 2017 → present (current year typically lags by 3–6 months)         |
| Coverage            | Global                                                             |
| Vector dimension    | 64                                                                 |
| Native distance     | Cosine similarity / L2 distance both meaningful                    |
| File access         | Earth Engine `ImageCollection`, can export to GeoTIFF / TFRecord   |

### Good for

- **Regional / urban change detection.** Compare consecutive years' vectors per pixel — distance is a clean "how much did this place change?" metric. Catches new construction, deforestation, reclaimed land, paved area, shrimp-pond conversion.
- **Land-use classification.** Cluster embeddings (k-means / GMM) into N classes, label clusters from a few hand-labelled examples. Outperforms classical "NDVI + threshold" approaches in mixed-use Thai cities.
- **Similarity search.** "Show me every place in Chonburi that looks like the Bang Saen beach strip" — pick a reference pixel, return all pixels within ε of it in embedding space.
- **Embedding trajectories.** Track a fixed location's vector through years 2017–2024 — produces a smooth temporal signature that is the same whether the place is changing fast or slow.
- **Cross-modal classification** without separately fusing Sentinel-1 + Sentinel-2 + Landsat yourself.

### Bad for

- **Sub-block detail** — 10 m floor. Cannot see individual buildings, lane-level changes, sidewalk widening. For Chula campus or any intra-campus question the resolution is too coarse.
- **Near-real-time monitoring** — annual cadence. "Did this neighbourhood flood yesterday?" is out of scope. Use Sentinel-1 GRD or MODIS / VIIRS for that.
- **Intra-building changes** — same as sub-block.
- **Event-driven moves** — a market that opens in March and closes in August will likely be averaged out into the annual vector.
- **Sidewalk-level urbanism questions** — too coarse.

---

## 4. Fit across this user's dashboards

**Substrate update (2026-05-27):** the `chonburi-control-tower` repo is now the substrate for three deployments — Nakhon Si Thammarat, Chonburi, and Chulalongkorn campus / CT-01. The fit table is updated to reflect actual customer set, not the original LOW-fit guess for Chula.

| Dashboard                                                   | Fit       | Why                                                                                                    |
|-------------------------------------------------------------|-----------|--------------------------------------------------------------------------------------------------------|
| **Chonburi Town Municipality** (this substrate)             | **HIGH**  | Coastal reclamation, new estates, shrimp-pond expansion, port growth. Live: 2023→2024 baked.           |
| **Chulalongkorn campus / CT-01** (this substrate)           | **HIGH-conditional** | Building-cluster utilisation change, vegetation/greenery delta for Net Zero 2040–2050, embodied-carbon proxy via built-area gain. 10 m floor is fine for quad/cluster scale — not for single lecture-hall occupancy (use AC / IoT for that). Bbox already in `AOIS` dict; ready to bake. |
| **Nakhon Si Thammarat** (this substrate)                    | **HIGH**  | 4-year live deployment; AlphaEarth would add land-change context to the existing citizen-complaint stream. Pending bbox to enter `AOIS`.                          |
| **Thailand smart-city index** (SCITI)                       | **HIGH**  | Per-city change-vector summary as a national metric. Cluster 163 cities by AlphaEarth signature.       |
| **Thailand smart-city monitor**                             | **HIGH**  | Same as above, ongoing telemetry rather than ranking.                                                  |
| **Padawan Kuching IOC**                                     | **HIGH**  | Greater Kuching is mostly low-density expansion zones — perfect AlphaEarth use case.                   |
| **Conflict tracker (globalmonitor)**                        | **HIGH**  | Settlement / agricultural destruction detection in conflict zones is the textbook AlphaEarth task.     |
| **2026 oil crisis dashboard**                               | MEDIUM    | Refinery / storage-tank tracking and land reorganisation around oil infrastructure. Not tanker AIS.    |
| **Phuket smart bus**                                        | MEDIUM    | Population-density / built-up area inference as a route-planning layer. Not for the bus product core.  |
| Day trading, NSP, Axiom, Daoism, Memory Palace, OpenClaw, TKC | NO       | Non-geospatial.                                                                                        |

**Chula carbon angle** — distinct from generic land-change. A separate `scripts/alphaearth/compute_carbon.py` (not yet written) would read the same raw 64-band GeoTIFFs and emit a carbon-relevant delta layer: vegetation index loss (canopy / tree count) + built-area gain (embodied-carbon proxy). Same data, different vocabulary that maps to VR Manoj Lohatepanont's stated C-suite priorities. Scope when Chula deployment opens.

---

## 5. Caveats with bite

1. **10 m floor is not negotiable.** Don't pitch AlphaEarth as a "see every change" tool. It sees changes of building-cluster or land-parcel scale, not single-house.
2. **Annual cadence is not realtime.** If a stakeholder asks "what happened last week?", AlphaEarth is the wrong tool. Use Sentinel-1 GRD (6-day revisit) or MODIS / VIIRS NRT.
3. **Cloud-cover noise.** Sentinel-2 in monsoon Thailand can be heavily occluded. AlphaEarth's training accounts for this via Sentinel-1 SAR fusion, but the annual embedding can still drift if a particular year had very few clear acquisitions over a given AOI. Treat single-year embeddings sceptically; trends across 3+ years are more reliable.
4. **Interpretability ceiling.** The 64-dim vector is not human-readable. You can show that two places are *similar*, that a place *changed*, that a region *clusters* into N types — but you cannot tell the mayor "the AI says this neighbourhood is industrialising because of factor X". Never frame results as "AI says X". Frame them as "this pixel's signature changed by Δ between 2023 and 2024 — go look".
5. **Earth Engine compute quotas.** Public Earth Engine accounts have quotas on concurrent jobs, processing minutes, and export size. **Pre-compute everything in batch, store as files, serve those files from the dashboard.** Never query Earth Engine live from a user-facing dashboard — first user load will hit the quota.
6. **Coordinate system.** Embeddings are exposed in EPSG:4326 by default in Earth Engine but stored internally in different projections. When exporting to GeoTIFF, set `crs="EPSG:3857"` if the target dashboard renders on a Web Mercator basemap (most do), to avoid an on-load reprojection.

---

## 6. Integration shape

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Earth Engine (Python script, runs locally or in CI on a schedule)        │
│   1. Authenticate (personal creds or service account)                    │
│   2. Define AOI bounding box + year range                                │
│   3. Load GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL                           │
│   4. For each year: clip + reduceResolution + export                     │
│   5. (For change overlay) Per-pixel L2 distance between two years        │
│   6. Export to GeoTIFF or PNG + bounds JSON sidecar                      │
└──────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Dashboard repo                                                            │
│   apps/web/public/data/alphaearth/                                       │
│     change-2023-2024.png       (colourised change-magnitude raster)      │
│     change-2023-2024.json      (bounds + metadata + statistics)          │
│     manifest.json              (list of available rasters + dates)       │
└──────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ deck.gl BitmapLayer reads PNG + bounds from JSON sidecar                 │
│   → renders as a translucent overlay on the basemap                       │
│   → tooltip shows the change percentile + the two compared years         │
└──────────────────────────────────────────────────────────────────────────┘
```

### Visualisations that work

- **Change-magnitude heatmap.** Per-pixel L2 distance between year N and year N-1, colourised on a percentile ramp (white = low change, amber = high). The Chonburi pilot uses this shape.
- **Similarity-cluster map.** k-means (N = 6–12) on the embeddings, colour by cluster, hand-label clusters from sampled pixels (residential / commercial / shrimp-pond / mangrove / port / cropland / road / forest).
- **Embedding trajectory chart.** For a clicked pixel, fetch its vector for every year 2017→latest, plot the first 2 PCA components or pairwise distance from year 0. Reads as "how dramatically has *this exact spot* been changing year over year".
- **Reference-pixel similarity.** User picks a pixel; the dashboard highlights every other pixel within ε of it. "Show me everywhere in Chonburi that looks like Laem Chabang industrial."

### Visualisations to avoid

- **"AI-detected anomaly" overlays.** Anomaly framing implies the model knows what's wrong. It doesn't — it just measures distance. Don't claim more than the maths supports.
- **"Predicted future state" overlays.** AlphaEarth is descriptive, not predictive. Anything saying "in 2027 this area will be…" is fabrication.

---

## 7. Cost reality

- **Earth Engine compute for batch jobs:** free at this user's scale (a handful of city-sized AOIs per year). Quota is generous enough that re-baking all dashboards' AlphaEarth layers annually is ≈ 1 afternoon's worth of jobs.
- **BigQuery storage** (if used): a city-scale AlphaEarth export is on the order of low GB; storage is pennies a month.
- **BigQuery query** (if used): SQL `ML.DISTANCE` over a city-scale table is sub-cent per query.
- **Static-file serving** (the recommended integration): the colourised PNG outputs are < 1 MB each, served from the existing CF Pages / Vercel deployment for $0.
- **Alternative:** training your own vision model on raw Sentinel-2 + Sentinel-1 would cost **orders of magnitude more** (GPU compute, data egress, ML engineering time) and produce a worse-quality embedding than AlphaEarth.

The cost answer for any new dashboard is essentially **zero** until and unless this becomes commercial enough that the Earth Engine commercial agreement kicks in.

---

## 8. Bumping the model version

When DeepMind releases **AlphaEarth v2**, the Earth Engine dataset path is the single point of update. Likely path will be `GOOGLE/SATELLITE_EMBEDDING/V2/ANNUAL` or similar — check the Earth Engine catalogue.

To upgrade:

1. Change the `EMBEDDING_DATASET` constant in `scripts/alphaearth/fetch_embeddings.py`.
2. Re-run the pipeline for each AOI to regenerate the rasters.
3. Bump the dashboard version in `package.json`.
4. Note the dataset version in the embedded JSON metadata so old + new outputs are distinguishable.

The Python pipeline and the React component require no other changes — both treat embeddings as opaque N-dim vectors. If v2 changes the dimension (currently 64), the only place that matters is the L2-distance calculation, which is dimension-agnostic.

---

## 9. References

- Brown, C. F. et al., **"AlphaEarth Foundations: An embedding field model for accurate and efficient global mapping from sparse label data"**, Google DeepMind, 2025. ([arXiv preprint](https://arxiv.org/abs/2507.22291))
- Earth Engine dataset: [`GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL`](https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_SATELLITE_EMBEDDING_V1_ANNUAL)
- Earth Engine Python API: [https://developers.google.com/earth-engine/guides/python_install](https://developers.google.com/earth-engine/guides/python_install)
- This repo's pilot integration: [scripts/alphaearth/](../scripts/alphaearth/) and [apps/web/src/components/AlphaEarth/](../apps/web/src/components/AlphaEarth/)
