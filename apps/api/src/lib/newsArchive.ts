/**
 * Append-only news archive — every unique Chula-related story we have ever
 * seen, deduped by URL hash, persisted to disk. Survives launchd restarts.
 *
 * The launchd-managed Node API runs 24/7 and prewarms `/api/news` every
 * 5 min, so anything that ever appears in any of our RSS feeds lands here
 * and stays here. PR can hit `/api/news/archive` to enumerate every
 * mention since this server first started, or `/api/news/digest` for the
 * last 24h / 7d / 30d roll-up.
 *
 * Storage format: JSONL at `apps/api/var/news-archive.jsonl`. One record
 * per line, append-only — easy to grep, easy to back up, easy to feed
 * into any tool the PR office uses (Google Sheets import, BI tool, etc.).
 * Boot rebuilds the in-memory dedup set by scanning the file once.
 */

import { appendFile, readFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import type { IntelligenceItem } from "@chonburi/shared";

const ARCHIVE = resolve(process.cwd(), "var", "news-archive.jsonl");
const seen = new Set<string>();
let totalRecords = 0;

export interface NewsArchiveRecord {
  id: string;
  url: string;
  title: string;
  summary: string;
  source: string;
  language: "en" | "th" | "zh" | "other";
  publishedAt: string;
  firstSeenAt: string;
  score: number;
  tags: string[];
}

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

function detectLanguage(s: string): NewsArchiveRecord["language"] {
  if (/[฀-๿]/.test(s)) return "th";
  if (/[一-鿿]/.test(s)) return "zh";
  if (/[a-zA-Z]/.test(s)) return "en";
  return "other";
}

/**
 * Read the JSONL once at boot, populate the in-memory dedup set. Returns
 * the count restored. Quietly returns 0 if the file is missing.
 */
export async function hydrateNewsArchive(): Promise<number> {
  if (!existsSync(ARCHIVE)) return 0;
  try {
    const raw = await readFile(ARCHIVE, "utf8");
    let count = 0;
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line) as NewsArchiveRecord;
        if (rec.id) {
          seen.add(rec.id);
          count++;
        }
      } catch {
        // skip malformed line — append-only file may have a torn last write
      }
    }
    totalRecords = count;
    return count;
  } catch {
    return 0;
  }
}

/**
 * Append any items we haven't seen before. Called from inside the news
 * adapter so every prewarm tick captures whatever the RSS feeds carry.
 */
export async function archiveNewsItems(items: IntelligenceItem[]): Promise<number> {
  if (items.length === 0) return 0;
  const now = new Date().toISOString();
  const newLines: string[] = [];
  for (const it of items) {
    if (!it.sourceUrl) continue;
    const id = hashUrl(it.sourceUrl);
    if (seen.has(id)) continue;
    seen.add(id);
    const rec: NewsArchiveRecord = {
      id,
      url: it.sourceUrl,
      title: it.title,
      summary: it.summary,
      source: it.source,
      language: detectLanguage(it.title),
      publishedAt: it.publishedAt,
      firstSeenAt: now,
      score: it.score,
      tags: it.tags ?? [],
    };
    newLines.push(JSON.stringify(rec));
  }
  if (newLines.length === 0) return 0;
  try {
    await mkdir(dirname(ARCHIVE), { recursive: true });
    await appendFile(ARCHIVE, newLines.join("\n") + "\n", "utf8");
    totalRecords += newLines.length;
  } catch (err) {
    console.error("[newsArchive] append failed:", (err as Error).message);
  }
  return newLines.length;
}

export interface ArchiveQuery {
  since?: string;
  until?: string;
  source?: string;
  language?: NewsArchiveRecord["language"];
  q?: string;
  limit?: number;
}

/**
 * Reverse-scan the JSONL — newest record first — with optional filters.
 * Returns up to `limit` matches (default 200).
 */
