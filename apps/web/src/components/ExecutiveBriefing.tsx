/**
 * ExecutiveBriefing — Mayor's live situation panel for the EX lens.
 *
 * Shows: live situation alerts · city vitals snapshot · strategic initiatives ·
 * markets snapshot (when API keys are present). All data is sourced from live
 * feeds; nothing is manufactured. Clearly marks reference/modelled values.
 */

import type {
  ExecutiveSnapshot,
  WeatherSnapshot,
  AirQualityPoint,
  MarketSnapshot,
} from "@chonburi/shared";
import type { ReservoirStatus } from "./WaterPanel";

interface Props {
  executive: ExecutiveSnapshot | null;
  weather: WeatherSnapshot | null;
  airQuality: AirQualityPoint | null;
  openIncidents: number;
  reservoirs: ReservoirStatus[];
  markets: MarketSnapshot | null;
}

const LEVEL_COLOR: Record<string, string> = {
  critical: "var(--bad)",
  warning:  "var(--bad)",
  watch:    "var(--warn)",
  info:     "var(--data)",
};

const LEVEL_ICON: Record<string, string> = {
  critical: "▲",
  warning:  "▲",
  watch:    "◆",
  info:     "ℹ",
};

const STATUS_COLOR: Record<string, string> = {
  "on-track":  "var(--good)",
  "at-risk":   "var(--warn)",
  "delayed":   "var(--bad)",
  "completed": "var(--data)",
};

function aqiBand(aqi: number): string {
  if (aqi <= 50)  return "GOOD";
  if (aqi <= 100) return "MOD";
  if (aqi <= 150) return "USG";
  if (aqi <= 200) return "UNHEALTHY";
  return "VERY UNHEALTHY";
}

function aqiColor(aqi: number): string {
  if (aqi <= 50)  return "var(--good)";
  if (aqi <= 100) return "var(--data)";
  if (aqi <= 150) return "var(--warn)";
  return "var(--bad)";
}

function fmt1(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toFixed(1);
}

function fmtInt(v: number | null | undefined): string {
  if (v == null) return "—";
  return Math.round(v).toLocaleString();
}

