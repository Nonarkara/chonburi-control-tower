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

/**
 * Mayor's Action classifier — tag news items with the action the mayor
 * should consider taking. Each tag is a 2-char code shown in the news desk
 * so the mayor can scan headlines for "do I need to do something?".
 *
 * Tags (priority order):
 *   FU = funeral · attend or send wreath / representative
 *   EM = emergency · flood, fire, accident — go to scene / coordinate response
 *   PO = police-citizen friction · consider mediation on behalf of citizens
 *   HO = honor · congratulate, award presentation, achievement
 *   FE = festival / celebration · attend opening
 *   IN = infrastructure issue · road, drainage, lighting — chase the dept
 *   BZ = business / EEC milestone · attend signing / open ceremony
 *   PU = public-health · congratulate hospital staff, visit patients
 *
 * Pattern uses both TH + EN. Multiple tags allowed per item.
 */
const ACTION_PATTERNS: Array<{ tag: string; patterns: RegExp[] }> = [
  { tag: "FU", patterns: [
    /\b(funeral|cremation|wake|condolence|memorial)\b/i,
    /(งานศพ|ฌาปนกิจ|พระราชทานเพลิง|รดน้ำศพ|สวดอภิธรรม|ไว้อาลัย)/,
  ]},
  { tag: "EM", patterns: [
    /\b(flood|fire|earthquake|landslide|tsunami|drown|collapse|explosion|chemical leak|oil spill)\b/i,
    /(น้ำท่วม|ไฟไหม้|เพลิงไหม้|พังถล่ม|แผ่นดินไหว|จมน้ำ|สึนามิ|รั่วไหล|ดินถล่ม|พายุ|น้ำขัง)/,
  ]},
  { tag: "PO", patterns: [
    /\b(arrested|raid|crackdown|protest|complaint against|police violence|brutality)\b/i,
    /(จับกุม|ตำรวจรวบ|ร้องเรียนตำรวจ|ปะทะ|ปราบปราม|กวาดล้าง|กระทำเกินกว่าเหตุ|ประท้วง)/,
  ]},
  { tag: "HO", patterns: [
    /\b(award|prize|honour|honored|graduate|champion|win|recognition|distinguished)\b/i,
    /(รางวัล|สำเร็จการศึกษา|ปริญญา|ได้รับการยกย่อง|แชมป์|ชนะเลิศ|เกียรติยศ|ยกย่อง)/,
  ]},
  { tag: "FE", patterns: [
    /\b(festival|opening ceremony|inauguration|grand opening|celebration|anniversary|new year|songkran|loy krathong)\b/i,
    /(เทศกาล|พิธีเปิด|พิธีวางศิลาฤกษ์|ครบรอบ|ฉลอง|สงกรานต์|ลอยกระทง|วันชาติ)/,
  ]},
  { tag: "IN", patterns: [
    /\b(road damage|pothole|sewer|drainage|lighting|water supply|outage|sinkhole|blackout)\b/i,
    /(ถนนชำรุด|ท่อระบายน้ำ|น้ำประปา|ไฟดับ|ไฟฟ้าดับ|หลุมยุบ|ซ่อมแซมถนน|ปรับปรุง)/,
  ]},
  { tag: "BZ", patterns: [
    /\b(eec|investment|factory|signing ceremony|mou|industrial|laem chabang|port)\b/i,
    /(อีอีซี|EEC|การลงทุน|โรงงาน|พิธีลงนาม|MOU|นิคมอุตสาหกรรม|แหลมฉบัง|ท่าเรือ)/,
  ]},
  { tag: "PU", patterns: [
    /\b(hospital|doctor|nurse|patient|outbreak|vaccination|public health)\b/i,
    /(โรงพยาบาล|แพทย์|พยาบาล|ผู้ป่วย|วัคซีน|สาธารณสุข|ระบาด)/,
  ]},
];

function actionTags(item: { title: string; summary: string }): string[] {
  const text = `${item.title} ${item.summary}`;
  const tags: string[] = [];
  for (const { tag, patterns } of ACTION_PATTERNS) {
    if (patterns.some((p) => p.test(text))) tags.push(tag);
  }
  return tags;
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

    const tags = actionTags({ title, summary: description });
    const it: IntelligenceItem = {
      id: `${feed.id}-${link}`,
      title,
      summary: description.slice(0, 280),
      source,
      sourceUrl: link,
      publishedAt: parseDate(pubDate, now).toISOString(),
      tags,
      score: 0,
      kind: "news",
    };
    it.score = scoreItem(it, feed.trust);
    // Boost actionable items so they float to the top of the news desk
    if (tags.includes("EM") || tags.includes("FU") || tags.includes("PO")) it.score += 15;
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
