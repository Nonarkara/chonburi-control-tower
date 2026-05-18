// Node-only persistence layer for the in-memory cache.
// Survives launchd restarts: a fresh process boots warm because the last
// successful payload for every adapter is on disk.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { setCache, snapshotCache } from "./cache.js";

const CACHE_FILE = resolve(process.cwd(), "var", "cache.json");

interface PersistedEntry {
  data: unknown;
  expiresAt: number;
}

type Persisted = Record<string, PersistedEntry>;

export async function hydrateCacheFromDisk(): Promise<number> {
  try {
    const raw = await readFile(CACHE_FILE, "utf8");
    const obj = JSON.parse(raw) as Persisted;
    let restored = 0;
    const now = Date.now();
    for (const [key, entry] of Object.entries(obj)) {
      if (!entry || typeof entry.expiresAt !== "number") continue;
      if (entry.expiresAt <= now) continue;
      const ttlSeconds = Math.max(1, Math.round((entry.expiresAt - now) / 1000));
      setCache(key, entry.data, ttlSeconds);
      restored++;
    }
    return restored;
  } catch {
    return 0;
  }
}

let writeTimer: NodeJS.Timeout | null = null;
let lastSerialized = "";

export function enableCachePersistence(intervalMs = 30_000): void {
  writeTimer = setInterval(async () => {
    try {
      const serialized = JSON.stringify(snapshotCache());
      if (serialized === lastSerialized) return;
      lastSerialized = serialized;
      await mkdir(dirname(CACHE_FILE), { recursive: true });
      await writeFile(CACHE_FILE, serialized, "utf8");
    } catch (err) {
      console.error("[persistence] flush failed:", (err as Error).message);
    }
  }, intervalMs);
}

export function stopCachePersistence(): void {
  if (writeTimer) {
    clearInterval(writeTimer);
    writeTimer = null;
  }
}
