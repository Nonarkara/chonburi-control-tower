/**
 * Facebook adapter — Mueang Chonburi municipal page.
 *
 * Meta's anti-scraping makes free Facebook page polling unreliable:
 *   - facebook.com/<page>/feed → 404 (deprecated)
 *   - RSSHub public instance → 403 (rate-limited / blocked)
 *   - Direct Graph API → requires app review + page admin token
 *
 * Strategy:
 *   1. If FACEBOOK_PAGE_TOKEN is set in env, use Graph API /posts (live)
 *   2. Otherwise return an empty feed with status "unavailable" — the
 *      web UI falls back to the embedded Meta page-plugin iframe which
 *      works without any credentials.
 *
 * Set up steps for live mode (one-time):
 *   1. developer.facebook.com → create App → add Facebook Login
 *   2. Page admin generates Page Access Token (long-lived)
 *   3. Set FACEBOOK_PAGE_ID=<numeric id> + FACEBOOK_PAGE_TOKEN=<token>
 */

import type { NormalizedFeed } from "@chonburi/shared";
import { cacheAgeMinutes, cachedWithStale as cached } from "../lib/cache.js";
import { fetchJsonOrNull } from "./common.js";

export interface FacebookPost {
  id: string;
  message: string;
  permalink: string;
  createdAt: string;
  image?: string;
  reactions?: number;
  comments?: number;
  shares?: number;
}

const TTL_SECONDS = 600; // 10 min

interface GraphResponse {
  data?: Array<{
    id: string;
    message?: string;
    story?: string;
    created_time?: string;
    permalink_url?: string;
    full_picture?: string;
    reactions?: { summary?: { total_count?: number } };
    comments?: { summary?: { total_count?: number } };
    shares?: { count?: number };
  }>;
  error?: { message?: string; code?: number };
}

export async function fetchFacebookPosts(env: {
  FACEBOOK_PAGE_ID?: string;
  FACEBOOK_PAGE_TOKEN?: string;
}): Promise<NormalizedFeed<FacebookPost>> {
  return cached("facebook-posts", TTL_SECONDS, async () => {
    const fetchedAt = new Date().toISOString();

    if (!env.FACEBOOK_PAGE_ID || !env.FACEBOOK_PAGE_TOKEN) {
      const missing = [
        !env.FACEBOOK_PAGE_ID ? "FACEBOOK_PAGE_ID" : null,
        !env.FACEBOOK_PAGE_TOKEN ? "FACEBOOK_PAGE_TOKEN" : null,
      ].filter(Boolean).join(" + ");
      return {
        features: [] as FacebookPost[],
        meta: {
          source: "facebook-page",
          fetchedAt,
          ageMinutes: 0,
          fallbackTier: "unavailable" as const,
          note: `Missing ${missing} env var${missing.includes("+") ? "s" : ""} — Facebook feed disabled`,
        },
      };
    }

    const fields = "id,message,story,created_time,permalink_url,full_picture,reactions.summary(true),comments.summary(true),shares";
    const url = `https://graph.facebook.com/v22.0/${env.FACEBOOK_PAGE_ID}/posts?fields=${encodeURIComponent(fields)}&limit=20&access_token=${env.FACEBOOK_PAGE_TOKEN}`;
    const payload = await fetchJsonOrNull<GraphResponse>(url);

    const posts: FacebookPost[] = (payload?.data ?? []).map((p) => ({
      id: p.id,
      message: (p.message ?? p.story ?? "").trim(),
      permalink: p.permalink_url ?? `https://facebook.com/${p.id}`,
      createdAt: p.created_time ?? fetchedAt,
      image: p.full_picture,
      reactions: p.reactions?.summary?.total_count,
      comments: p.comments?.summary?.total_count,
      shares: p.shares?.count,
    })).filter((p) => p.message.length > 0);

    return {
      features: posts,
      meta: {
        source: "facebook-graph",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: posts.length > 0 ? "live" : "unavailable",
        ...(posts.length === 0 ? { note: "Graph API returned no posts — token may have expired" } : {}),
      },
    };
  });
}
