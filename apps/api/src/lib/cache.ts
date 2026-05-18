// Per-isolate in-memory cache with TTL + promise dedup.
// In Cloudflare Workers, this lives for the lifetime of the isolate (minutes
// to hours per region). On cold start it's empty — adapters refetch.

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const MAX_ENTRIES = 200;
const store = new Map<string, CacheEntry<unknown>>();
const pending = new Map<string, Promise<unknown>>();

function evictIfNeeded() {
  if (store.size < MAX_ENTRIES) return;
  const toDelete = store.size - MAX_ENTRIES + 1;
  let i = 0;
  for (const key of store.keys()) {
    if (i >= toDelete) break;
    store.delete(key);
    i++;
  }
}

export function setCache<T>(key: string, data: T, ttlSeconds: number): void {
  evictIfNeeded();
  store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const entry = store.get(key);
  if (entry && Date.now() <= entry.expiresAt) {
    return entry.data as T;
  }
  if (entry) store.delete(key);

  const inflight = pending.get(key);
  if (inflight) return inflight as Promise<T>;

  const promise = compute()
    .then((result) => {
      setCache(key, result, ttlSeconds);
      pending.delete(key);
      return result;
    })
    .catch((err) => {
      pending.delete(key);
      throw err;
    });

  pending.set(key, promise);

  // Safety: if compute hangs forever, don't leak beyond 60 s
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      pending.delete(key);
      reject(new Error(`Cache compute timeout for ${key}`));
    }, 60_000);
  });

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return Promise.race([promise.then((v) => { clearTimer(); return v; }).catch((e) => { clearTimer(); throw e; }), timeout]);
}

export function cacheAgeMinutes(fetchedAt: string): number {
  const t = new Date(fetchedAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

/**
 * Snapshot of the live in-memory cache, used by the Node persistence layer
 * to flush to disk. Returns a JSON-serialisable plain object.
 */
export function snapshotCache(): Record<string, { data: unknown; expiresAt: number }> {
  const out: Record<string, { data: unknown; expiresAt: number }> = {};
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (v.expiresAt > now) out[k] = { data: v.data, expiresAt: v.expiresAt };
  }
  return out;
}
