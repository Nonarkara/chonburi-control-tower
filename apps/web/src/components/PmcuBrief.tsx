import { useMemo } from "react";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { CuLandProperties } from "../map/layers";
import type { IncidentFeature } from "@chula/shared";

/**
 * PMCU operational brief — left-rail content focused on the pain points the
 * Vice President of Property Management actually owns:
 *
 *   1. Traffic and parking pressure on the campus arterials
 *   2. PM2.5 vs WHO guidance (Centenary Park study showed 2–3× exceedance)
 *   3. Shared-mobility fleet utilisation (Samyan Smart City partners)
 *   4. Active development pipeline (Blocks 28X / 33 / 34)
 *   5. Live incidents on or near PMCU-managed land
 *
 * Numbers tagged "live" come from the API; "modeled" come from the time-of-day
 * traffic simulator; "Samyan Smart City" are headline fleet sizes from
 * samyansmartcity.com/en/7-smarts/mobility. Replace with sensor feeds when
 * PMCU exposes them.
 */

interface Props {
  hour: number;
  isWeekend: boolean;
  iticEvents: IncidentFeature[];
  cityReports: IncidentFeature[];
  trafficSampleCount: number;
  cuLands: FeatureCollection<Polygon | MultiPolygon, CuLandProperties> | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Modeled mobility data — wired to swap with real feeds when PMCU exposes them
// ────────────────────────────────────────────────────────────────────────────

interface Corridor {
  id: string;
  name: string;
  // base congestion floor (0-1) at 03:00; multiplied by hourly profile.
  base: number;
}
const CORRIDORS: Corridor[] = [
  { id: "rama-1",       name: "Rama I",        base: 0.55 },
  { id: "rama-4",       name: "Rama IV",       base: 0.60 },
  { id: "phaya-thai",   name: "Phaya Thai",    base: 0.50 },
  { id: "henri-dunant", name: "Henri Dunant",  base: 0.45 },
];

// Time-of-day profile: idle overnight, two commute peaks, gentle midday floor.
function hourlyLoad(hour: number, isWeekend: boolean): number {
  const morningPeak = Math.exp(-((hour - 8) ** 2) / 1.8);
  const eveningPeak = Math.exp(-((hour - 17.5) ** 2) / 2.4);
  const overnight = hour >= 22 || hour < 5 ? 0.12 : 0.55;
  const weekendFactor = isWeekend ? 0.55 : 1;
  return Math.min(1.15, overnight + weekendFactor * 0.95 * Math.max(morningPeak, eveningPeak));
}

interface ParkingLot {
  id: string;
  name: string;
  capacity: number;
}
const PARKING_LOTS: ParkingLot[] = [
  { id: "PA", name: "Block A · Henri Dunant SE",  capacity: 720 },
  { id: "PB", name: "Block B · Henri Dunant NE",  capacity: 640 },
  { id: "PC", name: "Block C · Phaya Thai NE",    capacity: 580 },
  { id: "PD", name: "Block D · Phaya Thai SW",    capacity: 510 },
];

// Mock occupancy curve — full near peaks, near-empty overnight. Each lot lags
// the next by ~25 minutes so we don't paint identical bars.
function lotOccupancy(lot: ParkingLot, hour: number, isWeekend: boolean): number {
  const offset = (lot.id.charCodeAt(1) - 65) * 0.35;
  const adjusted = hour + offset;
  const morning = Math.exp(-((adjusted - 9.5) ** 2) / 4);
  const afternoon = Math.exp(-((adjusted - 14) ** 2) / 7);
  const evening = Math.exp(-((adjusted - 18) ** 2) / 4);
  const overnight = adjusted >= 22 || adjusted < 6 ? 0.05 : 0.2;
  const base = overnight + Math.max(morning, afternoon, evening) * (isWeekend ? 0.45 : 0.92);
  return Math.min(0.98, base);
}

// ────────────────────────────────────────────────────────────────────────────
// Samyan Smart City fleet (samyansmartcity.com/en/7-smarts/mobility)
// ────────────────────────────────────────────────────────────────────────────

interface FleetEntry {
  id: string;
  label: string;
  count: number;
  unit: string;
  note: string;
}
const FLEET: FleetEntry[] = [
  { id: "cu-pop",   label: "CU POP Bus",      count: 20,  unit: "EV buses",  note: "5 routes · free" },
  { id: "muvmi",    label: "MuvMi",           count: 30,  unit: "EV tuk-tuks", note: "≈ 700 trips/day" },
  { id: "beam",     label: "Beam scooters",   count: 180, unit: "scooters",  note: "40 parking stations" },
  { id: "anywheel", label: "Anywheel bikes",  count: 350, unit: "bikes",     note: "40 + stations" },
  { id: "haupcar",  label: "Haupcar EVs",     count: 10,  unit: "cars",      note: "6 stations · hourly" },
  { id: "ev-chg",   label: "EV charging",     count: 87,  unit: "terminals", note: "27 stations" },
];

// ────────────────────────────────────────────────────────────────────────────
// PMCU development pipeline (pmcu.co.th; Newswise Block 28X; Chula Sustain Block 33)
// ────────────────────────────────────────────────────────────────────────────

interface Development {
  id: string;
  name: string;
  status: "open" | "in-progress" | "planned";
  describe: string;
}
const DEVELOPMENTS: Development[] = [
  { id: "block-28x", name: "Block 28X",     status: "open",        describe: "Samyan workshops · young entrepreneurs" },
  { id: "block-33",  name: "Block 33",      status: "in-progress", describe: "Suan Luang–Samyan · residential + wellness" },
  { id: "block-34",  name: "Block 34",      status: "planned",     describe: "Suan Luang–Samyan · mixed-use" },
  { id: "walk-st",   name: "Siam Walk St.", status: "in-progress", describe: "Pedestrianised retail corridor" },
];
const DEV_COLOR: Record<Development["status"], string> = {
  open: "var(--good)",
  "in-progress": "var(--warn)",
  planned: "var(--text-3)",
};

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function PmcuBrief({ hour, isWeekend, iticEvents, cityReports, trafficSampleCount, cuLands }: Props) {
  const load = hourlyLoad(hour, isWeekend);

  // Portfolio stats from cu-lands.geojson — properties we can locate today.
  const portfolio = useMemo(() => {
    if (!cuLands) return { resolved: 0, byKind: new Map<string, number>() };
    const byKind = new Map<string, number>();
    for (const f of cuLands.features) {
      const k = (f as Feature<Polygon | MultiPolygon, CuLandProperties>).properties.kind;
      byKind.set(k, (byKind.get(k) ?? 0) + 1);
    }
    return { resolved: cuLands.features.length, byKind };
  }, [cuLands]);

  const totalParkingCapacity = PARKING_LOTS.reduce((s, l) => s + l.capacity, 0);
  const totalOccupied = PARKING_LOTS.reduce((s, l) => s + Math.round(l.capacity * lotOccupancy(l, hour, isWeekend)), 0);
  const totalOccupancyPct = Math.round((totalOccupied / totalParkingCapacity) * 100);

  const openIncidents = cityReports.filter((r) => r.status !== "resolved").length + iticEvents.length;

  return (
    <div className="pmcu-brief">
      {/* ── Portfolio rollup ── */}
      <section className="pmcu-section">
        <header className="pmcu-h">
          <span className="eyebrow mono">PMCU portfolio</span>
          <span className="mono caption">~ 1,153 rai</span>
        </header>
        <div className="pmcu-kv-grid">
          <div className="pmcu-kv">
            <div className="num">{portfolio.resolved}</div>
            <div className="lbl">PROPERTIES MAPPED</div>
          </div>
          <div className="pmcu-kv">
            <div className="num">{openIncidents}</div>
            <div className="lbl">OPEN INCIDENTS</div>
          </div>
        </div>
      </section>

      {/* ── Mobility — campus arterials ── */}
      <section className="pmcu-section">
        <header className="pmcu-h">
          <span className="eyebrow mono">Arterial load</span>
          <span className="mono caption">hour {String(hour).padStart(2, "0")}{isWeekend ? " · weekend" : ""}</span>
        </header>
        <ul className="pmcu-rows">
          {CORRIDORS.map((c) => {
            const pct = Math.min(1, c.base * load * 1.4);
            const colour =
              pct > 0.8 ? "var(--bad)" : pct > 0.6 ? "var(--warn)" : pct > 0.4 ? "var(--data)" : "var(--good)";
            return (
              <li key={c.id} className="pmcu-row">
                <span className="pmcu-row-name">{c.name}</span>
                <span className="pmcu-row-bar">
                  <span className="pmcu-row-fill" style={{ width: `${Math.round(pct * 100)}%`, background: colour }} />
                </span>
                <span className="pmcu-row-val mono">{Math.round(pct * 100)}%</span>
              </li>
            );
          })}
        </ul>
        <div className="pmcu-foot mono">
          {trafficSampleCount} road samples · modeled · iTIC live: {iticEvents.length}
        </div>
      </section>

      {/* ── 4-corner parking ── */}
      <section className="pmcu-section">
        <header className="pmcu-h">
          <span className="eyebrow mono">Parking — 4 corners</span>
          <span className="mono caption">{totalOccupied}/{totalParkingCapacity} · {totalOccupancyPct}%</span>
        </header>
        <ul className="pmcu-rows">
          {PARKING_LOTS.map((lot) => {
            const occ = lotOccupancy(lot, hour, isWeekend);
            const filled = Math.round(lot.capacity * occ);
            const colour = occ > 0.9 ? "var(--bad)" : occ > 0.75 ? "var(--warn)" : "var(--good)";
            return (
              <li key={lot.id} className="pmcu-row">
                <span className="pmcu-row-name" title={lot.name}>{lot.id}</span>
                <span className="pmcu-row-bar">
                  <span className="pmcu-row-fill" style={{ width: `${Math.round(occ * 100)}%`, background: colour }} />
                </span>
                <span className="pmcu-row-val mono">{filled}/{lot.capacity}</span>
              </li>
            );
          })}
        </ul>
        <div className="pmcu-foot mono">modeled · sensor feed pending PMCU integration</div>
      </section>

      {/* ── Shared-mobility fleet ── */}
      <section className="pmcu-section">
        <header className="pmcu-h">
          <span className="eyebrow mono">Shared fleet · Samyan Smart City</span>
          <span className="mono caption">≈ 3M trips/yr</span>
        </header>
        <ul className="pmcu-fleet">
          {FLEET.map((f) => (
            <li key={f.id} className="pmcu-fleet-row">
              <span className="pmcu-fleet-name">{f.label}</span>
              <span className="mono pmcu-fleet-count">{f.count}</span>
              <span className="pmcu-fleet-unit caption">{f.unit}</span>
              <span className="pmcu-fleet-note caption">{f.note}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Active developments ── */}
      <section className="pmcu-section">
        <header className="pmcu-h">
          <span className="eyebrow mono">Active developments</span>
          <span className="mono caption">PMCU pipeline</span>
        </header>
        <ul className="pmcu-rows">
          {DEVELOPMENTS.map((d) => (
            <li key={d.id} className="pmcu-row pmcu-dev-row">
              <span className="pmcu-dev-dot" style={{ background: DEV_COLOR[d.status] }} />
              <span className="pmcu-row-name">{d.name}</span>
              <span className="pmcu-row-val mono caption" style={{ color: DEV_COLOR[d.status] }}>
                {d.status.toUpperCase()}
              </span>
            </li>
          ))}
        </ul>
        <div className="pmcu-foot mono">Block 28X · 33 · 34 · Siam Walk St.</div>
      </section>
    </div>
  );
}
