import type { IncidentFeature } from "@chonburi/shared";
import { fmtAge } from "@chonburi/shared";
import { safeUrl } from "../lib/safeUrl";

interface Props {
  incident: IncidentFeature | null;
  onClose: () => void;
}

const PLATFORM_LABEL: Record<IncidentFeature["reporterPlatform"], string> = {
  traffy: "Traffy Fondue",
  "city-reporter": "City Reporter",
  itic: "iTIC",
  internal: "Municipal",
};

function minutesSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

/**
 * Right-anchored card for a picked incident. Its whole reason to exist is the
 * "Open report ↗" deep-link: an operator clicks an incident on the map and
 * jumps straight to where the citizen reported it, to go fix it. Closes on the
 * ESC button or backdrop (wired in App.tsx).
 */
export function IncidentCard({ incident, onClose }: Props) {
  if (!incident) return null;
  const href = safeUrl(incident.sourceUrl);
  const platform = PLATFORM_LABEL[incident.reporterPlatform] ?? "Report";

  return (
    <aside className="building-card incident-card" role="dialog" aria-label={`Incident: ${incident.title}`}>
      <header className="building-card-head">
        <div>
          <span className="eyebrow mono">CHONBURI · INCIDENT</span>
          <h3 className="building-card-title">{incident.title}</h3>
          {incident.ticketNumber && <div className="building-card-alt">#{incident.ticketNumber}</div>}
        </div>
        <button onClick={onClose} aria-label="Close" className="building-card-close mono">
          ESC
        </button>
      </header>
      <dl className="building-card-meta mono">
        <dt>CATEGORY</dt>
        <dd>{incident.category}</dd>
        <dt>SEVERITY</dt>
        <dd>{incident.severity}</dd>
        <dt>STATUS</dt>
        <dd>{incident.status}</dd>
        <dt>REPORTED</dt>
        <dd>{fmtAge(minutesSince(incident.reportedAt))}</dd>
        <dt>SOURCE</dt>
        <dd>{platform}</dd>
      </dl>

      {incident.description && (
        <div className="building-card-section">
          <span className="eyebrow mono">DESCRIPTION</span>
          <p className="incident-card-desc">{incident.description}</p>
        </div>
      )}

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="building-card-link mono"
        >
          Open report ↗
        </a>
      ) : (
        <div className="building-card-loading mono">No public report link</div>
      )}
    </aside>
  );
}
