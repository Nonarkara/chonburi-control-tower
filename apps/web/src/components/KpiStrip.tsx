import type { AirQualityPoint, IncidentFeature, WeatherSnapshot } from "@chonburi/shared";
import { PanelHeader } from './PanelHeader';
import { aqiColor, aqiBand } from "../lib/coastal";

interface Props {
  cityReports: IncidentFeature[];
  iticEvents: IncidentFeature[];
  airQuality: AirQualityPoint[];
  weather: WeatherSnapshot[];
  ageMinutes?: number;
}


export function KpiStrip({ cityReports, iticEvents, airQuality, weather, ageMinutes }: Props) {
  const openReports = cityReports.filter((r) => r.status !== "resolved").length;
  const totalEvents = iticEvents.length;
  const aq = airQuality[0];
  const w = weather[0];

  return (
    <>
      <PanelHeader title="CITY PULSE" ageMinutes={ageMinutes} source="traffy·itic·aqicn·openmeteo" />
      <div className="kpi-grid">
      <div className="kpi" role="status" aria-label={`Citizen reports: ${openReports} open`}>
        <div className="label">TRAFFY:CR</div>
        <div className="value" style={{ color: openReports > 20 ? "var(--bad)" : openReports > 5 ? "var(--warn)" : openReports > 0 ? "var(--text)" : "var(--good)" }}>
          {openReports}
          <span className="kpi-status-word">{openReports > 20 ? "CRITICAL" : openReports > 5 ? "ELEVATED" : openReports > 0 ? "OPEN" : "CLEAR"}</span>
        </div>
        <div className="sub">{cityReports.length} TOTAL // OPEN</div>
      </div>

      <div className="kpi" role="status" aria-label={`Traffic events: ${totalEvents}`}>
        <div className="label">iTIC:EVT</div>
        <div className="value" style={{ color: totalEvents > 15 ? "var(--bad)" : totalEvents > 5 ? "var(--warn)" : "var(--text)" }}>
          {totalEvents}
          <span className="kpi-status-word">{totalEvents > 15 ? "HIGH" : totalEvents > 5 ? "ELEVATED" : totalEvents > 0 ? "ACTIVE" : "NOMINAL"}</span>
        </div>
        <div className="sub">MUNICIPAL AREA</div>
      </div>

      <div className="kpi" role="status"
        aria-label={aq?.aqi != null ? `AQI ${aq.aqi}, ${aqiBand(aq.aqi)}` : "AQI unavailable"}>
        <div className="label">PM2.5:AQI</div>
        <div className="value" style={{ color: aq?.aqi != null ? aqiColor(aq.aqi) : "var(--text-3)" }}>
          {aq?.aqi ?? "—"}
          {aq?.aqi != null && (
            <span className="kpi-status-word">{aqiBand(aq.aqi)}</span>
          )}
        </div>
        <div className="sub">{aq?.pm25 != null ? `${aq.pm25.toFixed(1)} µg/m³` : "—"}</div>
      </div>

      <div className="kpi" role="status"
        aria-label={w?.tempC != null ? `Temperature ${Math.round(w.tempC)} degrees` : "Temperature unavailable"}>
        <div className="label">TEMP:WX</div>
        <div className="value">{w?.tempC != null ? `${Math.round(w.tempC)}°` : "—"}</div>
        <div className="sub">{w ? `FL ${Math.round((w.feelsLikeC ?? w.tempC) ?? 0)}° // ${(w.windKmh ?? 0).toFixed(0)} KMH` : "—"}</div>
      </div>
    </div>
    </>
  );
}
