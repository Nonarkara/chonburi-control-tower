// Default production API host.
//
// We point at the Cloudflare Workers default hostname rather than the
// `chonburi-api.nonarkara.org` alias because the alias has no DNS record —
// every API request from a built bundle was failing with
// `ERR_NAME_NOT_RESOLVED`, leaving News / Markets / etc. stuck on "Loading…".
// Once the custom domain is wired up in Cloudflare, set `VITE_API_BASE_URL`
// at build time on Cloudflare Pages and the override below kicks in.
const CHONBURI_API_BASE = "https://chonburi-control-tower-api.drnon.workers.dev";
const LEGACY_API_HOSTS = new Set([
  "https://chula-api.nonarkara.org",
  "http://chula-api.nonarkara.org",
  // Custom alias that resolved nowhere in production — treat as legacy so any
  // stale build-time env var still routes through the working worker host.
  "https://chonburi-api.nonarkara.org",
]);

function normalizeBase(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/\/+$/, "");
}

export function resolveApiBase(raw: string | undefined = import.meta.env.VITE_API_BASE_URL): string {
  const base = normalizeBase(raw);
  const isLegacy = LEGACY_API_HOSTS.has(base);

  if (import.meta.env.DEV && (!base || isLegacy)) {
    return "";
  }

  if (!base || isLegacy) {
    return CHONBURI_API_BASE;
  }

  return base;
}

export const API_BASE = resolveApiBase();
