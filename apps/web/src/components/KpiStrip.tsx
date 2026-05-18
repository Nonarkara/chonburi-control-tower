import type { AirQualityPoint, IncidentFeature, WeatherSnapshot } from "@chula/shared";

interface Props {
  cityReports: IncidentFeature[];
  iticEvents: IncidentFeature[];
  airQuality: AirQualityPoint[];
  weather: WeatherSnapshot[];
}

function aqiColor(aqi: number): string {
  if (aqi <= 50) return "var(--good)";
  if (aqi <= 100) return "var(--warn)";
  if (aqi <= 150) return "var(--bad)";
  return "var(--crit)";
}

export function KpiStrip({ cityReports, iticEvents, airQuality, weather }: Props) {
  const openReports = cityReports.filter((r) => r.status !== "resolved").length;
  const totalEvents = iticEvents.length;
  const aq = airQuality[0];
  const w = weather[0];

  return (
    <div className="kpi-grid">
      <div className="kpi">
        <div className="label">TRAFFY:CR</div>
        <div className="value" style={{ color: openReports > 0 ? "var(--bad)" : "var(--good)" }}>
          {openReports}
        </div>
        <div className="sub">{cityReports.length} TOTAL // OPEN</div>
      </div>

      <div className="kpi">
        <div className="label">iTIC:EVT</div>
        <div className="value" style={{ color: totalEvents > 5 ? "var(--bad)" : totalEvents > 0 ? "var(--warn)" : "var(--text)" }}>
          {totalEvents}
        </div>
        <div className="sub">CAMPUS BBOX</div>
      </div>

      <div className="kpi">
        <div className="label">PM2.5:AQI</div>
        <div className="value" style={{ color: aq?.aqi != null ? aqiColor(aq.aqi) : "var(--text-3)" }}>
          {aq?.aqi ?? "—"}
        </div>
        <div className="sub">{aq?.pm25 != null ? `${aq.pm25.toFixed(1)} µG/M³` : "—"}</div>
      </div>

      <div className="kpi">
        <div className="label">TEMP:WX</div>
        <div className="value">{w?.tempC != null ? `${Math.round(w.tempC)}°` : "—"}</div>
        <div className="sub">{w ? `FL ${Math.round((w.feelsLikeC ?? w.tempC) ?? 0)}° // ${(w.windKmh ?? 0).toFixed(0)} KMH` : "—"}</div>
      </div>
    </div>
  );
}
