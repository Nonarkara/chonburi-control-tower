/**
 * ProvincialKPIs — real government data from data.go.th.
 * Replaces the stub "MUNICIPALITY OVERVIEW" that showed mocked numbers.
 *
 * Data sources:
 *   Population  — สำนักทะเบียน
 *   Tourism     — สำนักงานการท่องเที่ยวและกีฬาจังหวัดชลบุรี
 *   Hotel       — monthly occupancy %
 *   Accidents   — สถิติอุบัติเหตุรายอำเภอ
 *   Welfare     — ผู้สูงอายุ + ผู้พิการ (Bang Sarae sample)
 */

const MONTH_TH = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function fmtN(n: number | null | undefined, decimals = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toFixed(decimals);
}

interface Kpi {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

export interface ProvincialKPIs {
  population: { total: number; male: number; female: number; year: number } | null;
  tourism: {
    year: number | null;
    totalVisitors: number | null;
    thaiVisitors: number | null;
    foreignVisitors: number | null;
    revenueMillionBaht: number | null;
    topForeignNationality: string | null;
    topForeignCount: number | null;
  } | null;
  hotel: { occupancyPct: number | null; guestsThisMonth: number | null; year: number; month: number } | null;
  accidents: { incidents: number; injured: number; deaths: number; per100k: number | null; year: number } | null;
  hotspotDistrict: { name: string; deaths: number; year: number } | null;
  welfare: { elderly: number; disabled: number } | null;
}

interface Props {
  data: ProvincialKPIs | null;
  loading: boolean;
}

function KpiTile({ label, value, sub, color }: Kpi) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <div className="eyebrow">{label}</div>
      <div className="mono" style={{ fontSize: "var(--size-h2)", color: color ?? "var(--text)", lineHeight: 1.05 }}>
        {value}
      </div>
      {sub && <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>{sub}</div>}
    </div>
  );
}

export function ProvincialKPIs({ data, loading }: Props) {
  if (loading && !data) {
    return (
      <div className="col">
        <div className="eyebrow">CHONBURI PROVINCE // DATA.GO.TH</div>
        <div className="skeleton" style={{ height: 28, marginTop: 8 }} />
        <div className="skeleton" style={{ height: 28, marginTop: 6 }} />
      </div>
    );
  }
  if (!data) return null;

  const { population, tourism, hotel, accidents, hotspotDistrict, welfare } = data;

  const kpis: Kpi[] = [];

  if (population) {
    kpis.push({
      label: "POPULATION",
      value: fmtN(population.total),
      sub: `♂ ${fmtN(population.male)} · ♀ ${fmtN(population.female)} · ${population.year}`,
    });
  }

  if (tourism?.totalVisitors) {
    kpis.push({
      label: "VISITORS / YEAR",
      value: fmtN(tourism.totalVisitors),
      sub: tourism.year ? `${tourism.year} · ฿${fmtN(tourism.revenueMillionBaht)}M revenue` : undefined,
      color: "var(--accent)",
    });
  }

  if (tourism?.topForeignNationality && tourism.topForeignNationality !== "—") {
    kpis.push({
      label: "TOP FOREIGN",
      value: tourism.topForeignNationality,
      sub: `#1 · ${fmtN(tourism.topForeignCount)} visitors`,
    });
  }

  if (hotel?.occupancyPct != null) {
    const occ = hotel.occupancyPct;
    kpis.push({
      label: "HOTEL OCCUPANCY",
      value: `${occ.toFixed(1)}%`,
      sub: `${MONTH_TH[hotel.month] ?? hotel.month}/${hotel.year} · ${fmtN(hotel.guestsThisMonth)} guests`,
      color: occ >= 70 ? "var(--good)" : occ >= 50 ? "var(--accent)" : "var(--warn)",
    });
  }

  if (accidents) {
    kpis.push({
      label: "ROAD DEATHS / YEAR",
      value: String(accidents.deaths),
      sub: `${accidents.incidents} incidents · ${accidents.per100k?.toFixed(1) ?? "—"} per 100K · ${accidents.year}`,
      color: "var(--bad)",
    });
  }

  if (hotspotDistrict && hotspotDistrict.deaths > 0) {
    kpis.push({
      label: "DEADLIEST DISTRICT",
      value: hotspotDistrict.name.replace("อำเภอ", "").trim() || hotspotDistrict.name,
      sub: `${hotspotDistrict.deaths} deaths · ${hotspotDistrict.year}`,
      color: "var(--warn)",
    });
  }

  if (welfare) {
    kpis.push({
      label: "VULNERABLE PERSONS",
      value: fmtN(welfare.elderly + welfare.disabled),
      sub: `${fmtN(welfare.elderly)} elderly · ${fmtN(welfare.disabled)} disabled`,
    });
  }

  return (
    <div className="col" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="eyebrow">CHONBURI PROVINCE // DATA.GO.TH</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
        {kpis.map((k) => <KpiTile key={k.label} {...k} />)}
      </div>
      <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>
        SOURCE · DATA.GO.TH · สำนักงานจังหวัดชลบุรี + กระทรวงท่องเที่ยวและกีฬา
      </div>
    </div>
  );
}
