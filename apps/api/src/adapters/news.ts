import type { IntelligenceItem, NormalizedFeed } from "@chonburi/shared";
import { cacheAgeMinutes, cached } from "../lib/cache.js";
import { fetchTextOrNull } from "./common.js";
// Archive is Node-only (uses fs). Dynamic import keeps Workers happy.
async function tryArchive(items: IntelligenceItem[]): Promise<void> {
  if (typeof process === "undefined" || !process.versions?.node) return;
  try {
    const mod = await import("../lib/newsArchive.js");
    await mod.archiveNewsItems(items);
  } catch {
    // archive is best-effort; never block the feed on it
  }
}

const TTL_SECONDS = 180; // 3 min

interface Feed {
  id: string;
  label: string;
  url: string;
  trust: number; // 0..1
}

const FEEDS: Feed[] = [
  {
    id: "google-news-chonburi-en",
    label: "Google News (EN)",
    url:
      "https://news.google.com/rss/search?q=%22Chonburi+Municipality%22+OR+%22Eastern+Economic+Corridor%22+OR+%22EEC+Thailand%22&hl=en-TH&gl=TH&ceid=TH:en",
    trust: 0.75,
  },
  {
    id: "google-news-chonburi-th",
    label: "Google News (TH)",
    url:
      "https://news.google.com/rss/search?q=%E0%B9%80%E0%B8%97%E0%B8%A8%E0%B8%9A%E0%B8%B2%E0%B8%A5%E0%B9%80%E0%B8%A1%E0%B8%B7%E0%B8%AD%E0%B8%87%E0%B8%8A%E0%B8%A5%E0%B8%9A%E0%B8%B8%E0%B8%A3%E0%B8%B5+OR+%E0%B8%AD%E0%B8%B5%E0%B8%AD%E0%B8%B5%E0%B8%8B%E0%B8%B5+OR+%E0%B8%8A%E0%B8%A5%E0%B8%9A%E0%B8%B8%E0%B8%A3%E0%B8%B5&hl=th&gl=TH&ceid=TH:th",
    trust: 0.78,
  },
  {
    id: "google-news-chonburi-zh",
    label: "Google News (中文)",
    url:
      "https://news.google.com/rss/search?q=%E6%98%A5%E6%AD%A6%E9%87%8C+OR+EEC%E4%B8%9C%E9%83%A8%E7%BB%8F%E6%B5%8E%E8%B5%B0%E5%BB%8A&hl=zh-CN&gl=TH&ceid=TH:zh-CN",
    trust: 0.72,
  },
  {
    id: "bangkok-post-thailand",
    label: "Bangkok Post",
    url: "https://www.bangkokpost.com/rss/data/thailand.xml",
    trust: 0.85,
  },
];

const FIELD_RE = (tag: string) => new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
const CDATA_RE = /<!\[CDATA\[([\s\S]*?)\]\]>/;

function pick(block: string, tag: string): string {
  const m = block.match(FIELD_RE(tag));
  if (!m) return "";
  const raw = m[1].trim();
  const cdata = raw.match(CDATA_RE);
  return (cdata ? cdata[1] : raw).trim();
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(raw: string, now: Date): Date {
  if (!raw) return now;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return now;
  return d;
}

function scoreItem(item: { title: string; summary: string }, trust: number): number {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  let s = trust * 50;
  for (const kw of [
    "chonburi", "ชลบุรี", "eec", "อีอีซี",
    "ban saen", "บ้านแสน", "laem chabang", "แหลมฉบัง",
    "si racha", "ศรีราชา", "municipality", "เทศบาล",
  ]) {
    if (text.includes(kw)) s += 8;
  }
  for (const kw of ["accident", "อุบัติเหตุ", "flood", "น้ำท่วม", "protest", "ประท้วง", "haze", "ฝุ่น"]) {
    if (text.includes(kw)) s += 6;
  }
  return Math.min(100, Math.round(s));
}

async function parseFeed(feed: Feed): Promise<IntelligenceItem[]> {
  const xml = await fetchTextOrNull(feed.url);
  if (!xml) return [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  const items: IntelligenceItem[] = [];
  const now = new Date();
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];
    const title = stripHtml(pick(block, "title"));
    const link = pick(block, "link");
    const description = stripHtml(pick(block, "description"));
    const pubDate = pick(block, "pubDate");
    const source = pick(block, "source") || feed.label;

    if (!title || !link) continue;

    const it: IntelligenceItem = {
      id: `${feed.id}-${link}`,
      title,
      summary: description.slice(0, 280),
      source,
      sourceUrl: link,
      publishedAt: parseDate(pubDate, now).toISOString(),
      tags: [],
      score: 0,
      kind: "news",
    };
    it.score = scoreItem(it, feed.trust);
    items.push(it);
  }
  return items;
}

export async function fetchNews(): Promise<NormalizedFeed<IntelligenceItem>> {
  const result = await cached<NormalizedFeed<IntelligenceItem> & { _dedup?: IntelligenceItem[] }>(
    "news",
    TTL_SECONDS,
    async () => {
      const fetchedAt = new Date().toISOString();
      const settled = await Promise.allSettled(FEEDS.map(parseFeed));
      const items: IntelligenceItem[] = [];
      for (const r of settled) {
        if (r.status === "fulfilled") items.push(...r.value);
      }

      const seen = new Set<string>();
      const dedup = items.filter((it) => {
        const key = it.title.toLowerCase().replace(/\s+/g, " ");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      dedup.sort((a, b) => b.score - a.score || b.publishedAt.localeCompare(a.publishedAt));
      const top = dedup.slice(0, 30);

      return {
        features: top,
        meta: {
          source: "google-news+bangkok-post",
          fetchedAt,
          ageMinutes: cacheAgeMinutes(fetchedAt),
          fallbackTier: top.length > 0 ? "live" : "scenario",
        },
        _dedup: dedup,
      };
    },
  );

  void tryArchive(result._dedup ?? result.features);

  return {
    features: result.features,
    meta: { ...result.meta, ageMinutes: cacheAgeMinutes(result.meta.fetchedAt) },
  };
}
