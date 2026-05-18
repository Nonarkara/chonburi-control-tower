/**
 * FacebookPanel — embeds the official Mueang Chonburi Facebook page via
 * Meta's no-auth page plugin (https://developers.facebook.com/docs/plugins/page-plugin).
 *
 * The plugin iframe pulls live posts directly from facebook.com with no
 * credentials needed. It respects the visitor's FB login state and
 * shows the latest 4-6 posts in a timeline.
 *
 * If the FACEBOOK_PAGE_TOKEN env is set on the API, server-side Graph API
 * data is shown above the iframe (richer formatting, action-tagged).
 */

interface FbPost {
  id: string;
  message: string;
  permalink: string;
  createdAt: string;
  reactions?: number;
  comments?: number;
  shares?: number;
}

interface Props {
  posts: FbPost[];
  loading: boolean;
}

const PAGE_URL = "https://www.facebook.com/mueangchonburi";
const PAGE_USERNAME = "mueangchonburi";

function ago(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const ms = Date.now() - t;
  const m = Math.round(ms / 60000);
  if (m < 1) return "NOW";
  if (m < 60) return `${m}M`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}H`;
  return `${Math.round(h / 24)}D`;
}

export function FacebookPanel({ posts, loading }: Props) {
  const embedSrc = `https://www.facebook.com/plugins/page.php?` +
    `href=${encodeURIComponent(PAGE_URL)}` +
    `&tabs=timeline&width=340&height=420` +
    `&small_header=true&adapt_container_width=true&hide_cover=true&show_facepile=false`;

  return (
    <div className="col" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="spread" style={{ alignItems: "center" }}>
        <span className="eyebrow">FACEBOOK // เทศบาลเมืองชลบุรี</span>
        <a
          href={PAGE_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="mono caption"
          style={{ color: "var(--brand)", letterSpacing: "0.05em" }}
        >
          @{PAGE_USERNAME} ↗
        </a>
      </div>

      {/* Server-side posts via Graph API (only when token configured) */}
      {posts.length > 0 && (
        <div>
          {posts.slice(0, 4).map((p) => (
            <a key={p.id} href={p.permalink} target="_blank" rel="noreferrer noopener" className="news-item">
              <div className="news-header" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="mono" style={{ color: "var(--brand)", fontSize: "0.62rem", letterSpacing: "0.06em" }}>
                  ▶ POST
                </span>
                <span className="mono" style={{ marginLeft: "auto", fontSize: "0.66rem", color: "var(--text-3)" }}>
                  {ago(p.createdAt)}
                </span>
              </div>
              <div className="title" style={{ whiteSpace: "pre-wrap" }}>{p.message.slice(0, 240)}{p.message.length > 240 ? "…" : ""}</div>
              <div className="meta mono" style={{ fontSize: "0.66rem" }}>
                {p.reactions != null && <span>❤ {p.reactions}</span>}
                {p.comments != null && <span style={{ marginLeft: 8 }}>💬 {p.comments}</span>}
                {p.shares != null && <span style={{ marginLeft: 8 }}>↻ {p.shares}</span>}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Meta's free page-plugin iframe — always works, no token needed */}
      <iframe
        src={embedSrc}
        width="100%"
        height="420"
        style={{
          border: "1px solid var(--line)",
          background: "var(--bg-2)",
          maxWidth: 340,
          display: "block",
        }}
        scrolling="no"
        title="Mueang Chonburi Facebook page timeline"
        allow="encrypted-media"
        loading="lazy"
      />

      {posts.length === 0 && !loading && (
        <div className="caption mono" style={{ color: "var(--text-3)", fontSize: "0.66rem" }}>
          Live timeline above via Meta page plugin. For server-side tagged posts,
          set <code>FACEBOOK_PAGE_TOKEN</code> in the API env.
        </div>
      )}
    </div>
  );
}
