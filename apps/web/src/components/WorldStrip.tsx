import { useEffect, useMemo, useRef, useState } from "react";
import { useCustomClocks, searchCities, type ClockSpec } from "../hooks/useCustomClocks";
import type { PrecipNowcast } from "@chonburi/shared";

interface TrendPoint { at: string; aqi: number; pm25: number }

interface AqiTrend {
  station: string;
  category: "good" | "moderate" | "unhealthy-sg" | "unhealthy" | "very-unhealthy" | "hazardous";
  current: { aqi: number; pm25: number; observedAt: string };
  next8h: TrendPoint[];
  source: string;
}

interface Props {
  bangkokAqi: number | null;
  bangkokPm25: number | null;
  // Weather for the Bangkok host block — fetched in useWorldWeather.
  bangkokWeather: {
    tempC: number | null;
    apparentTempC: number | null;
    humidity: number | null;
    rainNow: number | null;
    windKmh: number | null;
    windDeg: number | null;
    uv: number | null;
    cloudPct: number | null;
    pressurehPa: number | null;
    visKm: number | null;
    isDay: boolean | null;
    condition: string;
    sunrise: string | null;
    sunset: string | null;
    daily: Array<{ date: string; tempMaxC: number; tempMinC: number; precipMm: number; precipProb: number }>;
  } | null;
  bangkokPulse: {
    iticEvents: number;
    openReports: number;
    news24h: number;
    shuttleLive: number;
  };
  precipNowcast: PrecipNowcast | null;
}

function timeInTz(tz: string, now: Date): { hms: string; hm: string; offset: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hms = `${get("hour")}:${get("minute")}:${get("second")}`;
  const hm = `${get("hour")}:${get("minute")}`;
  const offFmt = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "shortOffset" });
  const offset = offFmt.formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "";
  return { hms, hm, offset };
}

const fmtTemp = (t: number | null) => (t == null ? "—" : `${Math.round(t)}°`);
const fmtPct = (p: number | null) => (p == null ? "—" : `${Math.round(p)}%`);
const fmtInt = (n: number | null) => (n == null ? "—" : String(Math.round(n)));
const fmtFix = (n: number | null, d = 1) => (n == null ? "—" : n.toFixed(d));

