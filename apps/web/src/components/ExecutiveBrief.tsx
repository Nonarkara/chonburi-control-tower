import type { ExecutiveSnapshot } from "@chonburi/shared";

interface Props {
  data: ExecutiveSnapshot | null;
  loading: boolean;
}

function rankTrend(prev: number, curr: number): { arrow: string; color: string } {
  if (curr < prev) return { arrow: "↑", color: "var(--good)" }; // lower rank is better
  if (curr > prev) return { arrow: "↓", color: "var(--bad)" };
  return { arrow: "→", color: "var(--text-3)" };
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function statusColor(s: ExecutiveSnapshot["initiatives"][number]["status"]): string {
  switch (s) {
    case "on-track":
      return "var(--good)";
    case "at-risk":
      return "var(--warn)";
    case "delayed":
      return "var(--bad)";
    case "completed":
      return "var(--data)";
  }
}

export function ExecutiveBrief({ data, loading }: Props) {
  if (loading && !data) {
    return (
      <div className="exec-brief">
        <div className="eyebrow mono">Executive Brief</div>
        <div className="skeleton" style={{ height: 10, marginTop: 8 }} />
        <div className="skeleton" style={{ height: 10, width: "80%", marginTop: 6 }} />
        <div className="skeleton" style={{ height: 10, width: "60%", marginTop: 6 }} />
      </div>
    );
  }

  const d = data;
  if (!d) return null;

  return (
    <div className="exec-brief">
      {/* ── Rankings ── */}
      <section className="exec-section">
        <header className="exec-h">
          <span className="eyebrow mono">Rankings</span>
          <span className="mono caption">{d.rankings[0]?.year} cycle</span>
        </header>
        <div className="exec-rank-grid">
          {d.rankings.map((r) => {
            const t = rankTrend(r.previousRank, r.rank);
            return (
              <div key={r.system} className="exec-rank">
                <div className="exec-rank-label">{r.label}</div>
                <div className="exec-rank-num" style={{ color: t.color }}>
                  {t.arrow} {r.rank}
                </div>
                <div className="exec-rank-sub mono">of {r.total}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Enrollment ── */}
      <section className="exec-section">
        <header className="exec-h">
          <span className="eyebrow mono">Enrollment</span>
          <span className="mono caption">{fmt(d.enrollment.total)} total</span>
        </header>
        <div className="exec-kv-grid">
          <div className="exec-kv">
            <div className="num">{fmt(d.enrollment.undergraduate)}</div>
            <div className="lbl">UNDERGRAD</div>
          </div>
          <div className="exec-kv">
            <div className="num">{fmt(d.enrollment.graduate)}</div>
            <div className="lbl">GRADUATE</div>
          </div>
          <div className="exec-kv">
            <div className="num">{fmt(d.enrollment.international)}</div>
            <div className="lbl">INTERNATIONAL</div>
          </div>
          <div className="exec-kv">
            <div className="num">{d.enrollment.internationalPct}%</div>
            <div className="lbl">INTL SHARE</div>
          </div>
        </div>
        <div className="exec-foot mono">
          {d.enrollment.faculties} faculties · ratio {d.enrollment.studentFacultyRatio}
        </div>
      </section>

      {/* ── Research ── */}
      <section className="exec-section">
        <header className="exec-h">
          <span className="eyebrow mono">Research</span>
          <span className="mono caption">2024</span>
        </header>
        <div className="exec-kv-grid">
          <div className="exec-kv">
            <div className="num">{fmt(d.research.publications2024)}</div>
            <div className="lbl">PUBLICATIONS</div>
          </div>
          <div className="exec-kv">
            <div className="num">{fmt(d.research.citations2024)}</div>
            <div className="lbl">CITATIONS</div>
          </div>
          <div className="exec-kv">
            <div className="num">{d.research.hIndex}</div>
            <div className="lbl">H-INDEX</div>
          </div>
          <div className="exec-kv">
            <div className="num">{d.research.patentsFiled}</div>
            <div className="lbl">PATENTS</div>
          </div>
        </div>
        <div className="exec-foot mono">Top: {d.research.topFields.join(" · ")}</div>
      </section>

      {/* ── Finance (placeholder) ── */}
      <section className="exec-section exec-section-dim">
        <header className="exec-h">
          <span className="eyebrow mono">Finance</span>
          <span className="mono caption">INTERNAL DATA</span>
        </header>
        <div className="exec-kv-grid">
          <div className="exec-kv">
            <div className="num dim">—</div>
            <div className="lbl">BUDGET (B THB)</div>
          </div>
          <div className="exec-kv">
            <div className="num dim">—</div>
            <div className="lbl">GRANTS (M THB)</div>
          </div>
          <div className="exec-kv">
            <div className="num dim">—</div>
            <div className="lbl">ENDOWMENT (B THB)</div>
          </div>
        </div>
        <div className="exec-foot mono" style={{ color: "var(--text-3)" }}>
          {d.finance.note}
        </div>
      </section>

      {/* ── Strategic initiatives ── */}
      <section className="exec-section">
        <header className="exec-h">
          <span className="eyebrow mono">Initiatives</span>
          <span className="mono caption">{d.initiatives.length} active</span>
        </header>
        <ul className="exec-init-list">
          {d.initiatives.map((i) => (
            <li key={i.id} className="exec-init">
              <div className="exec-init-top">
                <span className="exec-init-name">{i.name}</span>
                <span className="exec-init-status mono" style={{ color: statusColor(i.status) }}>
                  {i.status.toUpperCase()}
                </span>
              </div>
              <div className="exec-init-bar">
                <span
                  className="exec-init-fill"
                  style={{
                    width: `${i.progressPct}%`,
                    background: statusColor(i.status),
                  }}
                />
              </div>
              <div className="exec-init-foot mono">
                {i.progressPct}% · {i.owner} · {i.deadline}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
