// Node runtime entry — runs the same Hono app on plain Node so we can reach
// Thai government endpoints that workerd local TLS rejects (BMA ArcGIS,
// data.bangkok.go.th, etc). Production: this Mac runs 24/7 behind a
// Cloudflare Tunnel at chula-api.nonarkara.org.
//
// Reliability layers on top of plain Hono:
//   1. Persistent disk cache (var/cache.json) — restarts boot warm.
//   2. Prewarm loop every 5 min — every adapter stays fresh regardless of
//      browser activity, so first-paint after a quiet period is instant.
//   3. Caffeinate wrapper in the launchd plist keeps the Mac awake.

import { serve } from "@hono/node-server";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import app from "./index.js";
import { hydrateCacheFromDisk, enableCachePersistence, stopCachePersistence } from "./lib/persistence.js";
import { hydrateNewsArchive } from "./lib/newsArchive.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parsePort(raw: string | undefined): number {
  if (!raw) return 8787;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 1 || n > 65535) {
    console.error(`[chula-api] Invalid PORT "${raw}", falling back to 8787`);
    return 8787;
  }
  return n;
}

// Load apps/api/.env (gitignored) into process.env if present.
// Hand-rolled to avoid adding dotenv as a runtime dep.
(function loadDotenv() {
  try {
    const raw = readFileSync(resolve(__dirname, "../.env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const k = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      // Unescape surrounding quotes and inline escapes
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      v = v.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\'/g, "'");
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    // No .env file — fine.
  }
})();

const PORT = parsePort(process.env.PORT);
const HOST = process.env.HOST ?? "127.0.0.1";

// Hono's @cloudflare bindings type. On Node we expose env vars as `c.env`.
const env = {
  ENVIRONMENT: process.env.ENVIRONMENT ?? "node-local",
  CU_SHUTTLE_TOKEN: process.env.CU_SHUTTLE_TOKEN,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
  FMP_API_KEY: process.env.FMP_API_KEY,
  FRED_API_KEY: process.env.FRED_API_KEY,
  VIABUS_TOKEN: process.env.VIABUS_TOKEN,
  VIABUS_BASE_URL: process.env.VIABUS_BASE_URL,
  AQICN_TOKEN: process.env.AQICN_TOKEN,
};

// Rehydrate cache from disk BEFORE we start serving — first request to any
// endpoint gets the warm value instead of triggering an upstream fetch.
await hydrateNewsArchive()
  .then((n) => console.log(`[chula-api] news archive: ${n} records loaded from disk`))
  .catch((err) => console.error("[chula-api] news archive hydrate failed:", err));

await hydrateCacheFromDisk()
  .then((n) => console.log(`[chula-api] rehydrated ${n} cache entries from disk`))
  .catch((err) => console.error("[chula-api] hydrate failed:", err));

const server = serve(
  {
    fetch: (req) => app.fetch(req, env),
    port: PORT,
    hostname: HOST,
  },
  (info) => {
    console.log(`[chula-api] node listening on http://${info.address}:${info.port}`);
  },
);

// Periodic flush of the in-memory cache to disk.
enableCachePersistence(30_000);

// ── Prewarm loop ────────────────────────────────────────────────────────
// Hit every adapter every 5 min so the cache stays warm even if no browser
// is open. This is the "true cron" the dashboard expects.
const PREWARM_PATHS = [
  "/api/health",
  "/api/news",
  "/api/incidents/city-reports",
  "/api/incidents/itic",
  "/api/weather",
  "/api/precip-nowcast",
  "/api/academic-calendar",
  "/api/air-quality",
  "/api/air-quality/trend",
  "/api/cctv/longdo",
  "/api/transit/cu-shuttle",
  "/api/bma/pois",
  "/api/bma/datasets",
  "/api/trends",
  "/api/markets",
  "/api/executive",
];

async function prewarmOnce() {
  const t0 = Date.now();
  const addr = HOST === "0.0.0.0" ? "127.0.0.1" : HOST;
  await Promise.all(
    PREWARM_PATHS.map((p) =>
      fetch(`http://${addr}:${PORT}${p}`).catch(() => undefined),
    ),
  );
  console.log(`[chula-api] prewarm cycle done in ${Date.now() - t0}ms`);
}

// Fire once shortly after boot (give the server a moment to bind), then every 5 min.
setTimeout(() => {
  void prewarmOnce();
}, 3_000);
setInterval(() => {
  void prewarmOnce();
}, 5 * 60 * 1000);

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`[chula-api] ${signal} received, shutting down…`);
  stopCachePersistence();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Fatal errors: log and exit so launchd/systemd can restart a clean process.
process.on("uncaughtException", (err) => {
  console.error("[chula-api] uncaughtException", err);
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error("[chula-api] unhandledRejection", err);
  process.exit(1);
});
