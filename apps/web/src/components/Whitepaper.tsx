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
                The platform fuses 30+ live data feeds — traffic, incidents,
                air quality, satellite imagery, maritime AIS, tide, rainfall, news,
                and financial markets — into a single coherent map-first interface.
                Every panel shows what is happening, when, and where, so the mayor
                and operations staff can make faster, better-informed decisions.
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
                แพลตฟอร์มนี้รวบรวมข้อมูลสดกว่า 30 แหล่ง — การจราจร เหตุการณ์ฉุกเฉิน
                คุณภาพอากาศ ภาพถ่ายดาวเทียม AIS ทางทะเล น้ำขึ้น-ลง ปริมาณฝน ข่าวสาร
                และตลาดการเงิน — ไว้ในแผนที่เดียว ช่วยให้นายกเทศมนตรีและเจ้าหน้าที่
                ตัดสินใจได้เร็วและแม่นยำยิ่งขึ้น
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
                  <li><strong>API server</strong> — Hono (Node.js) running as macOS launchd service. 20+ adapter modules pre-warm data every 5 min; disk cache survives restarts.</li>
                  <li><strong>Forecast service</strong> — Python APScheduler + Google TimesFM 2.0 (200 M param, zero-shot). Runs hourly; writes 5-metric forecasts to Supabase.</li>
                  <li><strong>Database</strong> — Supabase PostgreSQL + PostGIS for city-twin state + forecast storage.</li>
                  <li><strong>Edge</strong> — Cloudflare Worker proxies select routes; CDN caches tile responses.</li>
                </ul>
              </div>
              <div>
                <h4 className="manual-h4">Frontend</h4>
                <ul className="manual-flow">
                  <li><strong>React 19 + Vite 6</strong> — fast refresh, code-split by panel.</li>
                  <li><strong>deck.gl 9.3 + MapLibre GL</strong> — WebGL2 map with 3D extrusion, heatmaps, AIS trails, satellite tiles.</li>
                  <li><strong>IBM Plex</strong> (Sans, Mono, Condensed, Thai) + <strong>Lora</strong> serif — self-hosted, no external font requests.</li>
                  <li><strong>Design DNA</strong> — Bauhaus functionalism × Swiss typography × East-Asian density. Red accent (#dc2626), deep blue data (#2563eb), no rounding or shadow.</li>
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
                <tr><td>Satellite</td><td>NASA GIBS (MODIS/VIIRS/IMERG/OMI) + Esri</td><td>15 min – 8 days</td><td>Global / regional</td></tr>
                <tr><td>POI data</td><td>GISTDA Digital Twin</td><td>Static</td><td>Thailand</td></tr>
                <tr><td>Solar irradiance</td><td>GISTDA LOD2</td><td>Static</td><td>Chonburi city centre</td></tr>
                <tr><td>Land use</td><td>GISTDA</td><td>Static</td><td>Chonburi province</td></tr>
                <tr><td>Buildings</td><td>OSM + Microsoft BF</td><td>Weekly sync</td><td>Municipal + EEC</td></tr>
                <tr><td>News</td><td>Gemini 2.0 Flash (geocoded)</td><td>15 min</td><td>Chonburi + EEC</td></tr>
                <tr><td>Markets</td><td>FMP / FRED</td><td>15 min / daily</td><td>SET + global</td></tr>
                <tr><td>Forecast</td><td>TimesFM 2.0 (zero-shot)</td><td>Hourly</td><td>5 metrics, 24 h ahead</td></tr>
              </tbody>
            </table>
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
                chip appears and the sparkline glows warm.
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
                <li>Color encodes height: magenta (low-rise) → amber (tower).</li>
                <li>Heritage buildings (temple, old town) show pitched roofs.</li>
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
                  <td>Gulf port + ferry + AIS vessels + navigation aids + fisheries</td>
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
                  <td>NASA GIBS — rain, flood, heat, haze, NDVI, NO₂, land use</td>
                </tr>
                <tr>
                  <td className="mono">SAF</td>
                  <td>Safety</td>
                  <td className="serif">ความปลอดภัย</td>
                  <td>Flood risk + citizen reports + hospitals/fire/police + CCTV</td>
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
                <li><strong>NASA GIBS</strong> — satellite imagery (open access)</li>
                <li><strong>GISTDA</strong> — Thai geospatial data (open access)</li>
                <li><strong>OpenStreetMap</strong> — base map + buildings + roads</li>
                <li><strong>Google TimesFM 2.0</strong> — time-series forecast model (open weights)</li>
                <li><strong>AISStream.io</strong> — live vessel AIS feed</li>
                <li><strong>Traffy Fondue</strong> — citizen complaint platform</li>
                <li><strong>iTIC / Longdo</strong> — traffic events</li>
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
