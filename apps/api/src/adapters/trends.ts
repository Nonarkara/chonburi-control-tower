// Google Trends adapter — uses the unofficial google-trends-api package
// (Node only; not Workers-compatible). Returns interest-over-time +
// related-queries for a set of Chula keywords across three languages.
// Cached 15 min to stay under Google's soft rate limits.

import type { NormalizedFeed } from "@chula/shared";
import { cacheAgeMinutes, cached } from "../lib/cache.js";

interface TrendPoint { time: string; value: number }
interface RelatedQuery { query: string; value: number; link?: string | null }

export interface TrendsSnapshot {
  lang: "en" | "th" | "zh-CN";
  keyword: string;
  /** ISO 3166 region passed to the trends API (TH for Thai, "" for global). */
  geo: string;
  interestOverTime: TrendPoint[];
  relatedTop: RelatedQuery[];
  relatedRising: RelatedQuery[];
  fetchedAt: string;
  err?: string;
}

const TTL_SECONDS = 15 * 60;

// Lazy-load the Node-only google-trends-api so Cloudflare Workers builds
// don't fail at module evaluation time.
let trendsModule: unknown = null;
async function getTrendsModule() {
  if (trendsModule) return trendsModule;
  const mod = await import("google-trends-api");
  trendsModule = mod.default ?? mod;
  return trendsModule;
}

interface TrendsApi {
  interestOverTime: (opts: Record<string, unknown>) => Promise<string>;
  relatedQueries:   (opts: Record<string, unknown>) => Promise<string>;
}

type Lang = "en" | "th" | "zh-CN";

const KEYWORDS: Record<Lang, { keyword: string; geo: string; hl: string }> = {
  en:      { keyword: "Chulalongkorn",  geo: "TH",  hl: "en-US" },
  th:      { keyword: "จุฬาลงกรณ์",       geo: "TH",  hl: "th-TH" },
  "zh-CN": { keyword: "朱拉隆功",          geo: "",    hl: "zh-CN" },
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Trends timeout")), ms)),
  ]);
}

async function fetchOneLang(lang: Lang): Promise<TrendsSnapshot> {
  const cfg = KEYWORDS[lang];
  const fetchedAt = new Date().toISOString();
  const empty = (err: string): TrendsSnapshot => ({
    lang, keyword: cfg.keyword, geo: cfg.geo,
    interestOverTime: [], relatedTop: [], relatedRising: [],
    fetchedAt, err,
  });

  // Common request shape — Google Trends "explore" defaults to past 12 months.
  const opts = {
    keyword: cfg.keyword,
    startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // past 90 days
    geo: cfg.geo,
    hl: cfg.hl,
  } as const;

  let trends: TrendsApi;
  try {
    trends = (await getTrendsModule()) as TrendsApi;
  } catch {
    return empty("google-trends-api unavailable");
  }

  let iotJson = "";
  let rqJson = "";
  try {
    [iotJson, rqJson] = await withTimeout(Promise.all([
      trends.interestOverTime(opts),
      trends.relatedQueries(opts),
    ]), 20_000);
  } catch (e) {
    return empty((e as Error).message);
  }

  // interestOverTime payload: { default: { timelineData: [{ time, value: [n], formattedValue, formattedAxisTime }] } }
  let interest: TrendPoint[] = [];
  try {
    const p = JSON.parse(iotJson) as {
      default?: { timelineData?: Array<{ formattedAxisTime?: string; time?: string; value?: number[] }> };
    };
    interest =
      p.default?.timelineData?.map((d) => ({
        time: d.formattedAxisTime ?? d.time ?? "",
        value: Array.isArray(d.value) ? d.value[0] ?? 0 : 0,
      })) ?? [];
  } catch {}

  let top: RelatedQuery[] = [];
  let rising: RelatedQuery[] = [];
  try {
    const p = JSON.parse(rqJson) as {
      default?: {
        rankedList?: Array<{
          rankedKeyword?: Array<{
            query: string;
            value: number;
            formattedValue?: string;
            link?: string;
          }>;
        }>;
      };
    };
    const lists = p.default?.rankedList ?? [];
    if (lists[0]?.rankedKeyword) {
      top = lists[0].rankedKeyword.slice(0, 10).map((k) => ({
        query: k.query, value: k.value, link: k.link ? `https://trends.google.com${k.link}` : null,
      }));
    }
    if (lists[1]?.rankedKeyword) {
      rising = lists[1].rankedKeyword.slice(0, 10).map((k) => ({
        query: k.query, value: k.value, link: k.link ? `https://trends.google.com${k.link}` : null,
      }));
    }
  } catch {}

  return { lang, keyword: cfg.keyword, geo: cfg.geo, interestOverTime: interest, relatedTop: top, relatedRising: rising, fetchedAt };
}

export async function fetchTrends(): Promise<NormalizedFeed<TrendsSnapshot>> {
  return cached("trends-chula", TTL_SECONDS, async () => {
    const fetchedAt = new Date().toISOString();
    const settled = await Promise.allSettled<TrendsSnapshot>([
      fetchOneLang("en"),
      fetchOneLang("th"),
      fetchOneLang("zh-CN"),
    ]);
    const features = settled
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((v): v is TrendsSnapshot => v !== null);
    const live = features.some((f) => f.interestOverTime.length > 0);
    return {
      features,
      meta: {
        source: "google-trends",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: live ? "live" : "scenario",
      },
    };
  });
}
