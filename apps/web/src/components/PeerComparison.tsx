import type { PeerSnapshot } from "@chonburi/shared";

interface Props {
  peers: PeerSnapshot[];
}

function flagEmoji(country: string): string {
  switch (country) {
    case "TH":
      return "🇹🇭";
    case "SG":
      return "🇸🇬";
    case "HK":
      return "🇭🇰";
    default:
      return "🏳";
  }
}

export function PeerComparison({ peers }: Props) {
  if (peers.length === 0) return null;

  return (
    <div className="peer-comp">
      <header className="peer-head">
        <span className="eyebrow mono">Peer Context</span>
        <span className="mono caption">{peers.length} universities</span>
      </header>
      <div className="peer-table">
        <div className="peer-row peer-header-row mono">
          <span className="peer-cell">Uni</span>
          <span className="peer-cell">QS</span>
          <span className="peer-cell">THE</span>
          <span className="peer-cell">Students</span>
          <span className="peer-cell">Intl%</span>
        </div>
        {peers.map((p) => (
          <div key={p.name} className="peer-row">
            <span className="peer-cell peer-name">
              <span className="peer-flag">{flagEmoji(p.country)}</span>
              {p.name}
            </span>
            <span className="peer-cell mono">{p.qsWorldRank}</span>
            <span className="peer-cell mono">{p.theWorldRank}</span>
            <span className="peer-cell mono">{p.studentsTotal.toLocaleString("en-US")}</span>
            <span className="peer-cell mono">{p.internationalPct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
