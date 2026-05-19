<div align="center">

# Chonburi Control Tower
### ศูนย์บัญชาการเมืองชลบุรี

**A real-time intelligence dashboard for Thai municipal governments**  
**แดชบอร์ดข่าวกรองแบบเรียลไทม์สำหรับเทศบาลไทย**

![Chonburi Control Tower](docs/chonburi%20hero.png)

[![Deployed on Cloudflare Pages](https://img.shields.io/badge/Deployed-Cloudflare%20Pages-orange)](https://chonburi.nonarkara.org)
[![API on Cloudflare Workers](https://img.shields.io/badge/API-Cloudflare%20Workers-orange)](https://chonburi-control-tower-api.drnon.workers.dev/api/health)
[![Built with Hono](https://img.shields.io/badge/API-Hono%204.6-blue)](https://hono.dev)
[![Built with deck.gl](https://img.shields.io/badge/Map-deck.gl%209.3-blue)](https://deck.gl)

---

**[🇹🇭 ภาษาไทย](#ภาษาไทย) · [🇬🇧 English](#english)**

</div>

---

## English

### What Is This?

Chonburi Control Tower is a **free, open-source, fork-in-10-minutes city intelligence dashboard** built for Thai municipal governments. It pulls 40+ live data feeds into a single map — traffic incidents, air quality, sea state, fisheries zones, flood risks, citizen complaints, maritime vessel positions, satellite imagery, and government open data — and presents them to the mayor and operations team in a format that answers the only question that matters: **"What do I need to do right now?"**

The dashboard was built in a single sprint as a proof-of-concept for the [SLIC Index](https://slic.nonarkara.org) smart-city programme. It is live at **[chonburi.nonarkara.org](https://chonburi.nonarkara.org)**.

### How We Got Here

This project started as a fork of a campus dashboard built for Chulalongkorn University in Bangkok. That dashboard solved a well-defined problem: 37,000 students, 19 faculties, one district, real-time shuttle positions and air quality.

The question that followed was harder: **can the same architecture serve a coastal Thai municipality — a city with fisheries, a port, flood-prone streets, maritime traffic, and a mayor who needs to know whether small-boat fishermen can safely go out today?**

The answer turned out to be yes — but only after stripping out every Bangkok/campus assumption and rebuilding the data layer around Chonburi's actual geography and concerns. The Eastern Economic Corridor context (EEC), the Gulf of Thailand coastline, the Ang Sila oyster farmers, the 4,200 households that flood every king tide — these are not Bangkok problems, and the dashboard should not pretend they are.

What you're looking at is the result of that rebuild.

### Features

| Category | What you get |
|---|---|
| **Live map** | deck.gl + MapLibre, dark/light theme, 2D/3D/3DS (substructure) modes |
| **3D buildings** | ~5,000 OSM footprints extruded to real heights. Landmarks color-coded: 🟡 hotels, 🟡 temples, 🔵 government, 🩵 police, 🟠 fire stations, 🔴 hospitals, 🟣 schools, 🟡 EGAT/power |
| **Maritime** | OpenSeaMap overlay, Laem Chabang port, ferry terminals, navigation aids, AIS vessel positions (live with key) |
| **Sea state** | Open-Meteo Marine: wave height + direction + period, swell, SST, ocean current, 24 h forecast. Small-boat go/no-go verdict, shellfish thermal-stress alert |
| **Fisheries** | Ang Sila oyster, Bang Saen shrimp, Bang Phra mussel, Chonburi Bay artisanal, Koh Si Chang offshore zones with yield data |
| **Flood risk** | 4 annotated flood-prone zones with household counts and flood type |
| **Satellites** | 11 NASA GIBS/Esri products: VIIRS true-color, MODIS, Himawari IR, IMERG rainfall, NDVI, LST, AOD, NO₂, flood detection — all date-stamped in the layer palette |
| **Civic POIs** | 802 OSM-sourced points: hospitals, schools, police, fire, government, temples, markets — color-coded and hoverable |
| **Waterways** | 1,836 canal/river/drainage segments (critical for flood-prevention planning) |
| **Mayor's Desk** | Every news headline classified by action tag: 🔺 EM emergency, ✚ FU funeral (attend/send wreath), ◆ PO police-citizen friction, ★ HO honour, ✦ FE festival, ▣ IN infrastructure, ◢ BZ EEC/business, ✚ PU public health |
| **Facebook** | Meta page-plugin embed of the municipal Facebook page (no auth needed) |
| **Air quality** | Open-Meteo grid AQ + 8h forecast |
| **Weather** | Open-Meteo current + precipitation nowcast |
| **Traffic** | iTIC/Longdo live events (Eastern Seaboard bbox) |
| **Citizen reports** | Traffy Fondue nationwide feed filtered to Chonburi province |
| **data.go.th** | 22 curated government POIs + 16 national dataset catalog entries |
| **Markets** | FMP + FRED: SET, USD/THB, VIX, WTI, gold |
| **AI chat** | CTM-Concierge (Gemini 2.5 Flash, server-proxied, Chonburi context) |

### Fork It For Your City — 5-Minute Setup

**Prerequisites:** Node 20+, pnpm 10+, a free Cloudflare account.

```bash
# 1. Fork + clone
git clone https://github.com/Nonarkara/chonburi-control-tower
cd chonburi-control-tower
pnpm install

# 2. Set your city
# Edit packages/shared/src/campus.ts — change CHONBURI config:
```

```typescript
export const CHONBURI: CampusConfig = {
  id: "your-city",
  name: {
    en: "Your City Municipality",
    th: "เทศบาลเมืองของคุณ",
    zh: "你的城市",
  },
  center: [YOUR_LNG, YOUR_LAT],   // e.g. [100.9847, 13.3611]
  innerBounds: [[LNG_SW, LAT_SW], [LNG_NE, LAT_NE]],  // municipality border
  outerBounds: [[LNG_SW_WIDE, LAT_SW_WIDE], [LNG_NE_WIDE, LAT_NE_WIDE]],  // province+
  defaultView: {
    longitude: YOUR_LNG,
    latitude: YOUR_LAT,
    zoom: 13.5,   // 13 for city, 15 for district, 11 for province
    pitch: 0,
    bearing: 0,
  },
};
```

```bash
# 3. Update news keywords (apps/api/src/adapters/news.ts)
#    Change "ชลบุรี / Chonburi / EEC" to your city's name

# 4. Run locally
pnpm --filter @your-city/api dev:node   # API on :8787
pnpm --filter @your-city/web dev        # Web on :5173

# 5. Deploy (free)
cd apps/web && wrangler pages project create your-city-dashboard
VITE_API_BASE_URL=https://your-city-api.yourname.workers.dev \
  pnpm build && wrangler pages deploy dist
```

### Satellite Layer Configuration

Every satellite layer is date-stamped in the palette with how fresh the data is:

| Layer | Source | Delay | Good for |
|---|---|---|---|
| Esri HD | Esri World Imagery | mosaic | High-res base imagery, city detail |
| VIIRS true-color | NASA NOAA-20 | 24 h | Cloud-free true color |
| MODIS true-color | NASA Terra | 24 h | Daily wide-area view |
| VIIRS night lights | NASA SNPP | 24 h | Urban extent, fishing fleet lights |
| IMERG rainfall | NASA GPM | 6 h | Live monsoon cells |
| Himawari IR | JMA via NASA | 10 min | Storm fronts approaching the Gulf |
| NDVI | MODIS 8-day | 8 days | Crop health, green cover |
| Land surface temp | MODIS daily | 24 h | Urban heat island |
| Aerosol | MODIS MAIAC | 24 h | Haze, industrial plumes (Laem Chabang) |
| NO₂ | OMI | 24 h | Traffic + power plant pollution |
| Flood detection | MODIS 3-day | 3 days | Flooded areas after rain events |

All GIBS layers are served via MapLibre `<Source type="raster">` for reliable rendering at any zoom level. Configure opacity per layer in `GIBS_LAYERS[]` in `apps/web/src/App.tsx`.

### API Architecture

```
apps/
├── api/          Hono 4.6 (dual-runtime: Node 24/7 + Cloudflare Worker)
│   └── src/adapters/
│       ├── news.ts          Google News RSS, Bangkok Post — keyword-filtered
│       ├── marine.ts        Open-Meteo Marine — wave/SST/swell/current
│       ├── weather.ts       Open-Meteo forecast
│       ├── airQuality.ts    Open-Meteo AQ + 8h
│       ├── itis.ts          iTIC/Longdo live traffic
│       ├── cityReporter.ts  Traffy Fondue nationwide feed
│       ├── cctv.ts          Longdo traffic cameras
│       ├── datago.ts        data.go.th curated POIs + CKAN catalog
│       ├── marine.ts        Open-Meteo Marine
│       ├── ais.ts           AISStream.io WebSocket (key optional)
│       ├── facebook.ts      Graph API (token optional; Meta iframe always works)
│       ├── markets.ts       FMP + FRED indices
│       ├── trends.ts        Google Trends
│       ├── executive.ts     Municipal KPI snapshot
│       └── chat.ts          Gemini 2.5 Flash proxy
└── web/          React 19 + Vite + deck.gl 9.3 + MapLibre 5.7
    └── src/
        ├── map/layers.ts    All deck.gl + MapLibre layer factories
        ├── map/presets.ts   Layer groups, lens definitions, satellite freshness
        └── components/      26 React panels
```

### Optional API Keys (all have free tiers or fallbacks)

| Key | Service | Free tier | Without key |
|---|---|---|---|
| `GEMINI_API_KEY` | Google Gemini 2.5 Flash | 1M tokens/day | Chat disabled |
| `AISSTREAM_TOKEN` | AISStream.io | Unlimited free | AIS vessels hidden |
| `FACEBOOK_PAGE_TOKEN` + `FACEBOOK_PAGE_ID` | Meta Graph API | Free | Meta iframe embed works |
| `FMP_API_KEY` | Financial Modeling Prep | 250 calls/day | Markets hidden |
| `FRED_API_KEY` | Federal Reserve | Unlimited free | Forex/macro hidden |

### Contributing

The goal is for every Thai municipality to have one of these. Issues, PRs, and forks are welcome. If you build a version for another city, please open a PR adding it to the [known deployments list](DEPLOYMENTS.md).

---

## ภาษาไทย

### คืออะไร?

Chonburi Control Tower คือ **แดชบอร์ดข่าวกรองเมืองแบบเรียลไทม์ ฟรีและโอเพ่นซอร์ส** ที่ออกแบบมาสำหรับเทศบาลไทย ดึงข้อมูลจากกว่า 40 แหล่งมารวมในแผนที่เดียว ทั้งอุบัติเหตุจราจร คุณภาพอากาศ สภาพทะเล เขตประมง พื้นที่เสี่ยงน้ำท่วม ร้องเรียนประชาชน ตำแหน่งเรือ ภาพดาวเทียม และข้อมูลเปิดภาครัฐ และนำเสนอในรูปแบบที่ตอบคำถามสำคัญ: **"ตอนนี้ผมต้องทำอะไร?"**

ใช้งานจริงที่ **[chonburi.nonarkara.org](https://chonburi.nonarkara.org)**

### เรื่องราวที่มา

แดชบอร์ดนี้เริ่มต้นจากการ fork แดชบอร์ดที่สร้างสำหรับจุฬาลงกรณ์มหาวิทยาลัย คำถามที่ตามมาคือ: **สถาปัตยกรรมเดียวกันสามารถรับใช้เทศบาลชายฝั่งทะเลได้หรือไม่?** เมืองที่มีการประมง ท่าเรือ ถนนที่น้ำท่วมบ่อย การเดินเรือ และนายกเทศมนตรีที่ต้องรู้ว่าวันนี้ชาวประมงออกเรือได้ปลอดภัยหรือเปล่า?

คำตอบคือ ได้ — แต่ต้องรื้อสมมติฐานทั้งหมดเกี่ยวกับกรุงเทพฯ และ campus ออก และสร้างชั้นข้อมูลใหม่รอบภูมิศาสตร์และความกังวลจริงของชลบุรี บริบท EEC อ่าวไทย ชาวนากุ้งบ้านแสน เกษตรกรหอยนางรมอ่างศิลา บ้านเรือน 4,200 ครัวเรือนที่น้ำท่วมทุกน้ำขึ้นสูง — ล้วนไม่ใช่ปัญหากรุงเทพฯ

### ฟีเจอร์หลัก

- 🗺️ **แผนที่สด** พร้อม 3D อาคาร สีตาม landmark: 🟡 โรงแรม, 🟡 วัด, 🔵 หน่วยงานรัฐ, 🩵 ตำรวจ, 🟠 ดับเพลิง, 🔴 โรงพยาบาล, 🟣 โรงเรียน, 🟡 EGAT/PEA
- 🌊 **สภาพทะเล** ความสูงคลื่น SST กระแสน้ำ การพยากรณ์ 24 ชม. คำตัดสิน "ออกเรือปลอดภัย / หยุดเรือ"
- 🐟 **เขตประมง** อ่างศิลาหอยนางรม, บ้านแสนกุ้ง, บางพระหอย, ชาวประมงพื้นบ้าน, แหลมฉบัง offshore
- 🚨 **โต๊ะนายกฯ** ข่าวทุกชิ้นถูก classify: FU ไปงานศพ, EM ไปที่เกิดเหตุ, PO ไกล่เกลี่ยตำรวจ-ประชาชน, HO แสดงความยินดี, FE เปิดงาน, IN ตามกรมช่าง, BZ ไปพิธีลงนาม, PU ไปเยี่ยมบุคลากรสาธารณสุข
- 📡 **ดาวเทียม 11 ชั้น** ทั้ง Esri, VIIRS, MODIS, Himawari, IMERG, NDVI, LST, AOD, NO₂ พร้อมวันที่ข้อมูล (Y'DAY / 3D AGO / LIVE)

### Fork สำหรับเมืองของคุณ — 5 นาที

แก้ไขไฟล์เดียว `packages/shared/src/campus.ts`:

```typescript
// เปลี่ยนชื่อเมือง ค่า lat/lng และขอบเขตพื้นที่
export const CHONBURI: CampusConfig = {
  id: "your-city-id",
  name: { en: "...", th: "...", zh: "..." },
  center: [LNG, LAT],
  innerBounds: [[LNG_SW, LAT_SW], [LNG_NE, LAT_NE]],
  outerBounds: [[LNG_SW_WIDE, LAT_SW_WIDE], [LNG_NE_WIDE, LAT_NE_WIDE]],
  defaultView: { longitude: LNG, latitude: LAT, zoom: 13.5, pitch: 0, bearing: 0 },
};
```

จากนั้นอัปเดต keyword ข่าวในไฟล์ `apps/api/src/adapters/news.ts` และ deploy บน Cloudflare Pages (ฟรี)

### ซอร์สข้อมูลที่ใช้

ทุก API ที่ใช้มีแพลนฟรีหรือไม่ต้องใช้ key:
- **Open-Meteo** (อากาศ + ทะเล + AQ) — ฟรีไม่จำกัด
- **iTIC / Longdo** — ฟรี (ปิดกั้น IP บางส่วน ทดแทนด้วย Node tunnel)
- **Traffy Fondue** — open API ทั่วประเทศ
- **NASA GIBS** — ดาวเทียม ฟรีสาธารณะ
- **OpenStreetMap** — อาคาร ถนน ลำน้ำ ฟรี
- **data.go.th** — ข้อมูลเปิดภาครัฐไทย
- **AISStream.io** — ตำแหน่งเรือ ฟรีพร้อม key

### ปรัชญาการออกแบบ

สร้างตาม Design DNA ของ Dr. Non: **Dieter Rams × Bauhaus × cyberpunk data-dense**
- หน้าจอมืด สีพื้น near-black `#0a0e14` มี blue undertone
- ONE accent: amber `#f59e0b` สำหรับการเน้นความสำคัญ
- Palette data-encoded เท่านั้น: ไม่มีสีประดับ ทุกสีมีความหมาย
- ขนาด font 3 ขนาด: display, body, micro
- ไม่มี rounded corners ไม่มี drop shadows ไม่มี gradients

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite 6, TypeScript |
| Map | deck.gl 9.3, MapLibre GL 5.7, react-map-gl 8 |
| API | Hono 4.6, Node.js 20 (24/7 via launchd), Cloudflare Workers (serverless) |
| Shared | pnpm workspace monorepo |
| Deploy | Cloudflare Pages (web) + Workers (API) |
| Data | Open-Meteo, NASA GIBS/FIRMS, Longdo/iTIC, Traffy Fondue, data.go.th |

## License

MIT. Fork freely. Build for your city.

---

*Built by [Dr. Non Arkara](https://nonarkara.org) · [SLIC Index](https://slic.nonarkara.org) × [depa](https://www.depa.or.th)*
