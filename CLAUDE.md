# Chonburi Smart City Dashboard — Claude Instructions

## Project Overview

Municipal smart city dashboard for Chonburi Town Municipality. React 19 + Vite + deck.gl + MapLibre. pnpm monorepo.

```
apps/api/    Hono API server — data adapters, NormalizedFeed endpoints
apps/web/    React dashboard — lenses, map layers, panels
packages/shared/  TypeScript types + utilities (types.ts, locale.ts)
```

## Key Commands

```bash
pnpm dev                    # all workspaces
pnpm --filter web dev       # frontend only (port 5173)
pnpm --filter api dev       # API only (port 3000)
pnpm tsc --noEmit           # type check
```

## Testing

The codebase has a test foundation — please keep it green.

```bash
pnpm --filter @chonburi/shared test     # 24 unit tests (locale, fmtAge, tierLabel, SOURCE_CATALOG invariants)
pnpm --filter @chonburi/web test        # 101 unit tests (safeUrl XSS prevention, apiBase URL resolution, trafficSim model contract, searchCities geocoding, presets satelliteFreshness + LENSES/ALL_LAYERS/COMPUTED_LAYERS invariants, PARTNER_CITIES data contract)
pnpm --filter @chonburi/api test        # 284 unit tests (health state machine, cache dedup, bbox, common fetch utils, newsArchive dedup+filter+digest, persistence hydrate+interval, twinStore in-memory CRUD+relations+state+hydrate, twinDb URL-parsing+SSL config, adapter contracts: weather, tides, marine, datago, nasa-power, air-quality, aqicn, AIS, GISTDA, markets, facebook, chat, chatContext, news, executive, cityReporter, iTIC, precipNowcast, cctv, portOps, waterQuality, viabus, trends)
pnpm --filter @chonburi/web test:e2e    # 15 Playwright smoke tests (boot, lens, modal, MODELLED chips, count badges, MAR/EAR/EXEC panels, catalog filter, layer toggle, PmcuBrief, ChatBox, HourRail weekday/weekend, theme toggle)
```

CI (`.github/workflows/test.yml`) runs typecheck + unit + E2E on every PR. Deploy
runs only after Test workflow succeeds. **Do not skip tests to ship.** If a test
flakes, fix the test (or the bug), don't disable it.

### When you change an adapter
- If you add a new env var requirement: set `meta.note` when missing, and add an
  assertion to `apps/api/src/adapters/<name>.test.ts`.
- If you change a `SourceMeta.fallbackTier`: `safeFeed` now treats `unavailable`
  as a health error. Make sure the `meta.note` explains what's wrong — that
  string shows in the SOURCES catalog.

### When you change a component
- If you change an interactive contract (a button cycles, a modal opens), add or
  update a Playwright test in `apps/web/tests/e2e/smoke.spec.ts`.
- Prefer text-content + `role` selectors; avoid CSS class selectors (they break
  silently on refactor).

## Established Patterns — Follow These

### NormalizedFeed
Every API route returns `NormalizedFeed<T>` from `@chonburi/shared`. Never return raw arrays.

```typescript
interface NormalizedFeed<T> {
  features: T[];
  meta: SourceMeta;  // source, fetchedAt, ageMinutes, fallbackTier
}
```

### PanelHeader
**Every panel section must start with `<PanelHeader>`** — not a raw `<div>` with an eyebrow class.

```tsx
import { PanelHeader } from './PanelHeader';
// ...
<PanelHeader
  title="PANEL TITLE"          // ALL CAPS, short
  ageMinutes={meta.ageMinutes}
  fallbackTier={meta.fallbackTier}
  source="source-name"         // lowercase, dot-separated if multiple
  actions={<OptionalNode />}
/>
```

### fmtAge / tierLabel
Import from `@chonburi/shared`. Do NOT reimplement locally.

```typescript
import { fmtAge, tierLabel } from '@chonburi/shared';
```

### CSS Design Tokens
ALWAYS use CSS custom properties. NEVER hardcode hex colors in components or SVGs.

