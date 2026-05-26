import { useEffect } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Whitepaper — bilingual (Thai + English) platform overview, architecture,
 * data sources, and usage guide. Triggered from the TopBar "WP" button.
 */
export function Whitepaper({ open, onClose }: Props) {
  const containerRef = useFocusTrap(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="manual-backdrop" onClick={onClose}>
      <div
        ref={containerRef}
        className="manual whitepaper"
        role="dialog"
        aria-modal="true"
        aria-label="Chonburi Town Center — Whitepaper"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="manual-head">
          <div className="col">
            <span className="eyebrow mono">Whitepaper · CTM-01 · v0.1</span>
            <h2 className="manual-title">
              Chonburi Town Center
              <span className="whitepaper-thai serif"> · ศูนย์ควบคุมเมืองชลบุรี</span>
            </h2>
            <span className="caption" style={{ color: "var(--text-2)" }}>
              Platform Overview &amp; Usage Guide · ภาพรวมและคู่มือการใช้งาน
            </span>
          </div>
          <button onClick={onClose} className="mono manual-close" aria-label="Close whitepaper">
            [ESC] CLOSE
          </button>
        </header>

        <div className="manual-body">

          {/* ── Executive summary ── */}
          <section className="manual-section whitepaper-bilingual">
            <div className="whitepaper-col">
              <h3 className="manual-h3">Executive Summary</h3>
              <p>
                Chonburi Town Center (CTM-01) is a real-time municipal operations
                dashboard serving Chonburi Town Municipality — a 46 km² city of
                ~250,000 residents anchored to the Eastern Economic Corridor (EEC),
                Thailand's flagship industrial and logistics zone.
              </p>
              <p>
                The platform fuses <strong>37+ live data feeds</strong> — traffic,
                incidents, air quality, satellite imagery, maritime AIS, tide, rainfall,
                NASA MERRA-2 satellite climate, news, Facebook community updates, and
                financial markets — into a single coherent map-first interface.
                Every panel shows what is happening, when, and where, so the mayor
                and operations staff can make faster, better-informed decisions.
              </p>
              <p>
                New in this build: an <strong>Intelligence (INT) lens</strong> that
                wires TimesFM forecast metrics directly to map layers; a
                <strong> Situation Digest</strong> that synthesises Earth Observation
                and forecast data into a plain-language operational summary; and
                <strong> LIVE READINGS</strong> from NASA's MERRA-2 satellite
                reanalysis showing real atmospheric readings at Chonburi centroid.
              </p>
            </div>
            <div className="whitepaper-col whitepaper-th">
              <h3 className="manual-h3 serif">สรุปสำหรับผู้บริหาร</h3>
              <p className="serif">
                Chonburi Town Center (CTM-01) คือแดชบอร์ดปฏิบัติการเทศบาลแบบเรียลไทม์
                สำหรับเทศบาลเมืองชลบุรี — เมืองพื้นที่ 46 ตารางกิโลเมตร
                ประชากรราว 250,000 คน ตั้งอยู่ในพื้นที่ระเบียงเศรษฐกิจพิเศษภาคตะวันออก (EEC)
                ศูนย์กลางอุตสาหกรรมและโลจิสติกส์สำคัญของประเทศไทย
              </p>
              <p className="serif">
                แพลตฟอร์มนี้รวบรวมข้อมูลสดกว่า <strong>37 แหล่ง</strong> — การจราจร เหตุการณ์ฉุกเฉิน
                คุณภาพอากาศ ภาพถ่ายดาวเทียม AIS ทางทะเล น้ำขึ้น-ลง ปริมาณฝน
                ข้อมูลภูมิอากาศ NASA MERRA-2 ข่าวสาร Facebook เทศบาล
                และตลาดการเงิน — ไว้ในแผนที่เดียว
              </p>
              <p className="serif">
                สิ่งใหม่ในเวอร์ชันนี้: <strong>เลนส์ INT (Intelligence)</strong>
                ที่เชื่อมการพยากรณ์ TimesFM กับชั้นแผนที่โดยตรง;
                <strong> Situation Digest</strong> ที่สังเคราะห์ข้อมูล EO และพยากรณ์
                ออกมาเป็นสรุปสถานการณ์; และ <strong>LIVE READINGS</strong>
                จากดาวเทียม MERRA-2 ของ NASA แสดงค่าบรรยากาศจริงที่ชลบุรี
              </p>
            </div>
          </section>

          {/* ── Why this dashboard ── */}
          <section className="manual-section whitepaper-bilingual">
            <div className="whitepaper-col">
              <h3 className="manual-h3">Why This Dashboard Exists</h3>
              <p>
                Chonburi's municipal operations are spread across dozens of
                disconnected systems: LINE Official for resident complaints,
                Longdo for traffic, open-meteo for weather, GISTDA for
                geospatial intelligence, Facebook for community updates.
                Staff monitor each source separately, often on personal phones.
              </p>
              <p>
                CTM-01 collapses all of these into one screen. It does not
                replace existing systems — it presents them in a unified view
                so operators can see the city as a whole, not as
                disconnected data silos.
              </p>
              <ul className="manual-flow">
                <li>Know about incidents before residents call</li>
                <li>Correlate rainfall + tide + flood risk in one view</li>
                <li>Track the EEC port and industrial hinterland in real time</li>
                <li>Run satellite analysis without GIS expertise</li>
                <li>Forecast traffic, AQ, and tide levels up to 24 h ahead</li>
                <li>Click any forecast metric to activate its map layer instantly</li>
                <li>Read the municipal Facebook feed without leaving the operations screen</li>
              </ul>
            </div>
            <div className="whitepaper-col whitepaper-th">
              <h3 className="manual-h3 serif">เหตุผลที่สร้างแดชบอร์ดนี้</h3>
              <p className="serif">
                ข้อมูลการดำเนินงานของเทศบาลชลบุรีกระจายอยู่ในระบบที่ไม่เชื่อมต่อกัน:
                LINE Official สำหรับร้องเรียน Longdo สำหรับจราจร open-meteo สำหรับอากาศ
                GISTDA สำหรับภูมิสารสนเทศ และ Facebook สำหรับข่าวสาร
                เจ้าหน้าที่ต้องติดตามแต่ละแหล่งแยกกัน มักผ่านโทรศัพท์ส่วนตัว
              </p>
              <p className="serif">
                CTM-01 รวมทั้งหมดไว้ในหน้าจอเดียว โดยไม่แทนที่ระบบเดิม
                แต่นำเสนอในมุมมองที่เป็นหนึ่งเดียว ให้ผู้ปฏิบัติงานมองเห็นเมือง
                ภาพรวม ไม่ใช่ข้อมูลที่แยกกัน
              </p>
              <ul className="manual-flow serif">
                <li>รับรู้เหตุการณ์ก่อนที่ประชาชนจะโทรแจ้ง</li>
                <li>เชื่อมโยงฝน + น้ำขึ้น-ลง + ความเสี่ยงน้ำท่วมในมุมเดียว</li>
                <li>ติดตามท่าเรือ EEC และพื้นที่อุตสาหกรรมแบบเรียลไทม์</li>
                <li>วิเคราะห์ภาพดาวเทียมโดยไม่ต้องมีความเชี่ยวชาญ GIS</li>
                <li>พยากรณ์การจราจร คุณภาพอากาศ และน้ำขึ้น-ลงล่วงหน้า 24 ชั่วโมง</li>
                <li>คลิกตัวชี้วัดพยากรณ์เพื่อเปิดชั้นแผนที่ที่เกี่ยวข้องทันที</li>
                <li>ติดตาม Facebook เทศบาลโดยไม่ออกจากหน้าจอปฏิบัติการ</li>
              </ul>
            </div>
          </section>

          {/* ── Architecture ── */}
          <section className="manual-section">
            <h3 className="manual-h3">Technical Architecture</h3>
            <div className="manual-grid-2">
              <div>
                <h4 className="manual-h4">Data layer</h4>
                <ul className="manual-flow">
                  <li><strong>API server</strong> — Hono (Node.js) running as macOS launchd service. 20+ adapter modules pre-warm data every 5 min; stale-tolerant cache survives upstream outages and restarts.</li>
                  <li><strong>Forecast service</strong> — Python APScheduler + Google TimesFM 2.0 (200 M param, zero-shot). Runs hourly; writes 5-metric forecasts to Supabase.</li>
                  <li><strong>Database</strong> — Supabase PostgreSQL + PostGIS for city-twin state + forecast storage.</li>
                  <li><strong>Edge</strong> — Cloudflare Worker proxies select routes; CDN caches tile responses.</li>
                </ul>
              </div>
              <div>
                <h4 className="manual-h4">Frontend</h4>
                <ul className="manual-flow">
                  <li><strong>React 19 + Vite 6</strong> — fast refresh; vendor-split bundles (React 212 kB · MapLibre 1.1 MB · deck.gl 1.1 MB) cache independently. App logic chunk: 182 kB.</li>
                  <li><strong>deck.gl 9.3 + MapLibre GL</strong> — WebGL2 map with 3D extrusion (20,877 buildings), heatmaps, AIS trails, satellite tiles. Stroke pass skipped in 3D mode for ~40% GPU reduction.</li>
                  <li><strong>IBM Plex</strong> (Sans, Mono, Condensed, Thai) + <strong>Lora</strong> serif — self-hosted, no external font requests.</li>
                  <li><strong>Design DNA</strong> — Bauhaus functionalism × Swiss typography × East-Asian density. Red accent (#dc2626), deep blue data (#2563eb), no rounding or shadow.</li>
                  <li><strong>Accessibility</strong> — WCAG 2.1 AA: focus rings, ARIA roles, modal focus traps with return-focus, news ticker pause control (WCAG 2.2.2), combobox building search.</li>
                </ul>
              </div>
            </div>

            <h4 className="manual-h4" style={{ marginTop: 16 }}>Data sources</h4>
            <table className="manual-table">
              <thead>
                <tr><th>Feed</th><th>Source</th><th>Update</th><th>Coverage</th></tr>
              </thead>
              <tbody>
                <tr><td>Traffic events</td><td>iTIC / Longdo</td><td>Live</td><td>Eastern Seaboard</td></tr>
                <tr><td>Citizen reports</td><td>Traffy Fondue</td><td>Live</td><td>Municipal</td></tr>
                <tr><td>CCTV cameras</td><td>Longdo</td><td>Live JPG/HLS</td><td>Chonburi bbox</td></tr>
                <tr><td>AIS vessels</td><td>AISStream.io</td><td>Live</td><td>Gulf of Thailand</td></tr>
                <tr><td>Weather</td><td>open-meteo</td><td>1-hr</td><td>13.37°N, 100.99°E</td></tr>
                <tr><td>Air quality</td><td>open-meteo AQ</td><td>1-hr</td><td>Chonburi station</td></tr>
                <tr><td>Tide</td><td>open-meteo Marine</td><td>1-hr</td><td>Gulf coast</td></tr>
                <tr><td>Satellite imagery</td><td>NASA GIBS (MODIS/VIIRS/IMERG/OMI) + Esri</td><td>15 min – 8 days</td><td>Global / regional</td></tr>
                <tr><td>Satellite climate <span className="mono" style={{fontSize:"0.7em"}}>NEW</span></td><td>NASA POWER (MERRA-2 reanalysis)</td><td>Daily (~3-day latency)</td><td>Chonburi centroid</td></tr>
                <tr><td>Community updates <span className="mono" style={{fontSize:"0.7em"}}>NEW</span></td><td>Facebook Graph API (municipal page)</td><td>15 min</td><td>เทศบาลเมืองชลบุรี page</td></tr>
                <tr><td>POI data</td><td>GISTDA Digital Twin</td><td>Static</td><td>Thailand</td></tr>
                <tr><td>Solar irradiance</td><td>GISTDA LOD2</td><td>Static</td><td>Chonburi city centre</td></tr>
                <tr><td>Land use</td><td>GISTDA</td><td>Static</td><td>Chonburi province</td></tr>
                <tr><td>Buildings</td><td>OSM + Microsoft BF</td><td>Weekly sync</td><td>Municipal + EEC (20,877 features)</td></tr>
                <tr><td>News</td><td>Gemini 2.0 Flash (geocoded)</td><td>15 min</td><td>Chonburi + EEC</td></tr>
                <tr><td>Markets</td><td>FMP / FRED</td><td>15 min / daily</td><td>SET + global</td></tr>
                <tr><td>Forecast</td><td>TimesFM 2.0 (zero-shot)</td><td>Hourly</td><td>5 metrics, 24 h ahead</td></tr>
              </tbody>
            </table>
          </section>

          {/* ── Intelligence lens ── */}
          <section className="manual-section whitepaper-bilingual">
            <div className="whitepaper-col">
              <h3 className="manual-h3">Intelligence Lens — INT <span className="mono" style={{fontSize:"0.75em",color:"var(--accent)"}}>NEW</span></h3>
              <p>
                The INT lens is the dashboard's synthesis layer — it wires TimesFM
                forecasts directly to map layers and replaces the static panel layout
                with an operational situation digest.
              </p>
              <h4 className="manual-h4">Forecast → Map binding</h4>
              <p>
                Every row in the <strong>PREDICTIVE INTELLIGENCE</strong> panel is now
                clickable. Clicking a metric activates the corresponding map layer:
              </p>
              <table className="manual-table" style={{ marginTop: 8 }}>
                <thead><tr><th>Metric</th><th>Map layer activated</th></tr></thead>
                <tbody>
                  <tr><td>RAIN</td><td>GPM IMERG rainfall satellite</td></tr>
                  <tr><td>TIDE</td><td>Ferry / pier terminals (pans to coast)</td></tr>
                  <tr><td>INCIDENTS</td><td>Citizen reports (Traffy Fondue pins)</td></tr>
                  <tr><td>AQI</td><td>MODIS Aerosol + OMI NO₂ satellite</td></tr>
                  <tr><td>VESSELS</td><td>AIS live vessel positions</td></tr>
                </tbody>
              </table>
              <p style={{ marginTop: 8 }}>
                When a metric's p50 forecast exceeds its alert threshold, a red badge
                floats above the map canvas — visible from across the room.
              </p>
              <h4 className="manual-h4" style={{ marginTop: 12 }}>Situation Digest</h4>
              <p>
                The left rail in INT mode replaces ProvincialKPIs with a
                <strong> SITUATION DIGEST</strong> — a plain-language synthesis of the
                current active alerts, NASA MERRA-2 atmospheric readings, GISTDA
                solar average, and AQI forecast horizon. Status is NOMINAL (blue) or
                ALERT (red) depending on active forecast breaches.
              </p>
            </div>
            <div className="whitepaper-col whitepaper-th">
              <h3 className="manual-h3 serif">เลนส์ Intelligence — INT <span className="mono" style={{fontSize:"0.75em",color:"var(--accent)"}}>ใหม่</span></h3>
              <p className="serif">
                เลนส์ INT คือชั้นสังเคราะห์ข้อมูลของแดชบอร์ด — เชื่อมการพยากรณ์ TimesFM
                กับชั้นแผนที่โดยตรง และแสดงสรุปสถานการณ์ปฏิบัติการแทนเลย์เอาต์แผงแบบคงที่
              </p>
              <h4 className="manual-h4 serif">การเชื่อมพยากรณ์กับแผนที่</h4>
              <p className="serif">
                ทุกแถวในแผง <strong>PREDICTIVE INTELLIGENCE</strong>
                คลิกได้แล้ว การคลิกตัวชี้วัดจะเปิดชั้นแผนที่ที่สอดคล้อง:
              </p>
              <table className="manual-table" style={{ marginTop: 8 }}>
                <thead><tr><th>ตัวชี้วัด</th><th>ชั้นแผนที่ที่เปิดขึ้น</th></tr></thead>
                <tbody>
                  <tr><td>ฝน (RAIN)</td><td>ดาวเทียม GPM IMERG ปริมาณฝน</td></tr>
                  <tr><td>น้ำขึ้น-ลง (TIDE)</td><td>ท่าเรือ/เฟอร์รี่ (ปรับมุมมองสู่ชายฝั่ง)</td></tr>
                  <tr><td>เหตุการณ์ (INCIDENTS)</td><td>รายงานพลเมือง Traffy Fondue</td></tr>
                  <tr><td>คุณภาพอากาศ (AQI)</td><td>ดาวเทียม MODIS Aerosol + OMI NO₂</td></tr>
                  <tr><td>เรือ (VESSELS)</td><td>ตำแหน่งเรือ AIS แบบสด</td></tr>
                </tbody>
              </table>
              <p className="serif" style={{ marginTop: 8 }}>
                เมื่อค่าพยากรณ์ p50 เกินเกณฑ์ จะแสดงแถบสีแดงลอยอยู่เหนือแผนที่
                — มองเห็นได้จากระยะไกล
              </p>
              <h4 className="manual-h4 serif" style={{ marginTop: 12 }}>Situation Digest</h4>
              <p className="serif">
                แถบซ้ายในโหมด INT จะแสดง <strong>SITUATION DIGEST</strong>
                — สรุปสถานการณ์เป็นภาษาธรรมดา รวมการแจ้งเตือนที่ใช้งานอยู่
                ค่าบรรยากาศ NASA MERRA-2 ค่าเฉลี่ยพลังงานแสงอาทิตย์ GISTDA
                และขอบฟ้าพยากรณ์ AQI สถานะแสดง NOMINAL (น้ำเงิน)
                หรือ ALERT (แดง) ตามการแจ้งเตือนพยากรณ์ที่ใช้งาน
              </p>
            </div>
          </section>

          {/* ── Predictive intelligence ── */}
          <section className="manual-section whitepaper-bilingual">
            <div className="whitepaper-col">
              <h3 className="manual-h3">Predictive Intelligence — TimesFM</h3>
              <p>
                The left rail's <strong>PREDICTIVE INTELLIGENCE</strong> panel runs
                Google TimesFM 2.0 — a 200-million-parameter foundation model for
                time-series forecasting trained on 100 billion real-world data points.
              </p>
              <p>
                Every hour, the forecast service reads the latest sensor readings
                (precipitation, tidal height, AQI, incident count, vessel traffic)
                and produces a 24-point horizon with p10/p50/p90 confidence bands.
                When a metric's p50 forecast exceeds its threshold, an amber alert
                chip appears, the sparkline glows warm, and — in the INT lens —
                a red alert badge floats above the map canvas.
              </p>
              <p>
                <strong>Zero-shot</strong> means the model was never trained on
                Chonburi data specifically — it generalises from its vast pretraining
                corpus. Forecasts improve as historical data accumulates in Supabase.
              </p>
            </div>
            <div className="whitepaper-col whitepaper-th">
              <h3 className="manual-h3 serif">ปัญญาประดิษฐ์พยากรณ์ — TimesFM</h3>
              <p className="serif">
                แผง <strong>PREDICTIVE INTELLIGENCE</strong> ในแถบซ้ายใช้ Google TimesFM 2.0
                — โมเดลพื้นฐานพยากรณ์อนุกรมเวลา ขนาด 200 ล้านพารามิเตอร์
                ฝึกด้วยข้อมูลจริง 1 แสนล้านจุด
              </p>
              <p className="serif">
                ทุกชั่วโมง บริการพยากรณ์จะอ่านค่าเซนเซอร์ล่าสุด
                (ปริมาณฝน ระดับน้ำ AQI จำนวนเหตุการณ์ การจราจรทางเรือ)
                และคำนวณ 24 จุดพยากรณ์พร้อมช่วงความเชื่อมั่น p10/p50/p90
                หากค่า p50 เกินค่าเกณฑ์ จะแสดงแถบแจ้งเตือนสีอำพัน
                และในเลนส์ INT จะแสดงแถบสีแดงลอยเหนือแผนที่ด้วย
              </p>
              <p className="serif">
                <strong>Zero-shot</strong> หมายความว่าโมเดลไม่ได้ถูกฝึกด้วยข้อมูลชลบุรีโดยเฉพาะ
                แต่อาศัยความสามารถทั่วไปจากการฝึกขนาดใหญ่
                ความแม่นยำจะดีขึ้นเมื่อข้อมูลสะสมใน Supabase เพิ่มขึ้น
              </p>
            </div>
          </section>

          {/* ── Earth observation ── */}
          <section className="manual-section whitepaper-bilingual">
            <div className="whitepaper-col">
              <h3 className="manual-h3">Earth Observation</h3>
              <p>
                The EAR (Earth) lens loads 8 NASA GIBS satellite layers.
                None of these are commercial products — they are free,
                open-access imagery from NASA's Earth science fleet.
              </p>
              <table className="manual-table" style={{ marginTop: 8 }}>
                <thead><tr><th>Layer</th><th>Instrument</th><th>What it shows</th></tr></thead>
                <tbody>
                  <tr><td>True-color</td><td>MODIS Terra</td><td>Visible light, daily 250 m</td></tr>
                  <tr><td>VIIRS true-color</td><td>VIIRS NOAA-20</td><td>Sharper daily true-color</td></tr>
                  <tr><td>Night lights</td><td>VIIRS DNB</td><td>Industrial + urban electricity use</td></tr>
                  <tr><td>IMERG rainfall</td><td>GPM IMERG</td><td>Half-hourly precipitation rate</td></tr>
                  <tr><td>NDVI</td><td>MODIS Terra</td><td>8-day vegetation greenness</td></tr>
                  <tr><td>Land surface temp</td><td>MODIS Terra</td><td>Urban heat island, daily</td></tr>
                  <tr><td>Aerosol (AOD)</td><td>MODIS MAIAC</td><td>Haze + PM2.5 proxy</td></tr>
                  <tr><td>NO₂</td><td>OMI</td><td>Traffic + industrial nitrogen dioxide</td></tr>
                  <tr><td>Flood detection</td><td>MODIS combined</td><td>3-day flood surface mapping</td></tr>
                  <tr><td>Himawari IR</td><td>Himawari-9 B13</td><td>Cloud-top temp, 10-min</td></tr>
                </tbody>
              </table>
              <h4 className="manual-h4" style={{ marginTop: 12 }}>LIVE READINGS — NASA MERRA-2 <span className="mono" style={{fontSize:"0.7em",color:"var(--accent)"}}>NEW</span></h4>
              <p>
                The EAR panel now shows a <strong>LIVE READINGS</strong> strip sourced
                from the NASA POWER API (MERRA-2 modern-era reanalysis, no API key
                required). Values update daily with ~3-day publication latency:
              </p>
              <table className="manual-table" style={{ marginTop: 8 }}>
                <thead><tr><th>Reading</th><th>Parameter</th><th>Source</th></tr></thead>
                <tbody>
                  <tr><td>Temperature</td><td>2-m air temp (°C)</td><td>NASA MERRA-2</td></tr>
                  <tr><td>Precipitation</td><td>Daily total (mm/day)</td><td>NASA MERRA-2</td></tr>
                  <tr><td>Solar irradiance</td><td>Avg kWh/m²/mo across buildings</td><td>GISTDA LOD2</td></tr>
                  <tr><td>Sky clearness</td><td>ALLSKY_KT index (0–1)</td><td>NASA MERRA-2</td></tr>
                </tbody>
              </table>
              <p style={{ marginTop: 8 }}>
                GISTDA layers (POI, Solar LOD2, Land Use) are sourced from Thailand's
                Geo-Informatics and Space Technology Development Agency.
              </p>
            </div>
            <div className="whitepaper-col whitepaper-th">
              <h3 className="manual-h3 serif">การสำรวจโลกจากอวกาศ</h3>
              <p className="serif">
                เลนส์ EAR (Earth) โหลดภาพดาวเทียม NASA GIBS 8 ชั้น
                ทั้งหมดเป็นข้อมูลเปิดฟรีจากกองทัพดาวเทียมวิทยาศาสตร์โลกของ NASA
              </p>
              <h4 className="manual-h4 serif" style={{ marginTop: 12 }}>LIVE READINGS — NASA MERRA-2 <span className="mono" style={{fontSize:"0.7em",color:"var(--accent)"}}>ใหม่</span></h4>
              <p className="serif">
                แผง EAR มีแถบ <strong>LIVE READINGS</strong> ใหม่ที่ดึงข้อมูลจาก NASA POWER API
                (MERRA-2 reanalysis ไม่ต้องใช้ API key) อัปเดตรายวันโดยมีเวลาล่าช้าประมาณ 3 วัน:
                อุณหภูมิ 2 เมตร, ปริมาณฝนรายวัน (mm/day), ค่าเฉลี่ยพลังงานแสงอาทิตย์
                จาก GISTDA LOD2 (kWh/m²/เดือน) และดัชนีความโปร่งใสของท้องฟ้า ALLSKY_KT
              </p>
              <p className="serif">
                ชั้นข้อมูล GISTDA ได้แก่ POI Digital Twin, Solar LOD2 และ Land Use
                มาจากสำนักงานพัฒนาเทคโนโลยีอวกาศและภูมิสารสนเทศ (GISTDA) ของไทย
              </p>
              <p className="serif">
                การรวมดาวเทียมกับข้อมูลภาคพื้นดิน ช่วยให้ทีมปฏิบัติการตรวจสอบ
                น้ำท่วม ความร้อน หมอกควัน และการเปลี่ยนแปลงพื้นที่สีเขียว
                โดยไม่ต้องมีอุปกรณ์ GIS เฉพาะทาง
              </p>
            </div>
          </section>

          {/* ── How to use ── */}
          <section className="manual-section whitepaper-bilingual">
            <div className="whitepaper-col">
              <h3 className="manual-h3">How to Use This Dashboard</h3>
              <h4 className="manual-h4">Daily operations (OPS lens)</h4>
              <ol className="manual-flow">
                <li>Open the dashboard — it loads the OPS lens by default.</li>
                <li>Scan the top-bar feed chips — green dots are live, red are down.</li>
                <li>Check <strong>PREDICTIVE INTELLIGENCE</strong> for any amber alerts.</li>
                <li>Scan <strong>OPEN REPORTS</strong> count in the EO panel.</li>
                <li>Click any incident pin on the map for full details.</li>
              </ol>
              <h4 className="manual-h4" style={{ marginTop: 12 }}>Intelligence watch (INT lens)</h4>
              <ol className="manual-flow">
                <li>Switch to INT lens — SITUATION DIGEST appears above the KPI strip.</li>
                <li>Red badge above the map = a forecast metric has breached its threshold.</li>
                <li>Click any PREDICTIVE INTELLIGENCE row to activate its map layer.</li>
                <li>MERRA-2 temp + precip readings update the digest automatically.</li>
              </ol>
              <h4 className="manual-h4" style={{ marginTop: 12 }}>Flood watch (SAF + EAR lens)</h4>
              <ol className="manual-flow">
                <li>Switch to SAF lens: boundary line + waterways + flood-risk zones.</li>
                <li>Enable EAR lens or toggle IMERG rainfall + Flood detection layers.</li>
                <li>Watch the Predictive Panel for precipitation and tide alerts.</li>
                <li>Click flood-risk zone polygons — hover shows severity + households.</li>
              </ol>
              <h4 className="manual-h4" style={{ marginTop: 12 }}>Maritime / port watch (MAR lens)</h4>
              <ol className="manual-flow">
                <li>Switch to MAR lens: Laem Chabang port + AIS vessel live positions.</li>
                <li>Click any vessel dot for name, speed, heading, cargo type.</li>
                <li>Toggle distance-grid (1 km / 5 km / 10 km rings) for reach context.</li>
                <li>Watch TidePanel for wave height and tide cycle.</li>
              </ol>
              <h4 className="manual-h4" style={{ marginTop: 12 }}>Building intelligence (3D mode)</h4>
              <ol className="manual-flow">
                <li>Tap <strong>3D</strong> in the top bar to extrude buildings.</li>
                <li>Color encodes type: gold (temple), blue (civic), magenta→amber (height ramp).</li>
                <li>Heritage buildings show coloured roof caps — temple gold, hospital coral.</li>
                <li>Click any building for name, type, levels, and operator.</li>
                <li>Tap <strong>3DS</strong> for the underground view (utilities at burial depth).</li>
              </ol>
            </div>
            <div className="whitepaper-col whitepaper-th">
              <h3 className="manual-h3 serif">วิธีใช้งานแดชบอร์ด</h3>
              <h4 className="manual-h4 serif">ปฏิบัติการประจำวัน (เลนส์ OPS)</h4>
              <ol className="manual-flow serif">
                <li>เปิดแดชบอร์ด — โหลดเลนส์ OPS โดยอัตโนมัติ</li>
                <li>ตรวจสอบชิปฟีดบนแถบด้านบน — จุดเขียวคือสด จุดแดงคือขัดข้อง</li>
                <li>ตรวจสอบ <strong>PREDICTIVE INTELLIGENCE</strong> สำหรับการแจ้งเตือน</li>
                <li>ดูจำนวน <strong>OPEN REPORTS</strong> ในแผง EO</li>
                <li>คลิกหมุดเหตุการณ์บนแผนที่เพื่อดูรายละเอียด</li>
              </ol>
              <h4 className="manual-h4 serif" style={{ marginTop: 12 }}>เฝ้าระวังด้านปัญญา (เลนส์ INT)</h4>
              <ol className="manual-flow serif">
                <li>เปลี่ยนเป็นเลนส์ INT — SITUATION DIGEST จะปรากฏเหนือแถบ KPI</li>
                <li>แถบสีแดงเหนือแผนที่ = ตัวชี้วัดพยากรณ์เกินค่าเกณฑ์</li>
                <li>คลิกแถว PREDICTIVE INTELLIGENCE เพื่อเปิดชั้นแผนที่ที่เกี่ยวข้อง</li>
                <li>ค่าอุณหภูมิ + ปริมาณฝน MERRA-2 อัปเดต Digest โดยอัตโนมัติ</li>
              </ol>
              <h4 className="manual-h4 serif" style={{ marginTop: 12 }}>เฝ้าระวังน้ำท่วม (เลนส์ SAF + EAR)</h4>
              <ol className="manual-flow serif">
                <li>เปลี่ยนเป็นเลนส์ SAF: แนวขอบเขต + ทางน้ำ + โซนความเสี่ยงน้ำท่วม</li>
                <li>เปิดเลนส์ EAR หรือสลับชั้น IMERG + Flood detection</li>
                <li>ติดตาม Predictive Panel สำหรับการแจ้งเตือนฝนและน้ำขึ้น-ลง</li>
                <li>คลิกพื้นที่ความเสี่ยงน้ำท่วม — แสดงระดับความรุนแรงและจำนวนครัวเรือน</li>
              </ol>
              <h4 className="manual-h4 serif" style={{ marginTop: 12 }}>เฝ้าระวังท่าเรือ (เลนส์ MAR)</h4>
              <ol className="manual-flow serif">
                <li>เปลี่ยนเป็นเลนส์ MAR: ท่าเรือแหลมฉบัง + ตำแหน่งเรือ AIS แบบสด</li>
                <li>คลิกจุดเรือเพื่อดูชื่อ ความเร็ว ทิศทาง ประเภทสินค้า</li>
                <li>เปิดกริดระยะ (1/5/10 กม.) เพื่อดูรัศมีการเข้าถึง</li>
                <li>ดู TidePanel สำหรับความสูงคลื่นและรอบน้ำขึ้น-ลง</li>
              </ol>
            </div>
          </section>

          {/* ── Lens reference ── */}
          <section className="manual-section">
            <h3 className="manual-h3">Lens Reference · คู่มืออ้างอิงเลนส์</h3>
            <table className="manual-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>English name</th>
                  <th>ชื่อภาษาไทย</th>
                  <th>Best used for</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="mono">EXEC</td>
                  <td>Executive</td>
                  <td className="serif">ภาพรวมยุทธศาสตร์</td>
                  <td>Strategic overview — satellite + port + transit + open-data POIs</td>
                </tr>
                <tr>
                  <td className="mono">OPS</td>
                  <td>Operations</td>
                  <td className="serif">ปฏิบัติการ</td>
                  <td>Day-to-day — buildings, roads, civic POIs, traffic, incidents, CCTV</td>
                </tr>
                <tr>
                  <td className="mono">MOB</td>
                  <td>Mobility</td>
                  <td className="serif">การเคลื่อนที่</td>
                  <td>Traffic + transit + AIS + CCTV — routing and dispatch decisions</td>
                </tr>
                <tr>
                  <td className="mono">MAR</td>
                  <td>Maritime</td>
                  <td className="serif">ทางทะเล</td>
                  <td>Gulf port + ferry + AIS vessels + navigation aids + distance grid</td>
                </tr>
                <tr>
                  <td className="mono">ENV</td>
                  <td>Environment</td>
                  <td className="serif">สิ่งแวดล้อม</td>
                  <td>Satellite + flood zones + GISTDA solar — environmental planning</td>
                </tr>
                <tr>
                  <td className="mono">EAR</td>
                  <td>Earth</td>
                  <td className="serif">สำรวจโลก</td>
                  <td>NASA GIBS + MERRA-2 LIVE READINGS — rain, flood, heat, haze, NDVI, NO₂</td>
                </tr>
                <tr>
                  <td className="mono">SAF</td>
                  <td>Safety</td>
                  <td className="serif">ความปลอดภัย</td>
                  <td>Flood risk + citizen reports + hospitals/fire/police + CCTV</td>
                </tr>
                <tr>
                  <td className="mono">INT</td>
                  <td>Intelligence</td>
                  <td className="serif">ข่าวกรองรวม</td>
                  <td>TimesFM forecast → map layer binding + Situation Digest + alert badges <span className="mono" style={{fontSize:"0.7em",color:"var(--accent)"}}>NEW</span></td>
                </tr>
                <tr>
                  <td className="mono">VIB</td>
                  <td>Vibes</td>
                  <td className="serif">ภาพสวยงาม</td>
                  <td>Presentation view — true-color satellite + maritime overlay</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ── Sponsors / Credits ── */}
          <section className="manual-section">
            <h3 className="manual-h3">Partners &amp; Credits · พันธมิตรและเครดิต</h3>
            <div className="manual-grid-2">
              <ul className="manual-flow">
                <li><strong>Chonburi Town Municipality</strong> — เทศบาลเมืองชลบุรี (data owner)</li>
                <li><strong>depa</strong> — Digital Economy Promotion Agency (co-sponsor)</li>
                <li><strong>Smart City Thailand</strong> — OSMEP / NIA (framework)</li>
                <li><strong>Axiom</strong> — Innovation as a Service (platform engineering)</li>
              </ul>
              <ul className="manual-flow">
                <li><strong>NASA GIBS + POWER</strong> — satellite imagery + MERRA-2 climate (open access)</li>
                <li><strong>GISTDA</strong> — Thai geospatial data (open access)</li>
                <li><strong>OpenStreetMap</strong> — base map + buildings + roads</li>
                <li><strong>Google TimesFM 2.0</strong> — time-series forecast model (open weights)</li>
                <li><strong>AISStream.io</strong> — live vessel AIS feed</li>
                <li><strong>Traffy Fondue</strong> — citizen complaint platform</li>
                <li><strong>iTIC / Longdo</strong> — traffic events</li>
                <li><strong>Facebook Graph API</strong> — municipal page community updates</li>
              </ul>
            </div>
          </section>

          <footer className="manual-foot caption">
            CTM-01 v0.1 · Chonburi Town Center · Confidential — for municipal staff use.
            <span className="serif"> · ข้อมูลสำหรับเจ้าหน้าที่เทศบาล</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
