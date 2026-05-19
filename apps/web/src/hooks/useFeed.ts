import { useCallback, useEffect, useRef, useState } from "react";
import type { FallbackTier, NormalizedFeed } from "@chonburi/shared";

interface FeedState<T> {
  data: T[];
  ageMinutes: number;
  fallbackTier: FallbackTier | "loading";
  loadedAt: string | null;
  error: string | null;
}

const STORAGE_PREFIX = "chonburi:feed:";
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;
const UNAVAILABLE_AFTER_FAILS = 3;

function storageKey(path: string): string {
  return `${STORAGE_PREFIX}${path}`;
}

function readLocal<T>(path: string): FeedState<T> | null {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(storageKey(path)) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state: FeedState<T>; savedAt: number };
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > MAX_CACHE_AGE_MS) return null;
    return { ...parsed.state, fallbackTier: "cache" };
  } catch {
    return null;
  }
}

function writeLocal<T>(path: string, state: FeedState<T>): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey(path), JSON.stringify({ state, savedAt: Date.now() }));
  } catch {}
}

const emptyInitial = <T,>(): FeedState<T> => ({
  data: [],
  ageMinutes: 0,
  fallbackTier: "loading",
  loadedAt: null,
  error: null,
});

async function fetchWithRetry(url: string, signal: AbortSignal, retries = 2): Promise<Response> {
  let lastErr: Error | undefined;
  for (let i = 0; i <= retries; i++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const res = await fetch(url, { signal, cache: "no-store" });
      if (res.ok) return res;
      if (res.status < 500 && res.status !== 429) throw new Error(`${res.status} ${res.statusText}`);
      lastErr = new Error(`${res.status} ${res.statusText}`);
    } catch (err) {
      lastErr = err as Error;
      if (err instanceof DOMException && err.name === "AbortError") throw err;
    }
    if (i < retries && !signal.aborted) {
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr ?? new Error("Fetch failed after retries");
}

export function useFeed<T>(path: string, pollMs: number): FeedState<T> & { refetch: () => void } {
  const [state, setState] = useState<FeedState<T>>(() => readLocal<T>(path) ?? emptyInitial<T>());
  const inflight = useRef<AbortController | null>(null);
  const runRef = useRef<() => Promise<void>>(async () => {});
  const failCount = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      inflight.current?.abort();
      const ctrl = new AbortController();
      inflight.current = ctrl;
      try {
        const sep = path.includes("?") ? "&" : "?";
        const url = `${path}${sep}_=${Date.now()}`;
        const res = await fetchWithRetry(url, ctrl.signal);
        const json = (await res.json()) as NormalizedFeed<T>;
        if (cancelled) return;
        failCount.current = 0;
        setState((prev) => {
          // Short-circuit when upstream hasn't moved — same fetchedAt means same payload.
          // Avoids cascading re-renders of bangkokPulse, chips, tickers on every poll.
          if (
            prev.loadedAt === json.meta.fetchedAt &&
            prev.fallbackTier === json.meta.fallbackTier &&
            prev.error === null
          ) {
            return prev;
          }
          const next: FeedState<T> = {
            data: json.features,
            ageMinutes: json.meta.ageMinutes,
            fallbackTier: json.meta.fallbackTier,
            loadedAt: json.meta.fetchedAt,
            error: null,
          };
          writeLocal(path, next);
          return next;
        });
      } catch (err) {
        if (cancelled || (err as Error).name === "AbortError") return;
        failCount.current += 1;
        const errMsg = (err as Error).message;
        const fails = failCount.current;
        setState((prev) => {
          const tier: FallbackTier | "loading" =
            fails >= UNAVAILABLE_AFTER_FAILS
              ? "unavailable"
              : prev.loadedAt
                ? prev.fallbackTier
                : "loading";
          if (prev.error === errMsg && prev.fallbackTier === tier) return prev;
          return { ...prev, error: errMsg, fallbackTier: tier };
        });
      }
    };
    runRef.current = run;

    run();
    const id = setInterval(run, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
      inflight.current?.abort();
    };
  }, [path, pollMs]);

  const refetch = useCallback(() => runRef.current(), []);
  return { ...state, refetch };
}
