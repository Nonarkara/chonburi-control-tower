/**
 * Global Markets — FMP (stable endpoint, free tier) + FRED (St Louis Fed).
 *
 * FMP free tier is hard-capped (250 req/day, 1 symbol per call). We use it
 * only for the 4 indices that matter most to a Thai operator: S&P, Nikkei,
 * Hang Seng, STI Singapore. FRED is generous and covers Thai forex, US
 * yields, VIX, WTI/Brent, gold.
 */

import type { MarketSnapshot, MarketTick, NormalizedFeed } from "@chonburi/shared";
import { cacheAgeMinutes, cachedWithStale as cached } from "../lib/cache.js";
import { fetchJsonOrNull } from "./common.js";

const TTL_SECONDS = 1800;

interface FmpStableQuote {
  symbol: string;
  name?: string;
  price?: number;
  changePercentage?: number;
  change?: number;
  previousClose?: number;
  exchange?: string;
}

interface FredObservation {
  date: string;
  value: string;
}

interface FredResp {
  observations?: FredObservation[];
}

const FMP_BASE = "https://financialmodelingprep.com/stable";
const FRED_BASE = "https://api.stlouisfed.org/fred";

const FMP_INDICES = [
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "^N225", name: "Nikkei 225" },
  { symbol: "^HSI",  name: "Hang Seng" },
  { symbol: "^STI",  name: "STI Singapore" },
];

const FRED_SERIES: Array<{ id: string; name: string; group: MarketTick["group"] }> = [
  { id: "DEXTHUS",      name: "THB / USD",      group: "forex" },
  { id: "DEXJPUS",      name: "JPY / USD",      group: "forex" },
  { id: "DEXCHUS",      name: "CNY / USD",      group: "forex" },
  { id: "DEXUSEU",      name: "USD / EUR",      group: "forex" },
  { id: "DCOILWTICO",   name: "WTI Crude",      group: "commodity" },
  { id: "DCOILBRENTEU", name: "Brent Crude",    group: "commodity" },
  { id: "GOLDPMGBD228NLBM", name: "Gold (London PM)", group: "commodity" },
  { id: "DGS10",        name: "US 10Y yield",   group: "macro" },
  { id: "DGS2",         name: "US 2Y yield",    group: "macro" },
  { id: "VIXCLS",       name: "VIX",            group: "macro" },
];

async function fetchFmpStable(symbol: string, name: string, key: string): Promise<MarketTick | null> {
  const url = `${FMP_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`;
  const payload = await fetchJsonOrNull<FmpStableQuote[]>(url);
  if (!payload || !Array.isArray(payload) || payload.length === 0) return null;
  const q = payload[0];
  return {
    symbol: q.symbol ?? symbol,
    name,
    group: "index",
    value: typeof q.price === "number" ? q.price : null,
    changePct: typeof q.changePercentage === "number" ? q.changePercentage : null,
    asOf: new Date().toISOString(),
  };
}

async function fetchFredSeries(id: string, name: string, group: MarketTick["group"], key: string): Promise<MarketTick | null> {
  const url = `${FRED_BASE}/series/observations?series_id=${id}&api_key=${encodeURIComponent(key)}&file_type=json&limit=2&sort_order=desc`;
  const payload = await fetchJsonOrNull<FredResp>(url);
  if (!payload?.observations || payload.observations.length === 0) return null;
  const valid = payload.observations.filter((o) => o.value !== ".");
  if (valid.length === 0) return null;
  const [latest, prev] = valid;
  const v = parseFloat(latest.value);
  const p = prev ? parseFloat(prev.value) : NaN;
  return {
    symbol: id,
    name,
    group,
    value: Number.isFinite(v) ? v : null,
    changePct: Number.isFinite(v) && Number.isFinite(p) && p !== 0 ? ((v - p) / p) * 100 : null,
    asOf: latest.date,
  };
}

export async function fetchMarkets(env: {
  FMP_API_KEY?: string;
  FRED_API_KEY?: string;
}): Promise<NormalizedFeed<MarketSnapshot>> {
  return cached("markets", TTL_SECONDS, async () => {
    const fetchedAt = new Date().toISOString();

    if (!env.FMP_API_KEY && !env.FRED_API_KEY) {
      return {
        features: [],
        meta: {
          source: "markets-no-key",
          fetchedAt,
          ageMinutes: 0,
          fallbackTier: "unavailable" as const,
        },
      };
    }

    const fmpPromises = env.FMP_API_KEY
      ? FMP_INDICES.map((i) => fetchFmpStable(i.symbol, i.name, env.FMP_API_KEY!))
      : [];

    const fredPromises = env.FRED_API_KEY
      ? FRED_SERIES.map((s) => fetchFredSeries(s.id, s.name, s.group, env.FRED_API_KEY!))
      : [];

    const settled = await Promise.allSettled([...fmpPromises, ...fredPromises]);
    const ticks = settled
      .filter((r): r is PromiseFulfilledResult<MarketTick | null> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((t): t is MarketTick => t !== null);

    const thbUsd = ticks.find((t) => t.symbol === "DEXTHUS")?.value ?? null;
    const jpyUsd = ticks.find((t) => t.symbol === "DEXJPUS")?.value ?? null;
    const cnyUsd = ticks.find((t) => t.symbol === "DEXCHUS")?.value ?? null;
    const usdEur = ticks.find((t) => t.symbol === "DEXUSEU")?.value ?? null;
    const thb: MarketSnapshot["thb"] = [
      { vs: "USD", rate: thbUsd },
      { vs: "EUR", rate: thbUsd && usdEur ? thbUsd / usdEur : null },
      { vs: "JPY", rate: thbUsd && jpyUsd ? thbUsd / jpyUsd : null },
      { vs: "CNY", rate: thbUsd && cnyUsd ? thbUsd / cnyUsd : null },
    ];

    return {
      features: [{ ticks, thb }],
      meta: {
        source: "markets-fmp-fred",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: ticks.length > 0 ? "live" as const : "unavailable" as const,
      },
    };
  });
}
