# Archived GeoJSON — forked Chula University / Bangkok (BMA) layers

This dashboard was forked from a Chulalongkorn University campus / Bangkok
Metropolitan Administration (BMA) dashboard. The files below contain geometry for
**Bangkok / Chula campus**, not Chonburi, so they render outside the Chonburi
viewport (center ≈ `100.9847, 13.3611`) and were never part of any Chonburi lens.

They are kept here (not deleted) so they remain recoverable if a future Bangkok /
campus deployment needs them.

**Archived from git ref:** `b1b5916`
**Date:** 2026-05-30

## Files

| File | What it is | Why archived |
|------|-----------|--------------|
| `chula-campus.geojson` | Chulalongkorn University campus zones (Bangkok) | Replaced by `chonburi-district.geojson` (real Mueang Chon Buri District boundary, OSM relation 18997107) as the Municipal boundary layer |
| `chula-buildings.geojson` | Chula campus buildings | Bangkok geometry |
| `chula-gates.geojson` | Chula campus gates | Bangkok geometry |
| `chula-roads.geojson` | Chula campus roads | Bangkok geometry |
| `cu-lands.geojson` | CU land-parcel portfolio | Bangkok geometry; drove the old PmcuBrief "ZONES MAPPED" metric (now "ROAD SAMPLES") |
| `cu-shuttle-routes.geojson` | CU shuttle bus routes | Bangkok geometry |
| `cu-shuttle-stops.geojson` | CU shuttle stops | Bangkok geometry |
| `cu-electricity.geojson` | CU campus electrical network | Bangkok geometry |
| `cu-water.geojson` | CU campus water network | Bangkok geometry |
| `cu-drainage.geojson` | CU campus drainage network | Bangkok geometry |
| `cu-wifi.geojson` | CU campus WiFi survey | Bangkok geometry |
| `bangkok-districts.geojson` | Bangkok district boundaries | Wrong city |
| `flood-prone-areas.geojson` | Bangkok flood-prone polygons | Wrong city; use `chonburi-flood-risk.geojson` |
| `neighborhood-tall-buildings.geojson` | Tall buildings near Chula | Bangkok geometry |
| `surrounding-buildings.geojson` | Buildings surrounding Chula | Bangkok geometry |
| `bma/` | BMA civic POIs (hospitals, police, fire, parks, AQ stations, etc.) | Bangkok geometry; Chonburi uses `chonburi-civic.geojson` |

## Code archived alongside

- `apps/web/src/hooks/_useBmaStatic.ts.archived` — loaded the `bma/` directory.

The deck.gl layer-builder functions for these (`cuLandsLayer`, `shuttle*Layer`,
`bma*Layer`, `electricity*`, `water*`, `drainage*`, `wifi*`, `campusGatesLayer`,
`cuMapOverlay`) still exist as **unused exports** in `apps/web/src/map/layers.ts`
and the legacy `LayerId` union members remain in `apps/web/src/map/presets.ts`
(documented as backward-compat no-ops). They are recoverable from git ref `b1b5916`.

## How to restore

```bash
git checkout b1b5916 -- apps/web/public/geo/<file>.geojson
# then re-add the useGeoJson hook + render branch in App.tsx
```
