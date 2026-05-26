import type { IntelligenceItem, NormalizedFeed } from "@chonburi/shared";
import { cacheAgeMinutes, cachedWithStale as cached } from "../lib/cache.js";
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
      "https://news.google.com/rss/search?q=%22Chonburi%22+OR+%22Eastern+Economic+Corridor%22+OR+%22EEC+Thailand%22+OR+%22Laem+Chabang%22+OR+%22Si+Racha%22&hl=en-TH&gl=TH&ceid=TH:en",
    trust: 0.75,
  },
  {
    id: "google-news-chonburi-th",
    label: "Google News (TH)",
    url:
      "https://news.google.com/rss/search?q=%E0%B8%8A%E0%B8%A5%E0%B8%9A%E0%B8%B8%E0%B8%A3%E0%B8%B5+OR+%E0%B9%80%E0%B8%97%E0%B8%A8%E0%B8%9A%E0%B8%B2%E0%B8%A5%E0%B9%80%E0%B8%A1%E0%B8%B7%E0%B8%AD%E0%B8%87%E0%B8%8A%E0%B8%A5%E0%B8%9A%E0%B8%B8%E0%B8%A3%E0%B8%B5+OR+%E0%B8%AD%E0%B8%B5%E0%B8%AD%E0%B8%B5%E0%B8%8B%E0%B8%B5+OR+%E0%B9%81%E0%B8%AB%E0%B8%A5%E0%B8%A1%E0%B8%89%E0%B8%9A%E0%B8%B1%E0%B8%87+OR+%E0%B8%A8%E0%B8%A3%E0%B8%B5%E0%B8%A3%E0%B8%B2%E0%B8%8A%E0%B8%B2&hl=th&gl=TH&ceid=TH:th",
    trust: 0.78,
  },
  {
    id: "google-news-chonburi-crime-th",
    label: "Google News Crime (TH)",
    url:
      "https://news.google.com/rss/search?q=%E0%B8%AD%E0%B8%B8%E0%B8%9A%E0%B8%B1%E0%B8%95%E0%B8%B4%E0%B9%80%E0%B8%AB%E0%B8%95%E0%B8%B8+%E0%B8%8A%E0%B8%A5%E0%B8%9A%E0%B8%B8%E0%B8%A3%E0%B8%B5+OR+%E0%B8%88%E0%B8%B1%E0%B8%9A%E0%B8%81%E0%B8%B8%E0%B8%A1+%E0%B8%8A%E0%B8%A5%E0%B8%9A%E0%B8%B8%E0%B8%A3%E0%B8%B5+OR+%E0%B8%95%E0%B8%B3%E0%B8%A3%E0%B8%A7%E0%B8%88+%E0%B8%8A%E0%B8%A5%E0%B8%9A%E0%B8%B8%E0%B8%A3%E0%B8%B5+OR+%E0%B8%99%E0%B9%89%E0%B8%B3%E0%B8%97%E0%B9%88%E0%B8%A7%E0%B8%A1+%E0%B8%8A%E0%B8%A5%E0%B8%9A%E0%B8%B8%E0%B8%A3%E0%B8%B5&hl=th&gl=TH&ceid=TH:th",
    trust: 0.80,
  },
  {
    id: "bangkok-post-thailand",
    label: "Bangkok Post",
    url: "https://www.bangkokpost.com/rss/data/thailand.xml",
    trust: 0.85,
  },
  {
    id: "thai-pbs-news",
    label: "Thai PBS",
    url: "https://news.thaipbs.or.th/rss/news.xml",
    trust: 0.82,
  },
  {
    id: "matichon-online",
    label: "Matichon",
    url: "https://www.matichon.co.th/feed",
    trust: 0.78,
  },
];

// Reject news older than this many days — the mayor should not see month-old
// stories that are embarrassing or irrelevant.
const MAX_AGE_DAYS = 7;

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
    "bang saen", "บางแสน", "muang chonburi", "เมืองชลบุรี",
  ]) {
    if (text.includes(kw)) s += 8;
  }
  for (const kw of ["accident", "อุบัติเหตุ", "flood", "น้ำท่วม", "protest", "ประท้วง", "haze", "ฝุ่น", "fire", "ไฟไหม้", "crime", "อาชญากรรม"]) {
    if (text.includes(kw)) s += 6;
  }
  return Math.min(100, Math.round(s));
}

