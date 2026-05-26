/**
 * WaterPanel — real-time reservoir status for Chonburi province.
 * Data: data.go.th สถานการณ์น้ำ (13 reservoirs, current % capacity, days remaining).
 *
 * Critical framing for the mayor:
 *   "How many days until we run out of water in the worst reservoir?"
 *   → <5 days: CRITICAL (red), <30 days: LOW (amber), <120 days: WATCH (yellow)
 */

export interface ReservoirStatus {
  name: string;
  district: string;
  capacityPct: number | null;
  currentVolMCM: number | null;
  maxVolMCM: number | null;
  daysRemaining: number | null;
  rainfallYesterdayMm: number | null;
  trend: "rising" | "falling" | "stable";
}

interface Props {
  data: ReservoirStatus[];
  loading: boolean;
  ageMinutes?: number;
}

function alertLevel(days: number | null): "critical" | "low" | "watch" | "ok" {
  if (days == null) return "ok";
  if (days < 10)   return "critical";
  if (days < 30)   return "low";
  if (days < 120)  return "watch";
  return "ok";
}

const LEVEL_COLOR = {
  critical: "var(--bad)",
  low:      "var(--warn)",
  watch:    "var(--accent)",
  ok:       "var(--good)",
};

function Bar({ pct, level }: { pct: number | null; level: string }) {
  const w = Math.max(0, Math.min(100, pct ?? 0));
  const col = LEVEL_COLOR[level as keyof typeof LEVEL_COLOR] ?? "var(--data)";
  return (
    <div style={{ height: 4, background: "var(--line)", position: "relative", marginTop: 2 }}>
      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${w}%`, background: col }} />
    </div>
  );
}

export function WaterPanel({ data, loading, ageMinutes }: Props) {
  if (loading && data.length === 0) {
    return (
      <div className="col">
        <div className="eyebrow">RESERVOIRS // CHONBURI PROVINCE</div>
        <div className="skeleton" style={{ height: 12, marginTop: 8 }} />
        <div className="skeleton" style={{ height: 12, marginTop: 6, width: "80%" }} />
      </div>
    );
  }
  if (!data.length) return null;

  // Critical alert — find worst case
  const worst = data[0]; // already sorted by days remaining
  const worstLevel = alertLevel(worst.daysRemaining);

  // Province aggregate
  const totalCurrent = data.reduce((s, r) => s + (r.currentVolMCM ?? 0), 0);
  const totalMax     = data.reduce((s, r) => s + (r.maxVolMCM ?? 0), 0);
  const totalPct     = totalMax > 0 ? Math.round((totalCurrent / totalMax) * 100) : null;

  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="spread" style={{ alignItems: "center" }}>
        <span className="eyebrow">RESERVOIRS // CHONBURI PROVINCE</span>
        {ageMinutes != null && (
          <span className="eyebrow mono" style={{ color: "var(--text-3)" }}>{ageMinutes}M AGO</span>
        )}
      </div>

      {/* Critical alert if worst < 30 days */}
      {(worstLevel === "critical" || worstLevel === "low") && (
        <div style={{
          border: `1px solid ${LEVEL_COLOR[worstLevel]}`,
          padding: "5px 8px",
          color: LEVEL_COLOR[worstLevel],
        }}>
          <div className="eyebrow mono">
            {worstLevel === "critical" ? "⚠ CRITICAL" : "⚠ LOW WATER"}
          </div>
          <div className="mono">
            {worst.name.replace("อ่างเก็บน้ำ","").trim()}
            {" — "}{worst.daysRemaining != null ? `${worst.daysRemaining}d remaining` : "—"}
          </div>
        </div>
      )}

      {/* Province total */}
      <div>
        <div className="spread" style={{ alignItems: "center" }}>
          <div className="eyebrow">PROVINCE TOTAL</div>
          <div className="eyebrow mono" style={{ color: totalPct != null && totalPct < 30 ? "var(--warn)" : "var(--data)" }}>
            {totalPct != null ? `${totalPct}%` : "—"}
          </div>
        </div>
        <Bar pct={totalPct} level={totalPct != null && totalPct < 30 ? "low" : "ok"} />
        <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>
          {totalCurrent.toFixed(1)} / {totalMax.toFixed(1)} MCM
        </div>
      </div>

      {/* Per-reservoir rows — show all 13 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((r) => {
          const level = alertLevel(r.daysRemaining);
          const col = LEVEL_COLOR[level];
          const shortName = r.name.replace("อ่างเก็บน้ำ","").replace("อ่างเก้บน้ำ","").trim();
          const trendArrow = r.trend === "rising" ? "↑" : r.trend === "falling" ? "↓" : "—";
          return (
            <div key={r.name} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <div className="spread" style={{ alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: col, fontFamily: "var(--font-mono)", fontSize: "var(--size-eyebrow)" }}>
                    {trendArrow}
                  </span>
                  <span style={{ fontSize: "var(--size-eyebrow)" }}>{shortName}</span>
                </div>
                <div className="eyebrow mono" style={{ color: col }}>
                  {r.capacityPct != null ? `${r.capacityPct.toFixed(0)}%` : "—"}
                  {r.daysRemaining != null ? ` · ${r.daysRemaining}d` : ""}
                </div>
              </div>
              <Bar pct={r.capacityPct} level={level} />
            </div>
          );
        })}
      </div>

      {/* Rain yesterday summary */}
      {data.some((r) => (r.rainfallYesterdayMm ?? 0) > 0) && (
        <div className="eyebrow mono" style={{ color: "var(--data)" }}>
          🌧 RAIN YESTERDAY:&nbsp;
          {data.filter(r => (r.rainfallYesterdayMm ?? 0) > 0)
            .map(r => `${r.name.replace("อ่างเก็บน้ำ","").trim()} ${r.rainfallYesterdayMm}mm`)
            .join(", ")}
        </div>
      )}

      <div className="eyebrow mono" style={{ color: "var(--text-3)" }}>
        SOURCE · DATA.GO.TH · สำนักงานจังหวัดชลบุรี
      </div>
    </div>
  );
}
