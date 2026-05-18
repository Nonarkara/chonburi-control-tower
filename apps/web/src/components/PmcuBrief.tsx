import { useMemo } from "react";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { CuLandProperties } from "../map/layers";
import type { IncidentFeature } from "@chonburi/shared";

interface Props {
  hour: number;
  isWeekend: boolean;
  iticEvents: IncidentFeature[];
  cityReports: IncidentFeature[];
  trafficSampleCount: number;
  cuLands: FeatureCollection<Polygon | MultiPolygon, CuLandProperties> | null;
}

interface Corridor {
  id: string;
  name: string;
  base: number;
}
const CORRIDORS: Corridor[] = [
  { id: "sukhumvit",  name: "Sukhumvit Hwy",   base: 0.60 },
  { id: "coastal",    name: "Coastal Road",     base: 0.50 },
  { id: "klang",      name: "Klang Mueang Rd",  base: 0.45 },
  { id: "phanat",     name: "Pha Nat Road",     base: 0.42 },
];

function hourlyLoad(hour: number, isWeekend: boolean): number {
  const morningPeak = Math.exp(-((hour - 8) ** 2) / 1.8);
  const eveningPeak = Math.exp(-((hour - 17.5) ** 2) / 2.4);
  const overnight = hour >= 22 || hour < 5 ? 0.12 : 0.55;
  const weekendFactor = isWeekend ? 0.55 : 1;
  return Math.min(1.15, overnight + weekendFactor * 0.95 * Math.max(morningPeak, eveningPeak));
}

interface ParkingZone {
  id: string;
  name: string;
  capacity: number;
}
const PARKING_ZONES: ParkingZone[] = [
  { id: "P1", name: "Municipal Hall · North",   capacity: 320 },
  { id: "P2", name: "Market District · East",   capacity: 480 },
  { id: "P3", name: "Coastal Park · West",      capacity: 260 },
  { id: "P4", name: "Hospital Complex · South", capacity: 410 },
];

function zoneOccupancy(zone: ParkingZone, hour: number, isWeekend: boolean): number {
  const offset = (zone.id.charCodeAt(1) - 49) * 0.35;
  const adjusted = hour + offset;
  const morning = Math.exp(-((adjusted - 9.5) ** 2) / 4);
  const afternoon = Math.exp(-((adjusted - 14) ** 2) / 7);
  const evening = Math.exp(-((adjusted - 18) ** 2) / 4);
  const overnight = adjusted >= 22 || adjusted < 6 ? 0.05 : 0.2;
  const base = overnight + Math.max(morning, afternoon, evening) * (isWeekend ? 0.45 : 0.92);
  return Math.min(0.98, base);
}

interface FleetEntry {
  id: string;
  label: string;
  count: number;
  unit: string;
  note: string;
}
const FLEET: FleetEntry[] = [
  { id: "muni-bus",  label: "Municipal Bus",   count: 12, unit: "buses",   note: "3 routes · scheduled" },
  { id: "songthaew", label: "Songthaew",       count: 45, unit: "vehicles", note: "city centre routes" },
  { id: "tuk-tuk",   label: "Tuk-tuk",         count: 80, unit: "vehicles", note: "market + tourist areas" },
  { id: "moto-taxi", label: "Moto-taxi",        count: 120, unit: "drivers", note: "licensed stands" },
];

interface Development {
  id: string;
  name: string;
  status: "open" | "in-progress" | "planned";
  describe: string;
}
const DEVELOPMENTS: Development[] = [
  { id: "smart-city",    name: "Smart City Hub",       status: "in-progress", describe: "DEPA-backed IoT + open data infrastructure" },
  { id: "flood-infra",   name: "Flood Retention Basin",status: "in-progress", describe: "Urban drainage upgrade · coastal flood mitigation" },
  { id: "digital-svc",   name: "Digital Services",     status: "open",        describe: "Online permits, payments, citizen reporting" },
  { id: "eec-link",      name: "EEC Last-Mile Link",   status: "planned",     describe: "Bus rapid transit to EEC industrial zones" },
];
const DEV_COLOR: Record<Development["status"], string> = {
  open: "var(--good)",
  "in-progress": "var(--warn)",
  planned: "var(--text-3)",
};

