import { useEffect, useState } from "react";
import type { AcademicSnapshot, FallbackTier } from "@chonburi/shared";
import { useTheme } from "../hooks/useTheme";

interface FeedHealth {
  label: string;
  tier: FallbackTier | "loading";
  ageMinutes: number;
}

interface Props {
  feeds: FeedHealth[];
  onOpenCatalog: () => void;
  catalogCount: number;
  viewMode: "2D" | "3D" | "3DS";
  onCycleViewMode: () => void;
  onOpenManual: () => void;
  onOpenWhitepaper: () => void;
  onOpenSheets: () => void;
  sheetsConfigured: boolean;
  academic: AcademicSnapshot | null;
  systemStatus?: "healthy" | "degraded" | "down" | "unknown";
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
}

const TEMPO_COLOR: Record<AcademicSnapshot["tempo"], string> = {
  low: "var(--text-3)",
  normal: "var(--data)",
  high: "var(--warn)",
  peak: "var(--bad)",
};

export function TopBar({ feeds, onOpenCatalog, catalogCount, viewMode, onCycleViewMode, onOpenManual, onOpenWhitepaper, onOpenSheets, sheetsConfigured, academic, systemStatus }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { theme, toggle } = useTheme();
  const liveCount = feeds.filter((f) => f.tier === "live").length;

  return (
    <header className="topbar">
      {/* Sponsor + identity bar */}
      <div className="brand">
        {/* Municipal seal — principal identity mark */}
        <a className="sponsor sponsor-seal" href="https://www.chonburi.go.th" target="_blank"
           rel="noreferrer" aria-label="เทศบาลเมืองชลบุรี — Chonburi Town Municipality">
          <img src="/logos/chonburi-seal.jpeg" alt="Chonburi seal" />
        </a>
        {/* Partners */}
        <a className="sponsor" href="https://www.depa.or.th" target="_blank"
           rel="noreferrer" aria-label="depa — Digital Economy Promotion Agency">
          <img src="/logos/depa.jpg" alt="depa" />
        </a>
        <a className="sponsor" href="https://www.smartcitythailand.or.th" target="_blank"
           rel="noreferrer" aria-label="Smart City Thailand">
          <img src="/logos/smart-city-thailand.jpg" alt="Smart City Thailand" />
        </a>
        <a className="sponsor sponsor-axiom" href="https://axiom.nonarkara.org" target="_blank"
           rel="noreferrer" aria-label="Axiom — Innovation as a Service">
          <img src="/logos/axiom.png" alt="Axiom" />
        </a>
        <svg className="brand-wave" width="42" height="22" viewBox="0 0 42 22" aria-hidden>
          <path d="M0 11 Q 5 4, 10 11 T 20 11 T 30 11 T 42 11"
                fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.95"/>
          <path d="M0 17 Q 5 10, 10 17 T 20 17 T 30 17 T 42 17"
                fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5"/>
        </svg>
        <div className="brand-stack">
          <strong>Chonburi Town Center</strong>
          <span className="brand-sub mono">
            CTM-01 · Eastern Seaboard
          </span>
        </div>
      </div>

      {/* Live feed chips */}
      <div className="feeds">
        <span className="feeds-label">FEEDS</span>
        {feeds.map((f) => (
          <span
            key={f.label}
            className={`feed-chip feed-${f.tier}`}
            title={`${f.tier} · ${f.ageMinutes}m ago`}
          >
            <span className={`dot ${f.tier === "loading" ? "loading" : f.tier}`} />
            {f.label}
          </span>
        ))}
      </div>

      <div className="topbar-right">
        <span
          className="live-count mono"
          role="status"
          aria-label={`${liveCount} of ${feeds.length} data feeds live`}
        >
          <span className="dot live" style={{ marginRight: 5 }} />
          {liveCount}/{feeds.length} LIVE
        </span>
        {systemStatus && systemStatus !== "healthy" && (
          <span
            className={`system-status-badge status-${systemStatus}`}
            title={`System ${systemStatus.toUpperCase()} — check /api/health/detailed`}
          >
            <span className={`dot ${systemStatus}`} />
            {systemStatus.toUpperCase()}
          </span>
        )}
        <button
          onClick={onOpenSheets}
          className={`mono sheets-btn ${sheetsConfigured ? "sheets-btn-live" : ""}`}
          aria-label={sheetsConfigured ? "Open Google Sheets live feed" : "Set up Google Sheets integration"}
          title={sheetsConfigured ? "Open the live-data Google Sheet" : "Connect a Google Sheet to this dashboard"}
        >
          {sheetsConfigured ? "▦ SHEETS" : "▦ SHEETS"}
        </button>
        <button onClick={onOpenCatalog} className="mono" aria-label="Open source catalog">
          SOURCES · {catalogCount}
        </button>
        <button
          onClick={onOpenWhitepaper}
          className="mono"
          aria-label="Open whitepaper — platform overview and usage manual (TH/EN)"
          title="Whitepaper — platform overview · Thai + English"
        >
          WP
        </button>
        <button
          onClick={onOpenManual}
          className="mono manual-trigger"
          aria-label="Open user manual"
          title="Manual — every button, color, acronym"
        >
          ?
        </button>
        <button
          onClick={onCycleViewMode}
          className={`mono dim-toggle vm-${viewMode}`}
          aria-label={`View mode: ${viewMode}. Click to cycle 2D → 3D → 3D substructure`}
          title={
            viewMode === "2D"
              ? "Tap → 3D · extrude buildings"
              : viewMode === "3D"
                ? "Tap → 3DS · transparent superstructure, show underground"
                : "Tap → 2D · top-down"
          }
        >
          {viewMode}
        </button>
        <button
          onClick={toggle}
          className="theme-toggle"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          title={`${theme === "dark" ? "Light" : "Dark"} theme`}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      </div>

      <div className="clock">
        {academic?.current && (
          <span
            className="mono academic-chip"
            style={{ color: TEMPO_COLOR[academic.tempo] }}
            title={`${academic.current.label} · ${academic.current.describe}${
              academic.next && academic.daysToNext != null
                ? ` · next: ${academic.next.label} in ${academic.daysToNext}d`
                : ""
            }`}
          >
            {academic.current.label.toUpperCase()}
          </span>
        )}
        <span className="clock-date">{formatDate(now)}</span>
        <span className="clock-time">
          {now.toLocaleTimeString("en-GB", { hour12: false })}
        </span>
      </div>
    </header>
  );
}