function windDirLabel(deg: number | null): string {
  if (deg == null) return "—";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function uvBand(uv: number | null): { label: string; color: string } {
  if (uv == null) return { label: "—", color: "var(--text-3)" };
  if (uv < 3)  return { label: "low",       color: "var(--good)" };
  if (uv < 6)  return { label: "moderate",  color: "var(--warn)" };
  if (uv < 8)  return { label: "high",      color: "var(--bad)" };
  if (uv < 11) return { label: "very high", color: "var(--bad)" };
  return { label: "extreme", color: "var(--crit)" };
}

function hmFromIso(iso: string | null, tz = "Asia/Bangkok"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function pulseColor(n: number, warn: number, bad: number): string {
  if (n >= bad) return "var(--bad)";
  if (n >= warn) return "var(--warn)";
  return "var(--text)";
}

function aqiBand(aqi: number | null): { label: string; color: string } {
  if (aqi == null) return { label: "—", color: "var(--text-3)" };
  if (aqi <= 50) return { label: "good", color: "var(--good)" };
  if (aqi <= 100) return { label: "moderate", color: "var(--warn)" };
  if (aqi <= 150) return { label: "unhealthy SG", color: "var(--bad)" };
  if (aqi <= 200) return { label: "unhealthy", color: "var(--bad)" };
  return { label: "hazardous", color: "var(--crit)" };
}

function dayLabel(iso: string, hostTz = "Asia/Bangkok"): string {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("en-US", { timeZone: hostTz, weekday: "short" }).format(d).toUpperCase();
}

function rainBadge(p: PrecipNowcast | null): { label: string; sub: string; color: string } {
  if (!p) return { label: "—", sub: "rain nowcast loading", color: "var(--text-3)" };
  if (p.intensity === "dry") return { label: "DRY 2H", sub: `${p.total2hMm.toFixed(1)} mm forecast`, color: "var(--good)" };
  const mins = p.minutesToSignificant;
  if (p.intensity === "heavy") {
    return {
      label: mins != null ? `RAIN ${mins}m` : "RAIN NOW",
      sub: `peak ${p.peakMm} mm · ${p.total2hMm.toFixed(1)} mm / 2h`,
      color: "var(--bad)",
    };
  }
  if (p.intensity === "moderate") {
    return {
      label: mins != null ? `RAIN ${mins}m` : "RAIN NOW",
      sub: `peak ${p.peakMm} mm · ${p.total2hMm.toFixed(1)} mm / 2h`,
      color: "var(--warn)",
    };
  }
  return {
    label: mins != null ? `DRIZZLE ${mins}m` : "DRIZZLE",
    sub: `peak ${p.peakMm} mm · ${p.total2hMm.toFixed(1)} mm / 2h`,
    color: "var(--data)",
  };
}

export function WorldStrip({ bangkokAqi, bangkokPm25, bangkokWeather, bangkokPulse, precipNowcast }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { clocks, setAt, slots } = useCustomClocks();
  const [editing, setEditing] = useState<number | null>(null);

  const aqi = aqiBand(bangkokAqi);
  const uv = uvBand(bangkokWeather?.uv ?? null);
  const wind = bangkokWeather?.windKmh ?? null;
  const windDir = windDirLabel(bangkokWeather?.windDeg ?? null);
  const sunrise = hmFromIso(bangkokWeather?.sunrise ?? null);
  const sunset = hmFromIso(bangkokWeather?.sunset ?? null);
  const sunLabel = bangkokWeather?.isDay === false ? "SUNRISE" : "SUNSET";
  const sunTime = bangkokWeather?.isDay === false ? sunrise : sunset;

  return (
    <div className="world-strip">
      <section className="world-host">
        <div className="world-host-head">
          <span className="eyebrow mono">Bangkok · host</span>
          <span className="mono caption">
            {timeInTz("Asia/Bangkok", now).hms} · {timeInTz("Asia/Bangkok", now).offset}
          </span>
        </div>
        <div className="world-host-row">
          <div className="world-host-now">
            <span className="world-host-temp">{fmtTemp(bangkokWeather?.tempC ?? null)}</span>
            <span className="world-host-cond">{bangkokWeather?.condition ?? "—"}</span>
            <span className="world-host-feels mono">
              FL {fmtTemp(bangkokWeather?.apparentTempC ?? null)}
            </span>
          </div>
          <div className="world-host-stats">
            <div className="world-stat">
              <span className="lbl">HUMIDITY</span>
              <span className="val mono">{fmtPct(bangkokWeather?.humidity ?? null)}</span>
            </div>
            <div className="world-stat">
              <span className="lbl">WIND</span>
              <span className="val mono">{wind != null ? `${Math.round(wind)}` : "—"}</span>
              <span className="sub mono">{wind != null ? `KM/H ${windDir}` : "—"}</span>
            </div>
            <div className="world-stat">
              <span className="lbl">UV</span>
              <span className="val mono" style={{ color: uv.color }}>{fmtFix(bangkokWeather?.uv ?? null, 1)}</span>
              <span className="sub mono" style={{ color: uv.color }}>{uv.label}</span>
            </div>
            <div className="world-stat">
              <span className="lbl">AQI</span>
              <span className="val mono" style={{ color: aqi.color }}>{bangkokAqi ?? "—"}</span>
              <span className="sub mono" style={{ color: aqi.color }}>
                {bangkokPm25 != null ? `PM2.5 ${bangkokPm25.toFixed(1)}` : aqi.label}
              </span>
            </div>
            <div className="world-stat">
              <span className="lbl">NOWCAST</span>
              <span className="val mono" style={{ color: rainBadge(precipNowcast).color }}>
                {rainBadge(precipNowcast).label}
              </span>
              <span className="sub mono" style={{ color: rainBadge(precipNowcast).color }}>
                {rainBadge(precipNowcast).sub}
              </span>
            </div>
            <div className="world-stat">
              <span className="lbl">RAIN NOW</span>
              <span className="val mono">{fmtFix(bangkokWeather?.rainNow ?? null, 1)}</span>
              <span className="sub mono">MM/H · CLOUD {fmtPct(bangkokWeather?.cloudPct ?? null)}</span>
            </div>
            <div className="world-stat">
              <span className="lbl">VIS</span>
              <span className="val mono">{fmtFix(bangkokWeather?.visKm ?? null, 1)}</span>
              <span className="sub mono">
                KM · {fmtInt(bangkokWeather?.pressurehPa ?? null)} hPa
              </span>
            </div>
            <div className="world-stat">
              <span className="lbl">{sunLabel}</span>
              <span className="val mono">{sunTime}</span>
              <span className="sub mono">↑ {sunrise} · ↓ {sunset}</span>
            </div>
          </div>
          <div className="world-host-pulse" aria-label="Bangkok live operational pulse">
            <div className="pulse-head">
              <span className="dot live" />
              <span className="eyebrow mono">Bangkok pulse</span>
            </div>
            <div className="pulse-grid">
              <div className="pulse-cell">
                <span className="lbl">iTIC EVT</span>
                <span
                  className="val mono"
                  style={{ color: pulseColor(bangkokPulse.iticEvents, 1, 6) }}
                >
                  {bangkokPulse.iticEvents}
                </span>
              </div>
              <div className="pulse-cell">
                <span className="lbl">CR OPEN</span>
                <span
                  className="val mono"
                  style={{ color: pulseColor(bangkokPulse.openReports, 1, 11) }}
                >
                  {bangkokPulse.openReports}
                </span>
              </div>
              <div className="pulse-cell">
                <span className="lbl">NEWS 24H</span>
                <span className="val mono">{bangkokPulse.news24h}</span>
              </div>
              <div className="pulse-cell">
                <span className="lbl">CU BUS</span>
                <span className="val mono">{bangkokPulse.shuttleLive}</span>
              </div>
            </div>
          </div>
          <div className="world-forecast" aria-label="5-day rain probability">
            {(bangkokWeather?.daily ?? []).slice(0, 5).map((d, i) => (
              <div className="world-day" key={d.date}>
                <span className="world-day-name mono">{i === 0 ? "TODAY" : dayLabel(d.date)}</span>
                <span className="world-day-bar" title={`${d.precipProb}% rain · ${d.precipMm.toFixed(1)}mm`}>
                  <span
                    className="world-day-fill"
                    style={{
                      height: `${Math.max(6, Math.round(d.precipProb))}%`,
                      background:
                        d.precipProb >= 70 ? "var(--bad)"
                          : d.precipProb >= 40 ? "var(--warn)"
                            : "var(--data)",
                    }}
                  />
                </span>
                <span className="world-day-pct mono">{Math.round(d.precipProb)}%</span>
                <span className="world-day-temp mono">
                  {Math.round(d.tempMinC)}–{Math.round(d.tempMaxC)}°
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3 user-editable clock slots ── */}
      <section className="world-partners">
        {Array.from({ length: slots }, (_, idx) => {
          const c = clocks[idx];
          return c ? (
            <button
              type="button"
              className="world-city world-city-filled"
              key={c.id + idx}
              onClick={() => setEditing(idx)}
              title="Click to change this clock"
            >
              <span className="world-city-name">{c.label}</span>
              <span className="world-city-time mono">{timeInTz(c.tz, now).hm}</span>
              <span className="world-city-meta mono">
                {c.country} · {timeInTz(c.tz, now).offset.replace("GMT", "UTC")}
              </span>
              <span className="world-city-tz mono">{c.tz.split("/")[1]?.replace(/_/g, " ") ?? c.tz}</span>
            </button>
          ) : (
            <button
              type="button"
              className="world-city world-city-empty"
              key={`empty-${idx}`}
              onClick={() => setEditing(idx)}
              aria-label="Add a clock"
            >
              <span className="world-city-plus" aria-hidden>+</span>
              <span className="world-city-empty-label mono">ADD CLOCK</span>
            </button>
          );
        })}
      </section>

      {editing !== null && (
        <ClockPicker
          existing={clocks[editing]}
          onClose={() => setEditing(null)}
          onPick={(spec) => {
            setAt(editing, spec);
            setEditing(null);
          }}
          onClear={() => {
            setAt(editing, null);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ── City picker overlay ─────────────────────────────────────────────────

interface ClockPickerProps {
  existing: ClockSpec | null;
  onClose: () => void;
  onPick: (spec: ClockSpec) => void;
  onClear: () => void;
}

function ClockPicker({ existing, onClose, onPick, onClear }: ClockPickerProps) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ClockSpec[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<number | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    const ctrl = new AbortController();
    if (debounce.current) window.clearTimeout(debounce.current);
    if (q.trim().length < 2) { setResults([]); return; }
    debounce.current = window.setTimeout(async () => {
      setLoading(true);
      const r = await searchCities(q, ctrl.signal);
      if (!active) return;
      setResults(r);
      setLoading(false);
    }, 220);
    return () => {
      active = false;
      ctrl.abort();
      if (debounce.current) window.clearTimeout(debounce.current);
    };
  }, [q]);

  const hint = useMemo(() => {
    if (loading) return "Searching…";
    if (q.length < 2) return "Try \"Munich\", \"Hong Kong\", \"Berkeley\", \"Boston\"…";
    if (results.length === 0) return `No matches for "${q}"`;
    return null;
  }, [q, loading, results.length]);

  return (
    <div className="clock-picker-backdrop" onClick={onClose}>
      <div className="clock-picker" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose a city">
        <header className="clock-picker-head">
          <div>
            <span className="eyebrow mono">Add city clock</span>
            {existing && <div className="clock-picker-cur">{existing.label} · {existing.tz}</div>}
          </div>
          <button onClick={onClose} className="mono clock-picker-close" aria-label="Close">ESC</button>
        </header>
        <input
          ref={inputRef}
          type="search"
          className="clock-picker-input mono"
          placeholder="Search any city…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {hint && <div className="clock-picker-hint caption">{hint}</div>}
        {results.length > 0 && (
          <ul className="clock-picker-results">
            {results.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onPick(r)} className="clock-picker-row">
                  <span className="clock-picker-name">{r.label}</span>
                  <span className="clock-picker-meta mono">
                    {r.country} · {r.tz}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {existing && (
          <button
            type="button"
            onClick={onClear}
            className="clock-picker-clear mono"
            aria-label="Remove this clock"
          >
            REMOVE CLOCK
          </button>
        )}
      </div>
    </div>
  );
}
