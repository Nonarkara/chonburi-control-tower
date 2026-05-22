const CHONBURI_API_BASE = "https://chonburi-api.nonarkara.org";
const LEGACY_API_HOSTS = new Set([
  "https://chula-api.nonarkara.org",
  "http://chula-api.nonarkara.org",
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
