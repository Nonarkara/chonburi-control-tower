// Node runtime entry — runs the same Hono app on plain Node so we can reach
// Thai government endpoints that workerd local TLS rejects. Production: this
// Mac runs 24/7 behind a Cloudflare Tunnel at chonburi-api.nonarkara.org.
//
// Reliability layers:
//   1. Persistent disk cache (var/cache.json) — restarts boot warm.
//   2. Prewarm loop every 5 min — adapters stay fresh regardless of activity.
//   3. Caffeinate wrapper in the launchd plist keeps the Mac awake.

import { serve } from "@hono/node-server";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import app from "./index.js";
import { hydrateCacheFromDisk, enableCachePersistence, stopCachePersistence } from "./lib/persistence.js";
import { hydrateNewsArchive } from "./lib/newsArchive.js";
import { startAisStream } from "./adapters/ais.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parsePort(raw: string | undefined): number {
  if (!raw) return 8787;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 1 || n > 65535) {
    console.error(`[chonburi-api] Invalid PORT "${raw}", falling back to 8787`);
    return 8787;
  }
  return n;
}

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

const env = {
  ENVIRONMENT: process.env.ENVIRONMENT ?? "node-local",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
  FMP_API_KEY: process.env.FMP_API_KEY,
  FRED_API_KEY: process.env.FRED_API_KEY,
  VIABUS_TOKEN: process.env.VIABUS_TOKEN,
  VIABUS_BASE_URL: process.env.VIABUS_BASE_URL,
  AQICN_TOKEN: process.env.AQICN_TOKEN,
  AISSTREAM_TOKEN: process.env.AISSTREAM_TOKEN,
  DATA_GO_TH_TOKEN: process.env.DATA_GO_TH_TOKEN,
};

// Start AIS WebSocket subscriber if token is provided. No-op without key.
if (process.env.AISSTREAM_TOKEN) {
  startAisStream(process.env.AISSTREAM_TOKEN);
} else {
  console.log("[chonburi-api] AISSTREAM_TOKEN not set — AIS vessels will be empty");
}

await hydrateNewsArchive()
  .then((n) => console.log(`[chonburi-api] news archive: ${n} records loaded from disk`))
  .catch((err) => console.error("[chonburi-api] news archive hydrate failed:", err));

await hydrateCacheFromDisk()
  .then((n) => console.log(`[chonburi-api] rehydrated ${n} cache entries from disk`))
  .catch((err) => console.error("[chonburi-api] hydrate failed:", err));

const server = serve(
  {
    fetch: (req) => app.fetch(req, env),
    port: PORT,
    hostname: HOST,
  },
  (info) => {
    console.log(`[chonburi-api] node listening on http://${info.address}:${info.port}`);
  },
);

enableCachePersistence(30_000);

const PREWARM_PATHS = [
  "/api/health",
  "/api/news",
  "/api/incidents/city-reports",
  "/api/incidents/itic",
  "/api/weather",
  "/api/precip-nowcast",
  "/api/air-quality",
  "/api/air-quality/trend",
  "/api/cctv/longdo",
  "/api/trends",
  "/api/markets",
  "/api/executive",
  "/api/maritime/ais",
  "/api/marine",
  "/api/tides",
  "/api/datago/points",
  "/api/datago/datasets",
];

async function prewarmOnce() {
  const t0 = Date.now();
  const addr = HOST === "0.0.0.0" ? "127.0.0.1" : HOST;
  await Promise.all(
    PREWARM_PATHS.map((p) =>
      fetch(`http://${addr}:${PORT}${p}`).catch(() => undefined),
    ),
  );
  console.log(`[chonburi-api] prewarm cycle done in ${Date.now() - t0}ms`);
}

setTimeout(() => { void prewarmOnce(); }, 3_000);
setInterval(() => { void prewarmOnce(); }, 5 * 60 * 1000);

function shutdown(signal: string) {
  console.log(`[chonburi-api] ${signal} received, shutting down…`);
  stopCachePersistence();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  console.error("[chonburi-api] uncaughtException", err);
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error("[chonburi-api] unhandledRejection", err);
  process.exit(1);
});