// ── Location extraction ───────────────────────────────────────────────
// Known places inside Chonburi Town Municipality that the mayor cares about.
// Extracted from news text and pinned on the map so the mayor can see
// "market fire = THIS market", "accident at THIS temple", etc.

interface KnownPlace {
  name: string;
  aliases: string[];
  lat: number;
  lng: number;
}

const KNOWN_PLACES: KnownPlace[] = [
  { name: "Talat Chonburi", aliases: ["ตลาดชลบุรี", "talat chonburi", "chonburi market", "ตลาดสดชลบุรี", "talad chonburi"], lat: 13.3619, lng: 100.9841 },
  { name: "Wat Yai Intharam", aliases: ["วัดใหญ่อินทาราม", "wat yai", "wat yai intharam", "วัดใหญ่"], lat: 13.3625, lng: 100.9855 },
  { name: "Chonburi City Hall", aliases: ["ศาลากลางชลบุรี", "city hall", "เทศบาลเมืองชลบุรี", "chonburi municipality"], lat: 13.3611, lng: 100.9847 },
  { name: "Chonburi Railway Station", aliases: ["สถานีรถไฟชลบุรี", "chonburi station", "railway station"], lat: 13.3585, lng: 100.9830 },
  { name: "Bang Saen Beach", aliases: ["หาดบางแสน", "bang saen", "bangsaen", "บางแสน"], lat: 13.2900, lng: 100.9200 },
  { name: "Laem Chabang Port", aliases: ["แหลมฉบัง", "laem chabang", "laemchabang", "ท่าเรือแหลมฉบัง"], lat: 13.0883, lng: 100.8833 },
  { name: "Si Racha", aliases: ["ศรีราชา", "si racha", "siracha", "อำเภอศรีราชา"], lat: 13.1737, lng: 100.9310 },
  { name: "Central Chonburi", aliases: ["เซ็นทรัลชลบุรี", "central chonburi", "central plaza chonburi"], lat: 13.3620, lng: 100.9835 },
  { name: "Chonburi Hospital", aliases: ["โรงพยาบาลชลบุรี", "chonburi hospital", "hospital chonburi"], lat: 13.3630, lng: 100.9860 },
  { name: "Ang Sila", aliases: ["อ่างศิลา", "ang sila", "angsila"], lat: 13.3400, lng: 100.9300 },
  { name: "Nong Mon Market", aliases: ["ตลาดหนองมน", "nong mon", "nongmon", "หนองมน"], lat: 13.2750, lng: 100.9250 },
  { name: "Koh Loi", aliases: ["เกาะลอย", "koh loi", "kohloy"], lat: 13.3550, lng: 100.9780 },
  { name: "Sukhumvit Road", aliases: ["ถนนสุขุมวิท", "sukhumvit", "sukhumvit road", "highway 3"], lat: 13.3610, lng: 100.9850 },
];

function extractLocation(text: string): { lat: number; lng: number; placeName: string } | null {
  const lower = text.toLowerCase();
  for (const place of KNOWN_PLACES) {
    for (const alias of place.aliases) {
      if (lower.includes(alias.toLowerCase())) {
        return { lat: place.lat, lng: place.lng, placeName: place.name };
      }
    }
  }
  return null;
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
  const cutoff = new Date(now.getTime() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];
    const title = stripHtml(pick(block, "title"));
    const link = pick(block, "link");
    const description = stripHtml(pick(block, "description"));
    const pubDate = pick(block, "pubDate");
    const source = pick(block, "source") || feed.label;

    if (!title || !link) continue;

    const parsedDate = parseDate(pubDate, now);
    // Freshness gate — reject stale items so the mayor never sees
    // month-old embarrassing stories.
    if (parsedDate < cutoff) continue;

    const tags = actionTags({ title, summary: description });
    const loc = extractLocation(`${title} ${description}`);
    const it: IntelligenceItem = {
      id: `${feed.id}-${link}`,
      title,
      summary: description.slice(0, 280),
      source,
      sourceUrl: link,
      publishedAt: parsedDate.toISOString(),
      tags,
      score: 0,
      kind: "news",
      lat: loc?.lat ?? null,
      lng: loc?.lng ?? null,
      placeName: loc?.placeName ?? null,
    };
    it.score = scoreItem(it, feed.trust);
    // Boost actionable items so they float to the top of the news desk
    if (tags.includes("EM") || tags.includes("FU") || tags.includes("PO")) it.score += 15;
    // Boost geolocated items — the mayor can see them on the map
    if (loc) it.score += 10;
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