export function PmcuBrief({ hour, isWeekend, iticEvents, cityReports, trafficSampleCount, cuLands }: Props) {
  const load = hourlyLoad(hour, isWeekend);

  const portfolio = useMemo(() => {
    if (!cuLands) return { resolved: 0, byKind: new Map<string, number>() };
    const byKind = new Map<string, number>();
    for (const f of cuLands.features) {
      const k = (f as Feature<Polygon | MultiPolygon, CuLandProperties>).properties.kind;
      byKind.set(k, (byKind.get(k) ?? 0) + 1);
    }
    return { resolved: cuLands.features.length, byKind };
  }, [cuLands]);

  const totalParkingCapacity = PARKING_ZONES.reduce((s, z) => s + z.capacity, 0);
  const totalOccupied = PARKING_ZONES.reduce((s, z) => s + Math.round(z.capacity * zoneOccupancy(z, hour, isWeekend)), 0);
  const totalOccupancyPct = Math.round((totalOccupied / totalParkingCapacity) * 100);

  const openIncidents = cityReports.filter((r) => r.status !== "resolved").length + iticEvents.length;

  return (
    <div className="pmcu-brief">
      {/* ── Municipality overview ── */}
      <section className="pmcu-section">
        <header className="pmcu-h">
          <span className="eyebrow mono">Municipality overview</span>
          <span className="mono caption">เทศบาลเมืองชลบุรี</span>
        </header>
        <div className="pmcu-kv-grid">
          <div className="pmcu-kv">
            <div className="num">{portfolio.resolved || "—"}</div>
            <div className="lbl">ZONES MAPPED</div>
          </div>
          <div className="pmcu-kv">
            <div className="num">{openIncidents}</div>
            <div className="lbl">OPEN INCIDENTS</div>
          </div>
        </div>
      </section>

      {/* ── Arterial load ── */}
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

      {/* ── Parking zones ── */}
      <section className="pmcu-section">
        <header className="pmcu-h">
          <span className="eyebrow mono">Parking zones</span>
          <span className="mono caption">{totalOccupied}/{totalParkingCapacity} · {totalOccupancyPct}%</span>
        </header>
        <ul className="pmcu-rows">
          {PARKING_ZONES.map((zone) => {
            const occ = zoneOccupancy(zone, hour, isWeekend);
            const filled = Math.round(zone.capacity * occ);
            const colour = occ > 0.9 ? "var(--bad)" : occ > 0.75 ? "var(--warn)" : "var(--good)";
            return (
              <li key={zone.id} className="pmcu-row">
                <span className="pmcu-row-name" title={zone.name}>{zone.id}</span>
                <span className="pmcu-row-bar">
                  <span className="pmcu-row-fill" style={{ width: `${Math.round(occ * 100)}%`, background: colour }} />
                </span>
                <span className="pmcu-row-val mono">{filled}/{zone.capacity}</span>
              </li>
            );
          })}
        </ul>
        <div className="pmcu-foot mono">modeled · sensor feed pending integration</div>
      </section>

      {/* ── Transport fleet ── */}
      <section className="pmcu-section">
        <header className="pmcu-h">
          <span className="eyebrow mono">Transport fleet</span>
          <span className="mono caption">Chonburi city area</span>
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
          <span className="mono caption">municipal pipeline</span>
        </header>
        <ul className="pmcu-rows">
          {DEVELOPMENTS.map((d) => (
            <li key={d.id} className="pmcu-row pmcu-dev-row">
              <span className="pmcu-dev-dot" style={{ background: DEV_COLOR[d.status] }} />
              <span className="pmcu-row-name">{d.name}</span>
              <span className="pmcu-row-val mono caption" style={{ color: DEV_COLOR[d.status] }}>
                {d.status}
              </span>
            </li>
          ))}
        </ul>
        <ul className="pmcu-rows" style={{ marginTop: 4 }}>
          {DEVELOPMENTS.map((d) => (
            <li key={`${d.id}-desc`} className="pmcu-dev-desc caption">{d.describe}</li>
          ))}
        </ul>
        <div className="pmcu-foot mono">municipal pipeline · data: official comms</div>
      </section>
    </div>
  );
}
