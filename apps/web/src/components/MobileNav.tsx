export type MobilePanel = "map" | "brief" | "layers";

interface Props {
  panel: MobilePanel;
  onChange: (p: MobilePanel) => void;
}

const TABS: { id: MobilePanel; label: string; sub: string }[] = [
  { id: "brief",  label: "BRIEF",  sub: "AQI · PMCU" },
  { id: "map",    label: "MAP",    sub: "twin" },
  { id: "layers", label: "LAYERS", sub: "lens · news" },
];

/**
 * MobileNav — fixed bottom segmented control on phones.
 *  BRIEF opens the left rail as a full-height sheet.
 *  MAP   collapses both panels so the map is full-bleed.
 *  LAYERS opens the right rail (news + layer palette).
 */
export function MobileNav({ panel, onChange }: Props) {
  return (
    <nav className="mobile-nav" role="tablist" aria-label="Dashboard panels">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={panel === t.id}
          className={`mobile-nav-btn ${panel === t.id ? "active" : ""}`}
          onClick={() => onChange(t.id)}
        >
          <span className="mobile-nav-label mono">{t.label}</span>
          <span className="mobile-nav-sub">{t.sub}</span>
        </button>
      ))}
    </nav>
  );
}
