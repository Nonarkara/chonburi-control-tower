const DEFAULT_TIMEOUT_MS = 25_000;
const USER_AGENT = "ChulaControlTower/0.1 (+https://chula.nonarkara.org)";

function mergeHeaders(base: Record<string, string>, init?: RequestInit): Headers {
  const h = new Headers(init?.headers);
  for (const [k, v] of Object.entries(base)) {
    if (!h.has(k)) h.set(k, v);
  }
  return h;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function getDefaultHeaders(): Record<string, string> {
  const h: Record<string, string> = { accept: "application/json" };
  // Cloudflare Workers forbids setting User-Agent at runtime.
  if (typeof navigator === "undefined") h["user-agent"] = USER_AGENT;
  return h;
}

export async function fetchJsonOrNull<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(url, {
      ...init,
      headers: mergeHeaders(getDefaultHeaders(), init),
    });
    if (!res.ok) {
      console.warn(`fetchJsonOrNull non-OK ${res.status} ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`fetchJsonOrNull error ${url}`, (err as Error).message);
    return null;
  }
}

export async function fetchTextOrNull(url: string, init?: RequestInit): Promise<string | null> {
  try {
    const h: Record<string, string> = {};
    if (typeof navigator === "undefined") h["user-agent"] = USER_AGENT;
    const res = await fetchWithTimeout(url, {
      ...init,
      headers: mergeHeaders(h, init),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function fetchJsonOrThrow<T>(url: string, init?: RequestInit): Promise<T | null> {
  let attempt = 0;
  while (attempt < 3) {
    try {
      const res = await fetchWithTimeout(url, {
        ...init,
        headers: mergeHeaders(getDefaultHeaders(), init),
      });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 429) {
        attempt++;
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      console.warn(`fetchJsonOrThrow non-OK ${res.status} ${url}`);
      return null;
    } catch (err) {
      console.warn(`fetchJsonOrThrow error ${url}`, (err as Error).message);
      return null;
    }
  }
  console.warn(`fetchJsonOrThrow rate-limited, gave up ${url}`);
  return null;
}