| Use this | NOT this |
|----------|----------|
| `var(--ink)` | `#1A1A1A` |
| `var(--ink-mid)` | `#6B6B6B` |
| `var(--ink-low)` | `#9CA3AF` |
| `var(--rule)` | `#E5E7EB` |
| `var(--ground-soft)` | `#F9FAFB` |
| `text-ink` | `text-gray-900` |
| `border-rule` | `border-gray-200` |

In SVG elements: `fill="var(--ink)"`, `stroke="var(--rule)"`.

### Freshness CSS Classes
Defined in `apps/web/src/styles/layout.css`:

```
.data-age--fresh  → green  (< 5 min)
.data-age--warn   → yellow (30–120 min)
.data-age--stale  → red    (> 120 min)
.data-age--crit   → critical (unavailable tier)
```

## Lenses

Defined in `apps/web/src/map/presets.ts`:

| ID | Label | Purpose |
|----|-------|---------|
| `executive` | EXEC | Strategic — municipal boundary, POIs |
| `operations` | OPS | Day-to-day — 3D buildings, traffic, incidents |
| `mobility` | MOB | Dispatch + routing — traffic, transit, vessels |
| `maritime` | MAR | Gulf of Thailand — port, AIS vessels, OpenSeaMap |
| `environment` | ENV | Flood risk, solar potential, waterways |
| `earth` | EAR | Earth obs — rain, flood, heat, GISTDA |
| `safety` | SAF | Coastal flood, Traffy, CCTV, hospitals |
| `vibes` | VIB | Presentation mode — clean + true-color satellite |
| `intelligence` | INT | TimeFM forecasts + EO map binding |

Default lens: `"operations"`.

## Components

| Component | Purpose | Has PanelHeader? |
|-----------|---------|-----------------|
| `KpiStrip` | Main status row (incidents, traffic, AQI, weather) | ✅ |
| `NewsDesk` | Incident/news feed | ✅ |
| `WaterPanel` | Reservoir levels | ✅ |
| `CoastalBrief` | Sea state / Gulf of Thailand | ✅ |
| `TidePanel` | Tidal forecasts | ✅ |
| `FisheryPanel` | Fishery zone conditions | ✅ |
| `ExecutiveBriefing` | Strategic KPIs | ✅ |
| `EarthAlphaBrief` | Earth obs summary | ✅ |
| `PredictivePanel` | TimeFM forecasts | ✅ |
| `FacebookPanel` | Municipal Facebook feed | ✅ |
| `TrendsPanel` | Google Trends · #Chonburi | ✅ |
| `ProvincialKPIs` | Province data.go.th KPIs | ✅ |
| `PmcuBrief` | Municipality ops brief (modelled traffic + parking + fleet) | ✅ |

## Data Sources

| Source | Adapter | Refresh |
|--------|---------|---------|
| Traffy Fondue | `traffy-adapter` | 5 min |
| iTIC | `itic-adapter` | 2 min |
| AQICN | `aqicn-adapter` | 15 min |
| Open-Meteo | `weather-adapter` | 30 min |
| AIS (vessels) | `ais-adapter` | 5 min |
| NASA POWER | `nasa-power-adapter` | 24h |
| GISTDA | `gistda-adapter` | 1h |
| Facebook page | `facebook-adapter` | 15 min |

## TypeScript Rules

- No `as any` — define interfaces in `packages/shared/src/types.ts`
- All API responses must match `NormalizedFeed<T>` shape
- Coordinates in deck.gl: `[lng, lat]` order (NOT `[lat, lng]`)
- Types exported from shared: `IncidentFeature`, `TrafficCorridor`, `AirQualityPoint`, `WeatherSnapshot`, `GistdaPoi`, `NasaEarthReadings`, `FacebookPost`, etc.

## File Size Limits

- Components: 400 lines max. Extract sub-components if larger.
- Presets: `map/presets.ts` is large by necessity — do not split it.
- `styles/layout.css`: single file by design — all tokens + utilities.

## Adding a New Panel

1. Create `components/[Name]Panel.tsx`
2. Start with `<PanelHeader title="..." ageMinutes={...} source="..." />`
3. Add API endpoint in `apps/api/src/routes/`
4. Return `NormalizedFeed<YourType>`
5. If new type needed, add to `packages/shared/src/types.ts`
6. Wire to App.tsx via SWR hook