function avgCapacityPct(reservoirs: ReservoirStatus[]): number | null {
  const vals = reservoirs
    .map((r) => r.capacityPct)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function ExecutiveBriefing({
  executive,
  weather,
  airQuality,
  openIncidents,
  reservoirs,
  markets,
}: Props) {
  const alerts = executive?.alerts ?? [];
  const initiatives = executive?.initiatives ?? [];
  const aqi = airQuality?.aqi ?? null;
  const avgReservoir = avgCapacityPct(reservoirs);
  const thbUsd = markets?.thb.find((t) => t.vs === "USD")?.rate;
  const sp500 = markets?.ticks.find((t) => t.symbol === "^GSPC");
  const wti = markets?.ticks.find((t) => t.name === "WTI Crude");

  const nowStr = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="executive-briefing">
      {/* Header */}
      <div className="exec-briefing-head">
        <span className="mono eyebrow">EXECUTIVE BRIEF</span>
        <span className="mono caption" style={{ color: "var(--text-3)" }}>{nowStr}</span>
      </div>

      {/* Situation alerts */}
      <div className="exec-briefing-section">
        <span className="mono eyebrow" style={{ color: "var(--text-3)" }}>SITUATION</span>
        {alerts.length === 0 ? (
          <div className="exec-briefing-nominal mono caption" role="status">
            ✓ NOMINAL — no active alerts
          </div>
        ) : (
          <ul className="exec-briefing-alerts" role="list" aria-label="Active situation alerts">
            {alerts.map((a) => (
              <li key={a.id} className="exec-briefing-alert"
                  style={{ borderLeftColor: LEVEL_COLOR[a.level] ?? "var(--line)" }}>
                <div className="exec-briefing-alert-row">
                  <span className="mono" style={{ color: LEVEL_COLOR[a.level] ?? "var(--text-2)", fontSize: "0.60rem", letterSpacing: "0.08em", fontWeight: 600 }}>
                    {LEVEL_ICON[a.level] ?? "·"} {a.level.toUpperCase()} · {a.category.toUpperCase()}
                  </span>
                </div>
                <div className="exec-briefing-alert-title">{a.title}</div>
                <div className="exec-briefing-alert-msg">{a.message}</div>
                {a.actionRequired && (
                  <div className="exec-briefing-alert-action mono">
                    → {a.actionRequired}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* City vitals */}
      <div className="exec-briefing-section">
        <span className="mono eyebrow" style={{ color: "var(--text-3)" }}>CITY VITALS</span>
        <div className="marine-detail-grid" role="group" aria-label="City vital statistics">
          <div>
            <span className="mono eyebrow" style={{ color: "var(--text-3)" }}>AQI</span>
            <span className="mono" style={{ color: aqi != null ? aqiColor(aqi) : "var(--text-2)" }}>
              {fmtInt(aqi)}{aqi != null ? ` · ${aqiBand(aqi)}` : ""}
            </span>
          </div>
          <div>
            <span className="mono eyebrow" style={{ color: "var(--text-3)" }}>TEMP</span>
            <span className="mono">{fmt1(weather?.tempC)}°C</span>
          </div>
          <div>
            <span className="mono eyebrow" style={{ color: "var(--text-3)" }}>REPORTS</span>
            <span className="mono" style={{ color: openIncidents > 5 ? "var(--warn)" : "var(--text)" }}>
              {openIncidents} OPEN
            </span>
          </div>
          <div>
            <span className="mono eyebrow" style={{ color: "var(--text-3)" }}>RESERVOIRS</span>
            <span className="mono" style={{ color: avgReservoir != null && avgReservoir < 30 ? "var(--warn)" : "var(--text)" }}>
              {avgReservoir != null ? `${Math.round(avgReservoir)}%` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Strategic initiatives */}
      {initiatives.length > 0 && (
        <div className="exec-briefing-section">
          <span className="mono eyebrow" style={{ color: "var(--text-3)" }}>INITIATIVES</span>
          <ul className="exec-briefing-initiatives" role="list">
            {initiatives.map((init) => (
              <li key={init.id} className="exec-briefing-initiative">
                <div className="exec-briefing-init-row">
                  <span className="exec-briefing-init-name">{init.name}</span>
                  <span className="mono" style={{
                    fontSize: "0.60rem",
                    letterSpacing: "0.06em",
                    color: STATUS_COLOR[init.status] ?? "var(--text-3)",
                  }}>
                    {init.status.toUpperCase().replace("-", " ")}
                  </span>
                </div>
                <div className="exec-briefing-progress-track" role="progressbar"
                     aria-valuenow={init.progressPct} aria-valuemin={0} aria-valuemax={100}
                     aria-label={`${init.name}: ${init.progressPct}% complete`}>
                  <div className="exec-briefing-progress-fill"
                       style={{
                         width: `${init.progressPct}%`,
                         background: STATUS_COLOR[init.status] ?? "var(--data)",
                       }} />
                </div>
                <div className="mono" style={{ fontSize: "0.58rem", color: "var(--text-3)" }}>
                  {init.progressPct}% · {init.owner} · {init.deadline}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Markets snapshot — only when live data is available */}
      {markets && (thbUsd != null || sp500 || wti) && (
        <div className="exec-briefing-section">
          <span className="mono eyebrow" style={{ color: "var(--text-3)" }}>MARKETS</span>
          <div className="marine-detail-grid">
            {thbUsd != null && (
              <div>
                <span className="mono eyebrow" style={{ color: "var(--text-3)" }}>THB / USD</span>
                <span className="mono">{thbUsd.toFixed(2)}</span>
              </div>
            )}
            {sp500 && (
              <div>
                <span className="mono eyebrow" style={{ color: "var(--text-3)" }}>S&amp;P 500</span>
                <span className="mono" style={{ color: (sp500.changePct ?? 0) >= 0 ? "var(--good)" : "var(--bad)" }}>
                  {sp500.value != null ? fmtInt(sp500.value) : "—"}
                  {sp500.changePct != null && (
                    <span style={{ fontSize: "0.72em", marginLeft: 4 }}>
                      {sp500.changePct >= 0 ? "▲" : "▼"}{Math.abs(sp500.changePct).toFixed(1)}%
                    </span>
                  )}
                </span>
              </div>
            )}
            {wti && (
              <div>
                <span className="mono eyebrow" style={{ color: "var(--text-3)" }}>WTI CRUDE</span>
                <span className="mono">${fmt1(wti.value)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
