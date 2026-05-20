import { Hono } from "hono";
import { cors } from "hono/cors";
import { fetchCityReports } from "./adapters/cityReporter.js";
import { fetchItic } from "./adapters/itic.js";
import { fetchNews } from "./adapters/news.js";
async function tryArchiveApi() {
  if (typeof process === "undefined" || !process.versions?.node) return null;
  try {
    return await import("./lib/newsArchive.js");
  } catch {
    return null;
  }
}
import { fetchWeather } from "./adapters/weather.js";
import { fetchPrecipNowcast } from "./adapters/precipNowcast.js";
import { fetchAirQuality, fetchAirQualityTrend } from "./adapters/airQuality.js";
import { fetchCctv } from "./adapters/cctv.js";
import { fetchTrends } from "./adapters/trends.js";
import { fetchExecutiveSnapshot, deriveAlerts } from "./adapters/executive.js";
import { fetchMarkets } from "./adapters/markets.js";
import { chat, ChatError, type ChatMessage } from "./adapters/chat.js";
import { fetchAisVessels } from "./adapters/ais.js";
import { fetchDatagoPoints, fetchDatagoDatasets, fetchReservoirs, fetchDisasterStats, fetchFahfon, fetchProvincialKPIs } from "./adapters/datago.js";
import { fetchFacebookPosts } from "./adapters/facebook.js";
import { fetchMarine } from "./adapters/marine.js";
import { fetchTides } from "./adapters/tides.js";
import { SOURCE_CATALOG } from "@chonburi/shared";
import type { NormalizedFeed, AirQualityPoint, IncidentFeature, IntelligenceItem, ExecutiveSnapshot, MarketSnapshot } from "@chonburi/shared";
import { recordAdapterSuccess, recordAdapterError, getAllHealth, getSystemStatus } from "./lib/health.js";
import { getMqttStatus } from "./adapters/mqttBridge.js";
import twinApp from "./routes/twin.js";

type Bindings = {
  ENVIRONMENT?: string;
  GEMINI_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  FMP_API_KEY?: string;
  FRED_API_KEY?: string;
  VIABUS_TOKEN?: string;
  VIABUS_BASE_URL?: string;
  AQICN_TOKEN?: string;
  AISSTREAM_TOKEN?: string;
  FACEBOOK_PAGE_ID?: string;
  FACEBOOK_PAGE_TOKEN?: string;
  DATA_GO_TH_TOKEN?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const ALLOWED_ORIGINS = new Set([
  "https://chonburi.nonarkara.org",
  "https://chonburi-control-tower.pages.dev",
  "http://localhost:5173",
  "http://localhost:8787",
]);

app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      if (!origin) return "*";
      if (ALLOWED_ORIGINS.has(origin)) return origin;
      if (origin.startsWith("http://localhost:")) return origin;
      if (/^https:\/\/(?:[a-z0-9-]+\.)?chonburi-control-tower\.pages\.dev$/.test(origin)) return origin;
      return "";
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  }),
);

app.get("/", (c) =>
  c.json({
    service: "chonburi-control-tower-api",
    routes: [
      "/api/health",
      "/api/sources",
      "/api/incidents/city-reports",
      "/api/incidents/itic",
      "/api/news",
      "/api/news/archive",
      "/api/news/digest",
      "/api/news/stats",
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
      "/api/datago/points",
      "/api/datago/datasets",
      "/api/social/facebook",
      "/api/chat",
      "/api/health/detailed",
      "/api/twin/objects",
      "/api/twin/relations",
      "/api/twin/state",
      "/api/twin/snapshot",
    ],
  }),
);

app.get("/api/sources", (c) => c.json({ sources: SOURCE_CATALOG }));

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    at: new Date().toISOString(),
    env: c.env.ENVIRONMENT ?? "unknown",
  }),
);

app.get("/api/health/detailed", (c) => {
  const sys = getSystemStatus();
  return c.json({
    system: sys,
    adapters: getAllHealth(),
    mqtt: getMqttStatus(),
    at: new Date().toISOString(),
  });
});

interface FeedMeta {
  meta: { ageMinutes: number; fallbackTier: string; source: string };
}

function setMetaHeaders(c: { header: (k: string, v: string) => void }, feed: FeedMeta) {
  c.header("x-source", feed.meta.source);
  c.header("x-age-minutes", String(feed.meta.ageMinutes));
  c.header("x-fallback-tier", feed.meta.fallbackTier);
}

const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 120;