export async function readNewsArchive(opts: ArchiveQuery = {}): Promise<NewsArchiveRecord[]> {
  if (!existsSync(ARCHIVE)) return [];
  const raw = await readFile(ARCHIVE, "utf8");
  const limit = Math.max(1, Math.min(opts.limit ?? 200, 5000));
  const out: NewsArchiveRecord[] = [];
  const q = opts.q?.toLowerCase();
  const lines = raw.split("\n");
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as NewsArchiveRecord;
      if (opts.since && rec.firstSeenAt < opts.since) continue;
      if (opts.until && rec.firstSeenAt > opts.until) continue;
      if (opts.source && rec.source !== opts.source) continue;
      if (opts.language && rec.language !== opts.language) continue;
      if (q && !(rec.title.toLowerCase().includes(q) || rec.summary.toLowerCase().includes(q))) continue;
      out.push(rec);
    } catch {
      // skip
    }
  }
  return out;
}

export interface ArchiveDigest {
  period: "24h" | "7d" | "30d";
  windowStart: string;
  totalArchived: number;
  totalInWindow: number;
  bySource: Array<{ source: string; count: number }>;
  byLanguage: Array<{ language: NewsArchiveRecord["language"]; count: number }>;
  byDay: Array<{ day: string; count: number }>;
  topHeadlines: Array<{ title: string; source: string; url: string; firstSeenAt: string; score: number }>;
}

const PERIOD_HOURS: Record<ArchiveDigest["period"], number> = { "24h": 24, "7d": 168, "30d": 720 };

/**
 * Aggregate roll-up for PR: counts by source, language, day, plus the
 * 12 highest-scoring headlines in the window.
 */
export async function digestNewsArchive(period: ArchiveDigest["period"] = "7d"): Promise<ArchiveDigest> {
  const hours = PERIOD_HOURS[period];
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const recent = await readNewsArchive({ since, limit: 5000 });

  const bySourceMap = new Map<string, number>();
  const byLanguageMap = new Map<NewsArchiveRecord["language"], number>();
  const byDayMap = new Map<string, number>();
  for (const r of recent) {
    bySourceMap.set(r.source, (bySourceMap.get(r.source) ?? 0) + 1);
    byLanguageMap.set(r.language, (byLanguageMap.get(r.language) ?? 0) + 1);
    const day = r.firstSeenAt.slice(0, 10);
    byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);
  }

  const topHeadlines = [...recent]
    .sort((a, b) => b.score - a.score || b.firstSeenAt.localeCompare(a.firstSeenAt))
    .slice(0, 12)
    .map((r) => ({ title: r.title, source: r.source, url: r.url, firstSeenAt: r.firstSeenAt, score: r.score }));

  return {
    period,
    windowStart: since,
    totalArchived: totalRecords,
    totalInWindow: recent.length,
    bySource: [...bySourceMap.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    byLanguage: [...byLanguageMap.entries()].map(([language, count]) => ({ language, count })).sort((a, b) => b.count - a.count),
    byDay: [...byDayMap.entries()].map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day)),
    topHeadlines,
  };
}

export interface ArchiveStats {
  totalRecords: number;
  fileBytes: number;
  oldestSeenAt: string | null;
  newestSeenAt: string | null;
  distinctSources: number;
}

export async function newsArchiveStats(): Promise<ArchiveStats> {
  let fileBytes = 0;
  let oldestSeenAt: string | null = null;
  let newestSeenAt: string | null = null;
  const sourceSet = new Set<string>();
  if (existsSync(ARCHIVE)) {
    try {
      const s = await stat(ARCHIVE);
      fileBytes = s.size;
      const raw = await readFile(ARCHIVE, "utf8");
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        try {
          const rec = JSON.parse(line) as NewsArchiveRecord;
          if (!oldestSeenAt || rec.firstSeenAt < oldestSeenAt) oldestSeenAt = rec.firstSeenAt;
          if (!newestSeenAt || rec.firstSeenAt > newestSeenAt) newestSeenAt = rec.firstSeenAt;
          if (rec.source) sourceSet.add(rec.source);
        } catch {
          // skip
        }
      }
    } catch {
      // fall through
    }
  }
  return { totalRecords, fileBytes, oldestSeenAt, newestSeenAt, distinctSources: sourceSet.size };
}
