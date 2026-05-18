/**
 * Live-data snippet for the chat system prompt — pulled fresh every
 * request (cached 60 s) so the model can answer "how many stories about
 * Chula today?" or "what's the current PM2.5?" without tool-calling.
 *
 * Best-effort: each section fails silently if its upstream is down, and
 * the snippet degrades gracefully.
 */

import { fetchAirQualityTrend } from "./airQuality.js";
import { fetchCityReports } from "./cityReporter.js";
import { fetchItic } from "./itic.js";
import { fetchWeather } from "./weather.js";
import { fetchPrecipNowcast } from "./precipNowcast.js";
import { fetchAcademicSnapshot } from "./academicCalendar.js";

async function tryNewsArchive() {
  if (typeof process === "undefined" || !process.versions?.node) return null;
  try {
    const { digestNewsArchive, newsArchiveStats } = await import("../lib/newsArchive.js");
    const [digest, stats] = await Promise.all([digestNewsArchive("24h"), newsArchiveStats()]);
    return { digest, stats };
  } catch {
    return null;
  }
}

let cached: { at: number; snippet: string } | null = null;
const TTL_MS = 60_000;

export async function liveContextSnippet(): Promise<string> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.snippet;

  const now = new Date().toISOString();
  const lines: string[] = [`## Live data snapshot (as of ${now})`];

  const [aq, cr, itic, wx, precip, academic, archive] = await Promise.allSettled([
    fetchAirQualityTrend(),
    fetchCityReports(),
    fetchItic(),
    fetchWeather(),
    fetchPrecipNowcast(),
    fetchAcademicSnapshot(),
    tryNewsArchive(),
  ]);

  if (aq.status === "fulfilled" && aq.value.features.length > 0) {
    const s = aq.value.features[0];
    lines.push(`- **Air quality**: AQI ${s.current?.aqi ?? "—"}, PM2.5 ${s.current?.pm25 ?? "—"} µg/m³ at ${s.station ?? "Bangkok"}; category ${s.category ?? "—"}.`);
  }

  if (wx.status === "fulfilled" && wx.value.features.length > 0) {
    const w = wx.value.features[0];
    lines.push(`- **Weather**: ${w.tempC ?? "—"}°C (feels ${w.feelsLikeC ?? "—"}°C), ${w.condition}, humidity ${w.humidity ?? "—"}%, wind ${w.windKmh ?? "—"} km/h.`);
  }

  if (precip.status === "fulfilled" && precip.value.features.length > 0) {
    const p = precip.value.features[0];
    if (p.intensity === "dry") {
      lines.push(`- **Rain nowcast**: dry for the next 2 h (${p.total2hMm.toFixed(1)} mm forecast).`);
    } else {
      const when = p.minutesToSignificant != null ? `in ${p.minutesToSignificant} min` : "now";
      lines.push(`- **Rain nowcast**: ${p.intensity} rain ${when}, peak ${p.peakMm} mm, ${p.total2hMm.toFixed(1)} mm total over the next 2 h.`);
    }
  }

  if (cr.status === "fulfilled") {
    const open = cr.value.features.filter((f) => f.status !== "resolved").length;
    lines.push(`- **Citizen reports (Traffy Fondue)**: ${cr.value.features.length} near campus, ${open} still open.`);
  }

  if (itic.status === "fulfilled") {
    lines.push(`- **iTIC traffic events**: ${itic.value.features.length} active in the Bangkok bbox.`);
  }

  if (academic.status === "fulfilled" && academic.value.features.length > 0) {
    const a = academic.value.features[0];
    if (a.current) {
      lines.push(`- **Academic calendar**: currently ${a.current.label} (tempo ${a.tempo}). ${a.current.describe}`);
      if (a.next && a.daysToNext != null) {
        lines.push(`  Next: ${a.next.label} in ${a.daysToNext} days.`);
      }
    }
  }

  if (archive.status === "fulfilled" && archive.value) {
    const { digest, stats } = archive.value;
    lines.push(`- **News archive**: ${stats.totalRecords} total stories archived since ${stats.oldestSeenAt ? stats.oldestSeenAt.slice(0, 10) : "—"}; ${digest.totalInWindow} new in the last 24 h.`);
    if (digest.bySource.length > 0) {
      const top = digest.bySource.slice(0, 4).map((s) => `${s.source} (${s.count})`).join(", ");
      lines.push(`  Top sources 24 h: ${top}.`);
    }
    if (digest.topHeadlines.length > 0) {
      lines.push(`  Recent headlines:`);
      for (const h of digest.topHeadlines.slice(0, 5)) {
        lines.push(`    • ${h.title.slice(0, 140)} — ${h.source}`);
      }
    }
  }

  const snippet = lines.join("\n");
  cached = { at: Date.now(), snippet };
  return snippet;
}
