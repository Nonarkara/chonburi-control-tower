import type { StrategicAlert } from "@chula/shared";

interface Props {
  alerts: StrategicAlert[];
}

function levelColor(level: StrategicAlert["level"]): string {
  switch (level) {
    case "critical":
      return "var(--crit)";
    case "warning":
      return "var(--bad)";
    case "watch":
      return "var(--warn)";
    case "info":
      return "var(--data)";
  }
}

function levelLabel(level: StrategicAlert["level"]): string {
  return level.toUpperCase();
}

function ago(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "NOW";
  if (m < 60) return `${m}M`;
  return `${Math.round(m / 60)}H`;
}

export function StrategicAlerts({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="strat-alerts">
        <header className="strat-alerts-head">
          <span className="eyebrow mono">Strategic Alerts</span>
          <span className="mono caption" style={{ color: "var(--good)" }}>
            ALL CLEAR
          </span>
        </header>
        <div className="strat-alerts-empty">No active alerts requiring presidential attention.</div>
      </div>
    );
  }

  // Sort: critical first, then by time
  const sorted = [...alerts].sort((a, b) => {
    const severity = { critical: 4, warning: 3, watch: 2, info: 1 };
    if (severity[a.level] !== severity[b.level]) return severity[b.level] - severity[a.level];
    return new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime();
  });

  return (
    <div className="strat-alerts">
      <header className="strat-alerts-head">
        <span className="eyebrow mono">Strategic Alerts</span>
        <span className="mono caption" style={{ color: "var(--bad)" }}>
          {sorted.length} ACTIVE
        </span>
      </header>
      <ul className="strat-alerts-list">
        {sorted.map((a) => (
          <li key={a.id} className="strat-alert">
            <div className="strat-alert-top">
              <span className="strat-alert-level mono" style={{ color: levelColor(a.level) }}>
                {levelLabel(a.level)}
              </span>
              <span className="strat-alert-cat mono caption">{a.category.toUpperCase()}</span>
              <span className="strat-alert-ago mono caption">{ago(a.issuedAt)}</span>
            </div>
            <div className="strat-alert-title">{a.title}</div>
            <div className="strat-alert-msg">{a.message}</div>
            {a.actionRequired && (
              <div className="strat-alert-action">
                <span className="strat-action-label">ACTION:</span> {a.actionRequired}
              </div>
            )}
            <div className="strat-alert-source mono caption">{a.source}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