function getClientIp(c: { req: { header: (k: string) => string | undefined }; env: Bindings }): string {
  return c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function cleanupStaleLimiters() {
  const now = Date.now();
  for (const [ip, entry] of rateLimiter) {
    if (now > entry.resetAt) rateLimiter.delete(ip);
  }
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (rateLimiter.size > 1000) cleanupStaleLimiters();
  const entry = rateLimiter.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

app.use("/api/*", async (c, next) => {
  const ip = getClientIp(c);
  if (isRateLimited(ip)) {
    return c.json({ error: "Rate limit exceeded. Slow down." }, 429);
  }
  await next();
});

async function safeFeed<T>(
  c: { header: (k: string, v: string) => void; json: (obj: unknown, status?: number) => Response },
  fetcher: () => Promise<NormalizedFeed<T>>,
  adapterName?: string,
): Promise<Response> {
  try {
    const feed = await fetcher();
    setMetaHeaders(c, feed);
    if (adapterName) recordAdapterSuccess(adapterName, feed.meta.ageMinutes);
    return c.json(feed);
  } catch (err) {
    const message = (err as Error).message ?? "Internal server error";
    console.error(`API error [${adapterName ?? "unknown"}]:`, message);
    if (adapterName) recordAdapterError(adapterName, message);
    return c.json({ error: message }, 500);
  }
}

app.get("/api/incidents/city-reports", async (c) => safeFeed(c, fetchCityReports, "city-reports"));
app.get("/api/incidents/itic", async (c) => safeFeed(c, fetchItic, "itic"));
app.get("/api/news", async (c) => safeFeed(c, fetchNews, "news"));

app.get("/api/news/archive", async (c) => {
  const mod = await tryArchiveApi();
  if (!mod) return c.json({ error: "Archive only available on Node runtime" }, 503);
  const q = c.req.query();
  const limit = q.limit ? Math.min(Math.max(Number.parseInt(q.limit, 10) || 200, 1), 5000) : 200;
  const records = await mod.readNewsArchive({
    since: q.since,
    until: q.until,
    source: q.source,
    language: q.language as never,
    q: q.q,
    limit,
  });
  c.header("Cache-Control", "public, max-age=60");
  return c.json({ records, count: records.length });
});

app.get("/api/news/digest", async (c) => {
  const mod = await tryArchiveApi();
  if (!mod) return c.json({ error: "Archive only available on Node runtime" }, 503);
  const periodParam = c.req.query("period");
  const period = periodParam === "24h" || periodParam === "30d" ? periodParam : "7d";
  const digest = await mod.digestNewsArchive(period);
  c.header("Cache-Control", "public, max-age=300");
  return c.json(digest);
});

app.get("/api/news/stats", async (c) => {
  const mod = await tryArchiveApi();
  if (!mod) return c.json({ error: "Archive only available on Node runtime" }, 503);
  c.header("Cache-Control", "public, max-age=60");
  return c.json(await mod.newsArchiveStats());
});

app.get("/api/weather", async (c) => safeFeed(c, fetchWeather, "weather"));
app.get("/api/precip-nowcast", async (c) => safeFeed(c, fetchPrecipNowcast, "precip-nowcast"));
app.get("/api/air-quality", async (c) => safeFeed(c, fetchAirQuality, "air-quality"));
app.get("/api/air-quality/trend", async (c) => safeFeed(c, fetchAirQualityTrend, "air-quality-trend"));
app.get("/api/cctv/longdo", async (c) => safeFeed(c, fetchCctv, "cctv"));
app.get("/api/trends", async (c) => safeFeed(c, fetchTrends, "trends"));
app.get("/api/maritime/ais", (c) => {
  const feed = fetchAisVessels();
  setMetaHeaders(c, feed);
  return c.json(feed);
});
app.get("/api/datago/points", (c) => {
  const feed = fetchDatagoPoints();
  setMetaHeaders(c, feed);
  return c.json(feed);
});
app.get("/api/datago/datasets",  async (c) => safeFeed(c, fetchDatagoDatasets, "datago-datasets"));
app.get("/api/datago/reservoirs", async (c) => {
  const token = c.env.DATA_GO_TH_TOKEN ?? "";
  return safeFeed(c, () => fetchReservoirs(token), "reservoirs");
});
app.get("/api/datago/disasters",  async (c) => {
  const token = c.env.DATA_GO_TH_TOKEN ?? "";
  return safeFeed(c, () => fetchDisasterStats(token), "disasters");
});
app.get("/api/datago/fahfon",     async (c) => {
  const token = c.env.DATA_GO_TH_TOKEN ?? "";
  return safeFeed(c, () => fetchFahfon(token), "fahfon");
});
app.get("/api/datago/provincial-kpis", async (c) => {
  const token = c.env.DATA_GO_TH_TOKEN ?? "";
  return safeFeed(c, () => fetchProvincialKPIs(token));
});
app.get("/api/marine", async (c) => safeFeed(c, fetchMarine, "marine"));
app.get("/api/tides",  async (c) => safeFeed(c, fetchTides, "tides"));
app.get("/api/social/facebook", async (c) =>
  safeFeed(c, () => fetchFacebookPosts({ FACEBOOK_PAGE_ID: c.env.FACEBOOK_PAGE_ID, FACEBOOK_PAGE_TOKEN: c.env.FACEBOOK_PAGE_TOKEN }), "facebook"),
);
app.get("/api/markets", async (c) =>
  safeFeed(c, () => fetchMarkets({ FMP_API_KEY: c.env.FMP_API_KEY, FRED_API_KEY: c.env.FRED_API_KEY }), "markets"),
);

app.get("/api/executive", async (c) => {
  try {
    const snapshot = fetchExecutiveSnapshot();
    const [aq, cr, itic, newsFeed] = await Promise.allSettled([
      fetchAirQuality().catch(() => ({ features: [] as AirQualityPoint[], meta: { source: "", fetchedAt: "", ageMinutes: 0, fallbackTier: "unavailable" as const } })),
      fetchCityReports().catch(() => ({ features: [] as IncidentFeature[], meta: { source: "", fetchedAt: "", ageMinutes: 0, fallbackTier: "unavailable" as const } })),
      fetchItic().catch(() => ({ features: [] as IncidentFeature[], meta: { source: "", fetchedAt: "", ageMinutes: 0, fallbackTier: "unavailable" as const } })),
      fetchNews().catch(() => ({ features: [] as IntelligenceItem[], meta: { source: "", fetchedAt: "", ageMinutes: 0, fallbackTier: "unavailable" as const } })),
    ]);

    const aqOk = aq.status === "fulfilled" ? aq.value : { features: [] as AirQualityPoint[], meta: { source: "", fetchedAt: "", ageMinutes: 0, fallbackTier: "unavailable" as const } };
    const crOk = cr.status === "fulfilled" ? cr.value : { features: [] as IncidentFeature[], meta: { source: "", fetchedAt: "", ageMinutes: 0, fallbackTier: "unavailable" as const } };
    const iticOk = itic.status === "fulfilled" ? itic.value : { features: [] as IncidentFeature[], meta: { source: "", fetchedAt: "", ageMinutes: 0, fallbackTier: "unavailable" as const } };
    const newsOk = newsFeed.status === "fulfilled" ? newsFeed.value : { features: [] as IntelligenceItem[], meta: { source: "", fetchedAt: "", ageMinutes: 0, fallbackTier: "unavailable" as const } };

    const aqiVal = aqOk.features[0]?.aqi ?? null;
    const openIncidents = crOk.features.filter((r) => r.status !== "resolved").length + iticOk.features.length;
    const newsItems = newsOk.features.map((n) => ({ title: n.title, score: n.score, publishedAt: n.publishedAt }));

    const alerts = deriveAlerts(aqiVal, openIncidents, newsItems);
    const data: ExecutiveSnapshot = { ...snapshot.features[0], alerts };
    const feed: NormalizedFeed<ExecutiveSnapshot> = { features: [data], meta: snapshot.meta };
    setMetaHeaders(c, feed);
    return c.json(feed);
  } catch (err) {
    console.error("Executive API error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

const chatLimiter = new Map<string, { count: number; resetAt: number }>();
const CHAT_RATE_LIMIT = 20;

function isChatRateLimited(ip: string): boolean {
  const now = Date.now();
  if (chatLimiter.size > 500) {
    for (const [k, v] of chatLimiter) if (now > v.resetAt) chatLimiter.delete(k);
  }
  const entry = chatLimiter.get(ip);
  if (!entry || now > entry.resetAt) {
    chatLimiter.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= CHAT_RATE_LIMIT) return true;
  entry.count++;
  return false;
}

app.post("/api/chat", async (c) => {
  const ip = getClientIp(c);
  if (isChatRateLimited(ip)) {
    return c.json({ error: "Chat rate limit exceeded. Wait a minute." }, 429);
  }
  const geminiApiKey = c.env.GEMINI_API_KEY;
  const ollamaBaseUrl = c.env.OLLAMA_BASE_URL;
  if (!geminiApiKey && !ollamaBaseUrl) {
    return c.json({ error: "Chat service not configured" }, 503);
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  try {
    const result = await chat({ messages: body.messages ?? [] }, { geminiApiKey, ollamaBaseUrl });
    c.header("x-source", result.meta.source);
    c.header("x-fallback-tier", result.meta.fallbackTier);
    return c.json(result);
  } catch (err) {
    if (err instanceof ChatError) {
      return c.json({ error: err.message }, err.status as 400 | 429 | 502 | 503);
    }
    console.error("[chat] unexpected:", err);
    return c.json({ error: "Internal error" }, 500);
  }
});

app.route("/api/twin", twinApp);

export default app;
