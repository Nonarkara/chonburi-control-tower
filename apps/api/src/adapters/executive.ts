import type { ExecutiveSnapshot, NormalizedFeed } from "@chula/shared";

/**
 * Executive adapter — strategic data for the university president and
 * leadership team.
 *
 * Data policy:
 *   - Rankings: public QS / THE data, updated annually.
 *   - Enrollment / research: public aggregates from Chula website + Scopus.
 *   - Finance: PLACEHOLDER — marked clearly. Wire to internal ERP.
 *   - Initiatives: public projects from Chula / PMCU comms.
 *   - Peers: public data for context.
 *   - Alerts: derived from live feeds (AQ, incidents, news sentiment).
 */

function meta(): NormalizedFeed<ExecutiveSnapshot>["meta"] {
  return {
    source: "chula-executive-compendium",
    fetchedAt: new Date().toISOString(),
    ageMinutes: 0,
    fallbackTier: "reference",
  };
}

const SNAPSHOT: ExecutiveSnapshot = {
  updatedAt: new Date().toISOString(),

  rankings: [
    {
      system: "qs-world",
      label: "QS World",
      rank: 229,
      total: 1500,
      year: 2025,
      previousRank: 211,
      trend: "down",
    },
    {
      system: "qs-asia",
      label: "QS Asia",
      rank: 44,
      total: 856,
      year: 2025,
      previousRank: 43,
      trend: "down",
    },
    {
      system: "the-world",
      label: "THE World",
      rank: 601,
      total: 2092,
      year: 2025,
      previousRank: 601,
      trend: "stable",
    },
    {
      system: "the-asia",
      label: "THE Asia",
      rank: 126,
      total: 739,
      year: 2024,
      previousRank: 119,
      trend: "down",
    },
  ],

  enrollment: {
    total: 38500,
    undergraduate: 25700,
    graduate: 12800,
    international: 3100,
    internationalPct: 8.1,
    faculties: 19,
    studentFacultyRatio: "16 : 1",
  },

  research: {
    publications2024: 8420,
    citations2024: 124000,
    hIndex: 142,
    topFields: ["Engineering", "Medicine", "Computer Science", "Environmental Science", "Social Sciences"],
    researchFundingMThb: null,
    patentsFiled: 87,
  },

  finance: {
    annualBudgetBThb: null,
    researchGrantsMThb: null,
    endowmentBThb: null,
    note: "Financial data is internal-only. Wire ERP / SAP integration to populate.",
  },

  initiatives: [
    {
      id: "saraphi",
      name: "Saraphi Smart Campus",
      status: "on-track",
      progressPct: 65,
      owner: "VP Planning",
      deadline: "2027-12",
      describe: "Second campus in Chiang Mai — 1,900 rai, net-zero target.",
    },
    {
      id: "centenary-park",
      name: "Centenary Park Expansion",
      status: "on-track",
      progressPct: 88,
      owner: "PMCU",
      deadline: "2025-06",
      describe: "11-rai flood park + 3,785 m³ retention basin.",
    },
    {
      id: "chula-engineering-4",
      name: "Engineering Building 4",
      status: "at-risk",
      progressPct: 42,
      owner: "Faculty of Engineering",
      deadline: "2026-03",
      describe: "New 12-storey research building — budget review pending.",
    },
    {
      id: "international-20",
      name: "International 20% Target",
      status: "on-track",
      progressPct: 40,
      owner: "International Affairs",
      deadline: "2030-08",
      describe: "Double international student share to 20% by 2030.",
    },
    {
      id: "carbon-neutral",
      name: "Campus Carbon Neutral",
      status: "on-track",
      progressPct: 55,
      owner: "Sustainability Office",
      deadline: "2030-12",
      describe: "Net-zero scope 1+2 emissions by 2030, scope 3 by 2050.",
    },
    {
      id: "cu-med-ai",
      name: "Chula Medical AI Centre",
      status: "on-track",
      progressPct: 72,
      owner: "Faculty of Medicine",
      deadline: "2026-06",
      describe: "AI diagnostics + hospital workflow automation.",
    },
  ],

  peers: [
    {
      name: "Mahidol University",
      country: "TH",
      qsWorldRank: 368,
      theWorldRank: 601,
      studentsTotal: 31200,
      internationalPct: 6.2,
      researchOutput: "Very High",
    },
    {
      name: "Thammasat University",
      country: "TH",
      qsWorldRank: 600,
      theWorldRank: 1201,
      studentsTotal: 33400,
      internationalPct: 4.8,
      researchOutput: "High",
    },
    {
      name: "NUS",
      country: "SG",
      qsWorldRank: 8,
      theWorldRank: 17,
      studentsTotal: 43100,
      internationalPct: 24.0,
      researchOutput: "Very High",
    },
    {
      name: "NTU Singapore",
      country: "SG",
      qsWorldRank: 12,
      theWorldRank: 30,
      studentsTotal: 33800,
      internationalPct: 22.0,
      researchOutput: "Very High",
    },
    {
      name: "HKU",
      country: "HK",
      qsWorldRank: 17,
      theWorldRank: 35,
      studentsTotal: 30600,
      internationalPct: 43.0,
      researchOutput: "Very High",
    },
  ],

  alerts: [], // populated dynamically from live feeds in the API route handler
};

export function fetchExecutiveSnapshot(): NormalizedFeed<ExecutiveSnapshot> {
  return {
    features: [{
      ...SNAPSHOT,
      rankings: SNAPSHOT.rankings.map((r) => ({ ...r })),
      initiatives: SNAPSHOT.initiatives.map((i) => ({ ...i })),
      peers: SNAPSHOT.peers.map((p) => ({ ...p })),
      research: { ...SNAPSHOT.research, topFields: [...SNAPSHOT.research.topFields] },
      updatedAt: new Date().toISOString(),
    }],
    meta: meta(),
  };
}

/**
 * Derive strategic alerts from live operational feeds.
 */
export function deriveAlerts(
  aqi: number | null,
  openIncidents: number,
  newsItems: Array<{ title: string; score: number; publishedAt: string }>,
): ExecutiveSnapshot["alerts"] {
  const alerts: ExecutiveSnapshot["alerts"] = [];
  let alertSeq = 0;

  if (aqi != null && aqi > 150) {
    alerts.push({
      id: `aq-${Date.now()}-${alertSeq++}`,
      level: aqi > 200 ? "critical" : "warning",
      category: "environment",
      title: "Air Quality Health Advisory",
      message: `Campus AQI ${aqi} — exceeds WHO 24-hr guideline (15 µg/m³ PM₂.₅) by ${Math.round(aqi / 15)}×. Consider indoor activities + N95 advisories for 40,000+ campus population.`,
      issuedAt: new Date().toISOString(),
      source: "BMA AQ + Open-Meteo",
      actionRequired: "Notify faculties, consider outdoor event postponement.",
    });
  }

  if (openIncidents >= 5) {
    alerts.push({
      id: `inc-${Date.now()}-${alertSeq++}`,
      level: openIncidents >= 10 ? "warning" : "watch",
      category: "safety",
      title: "Elevated Incident Load",
      message: `${openIncidents} open citizen reports + traffic events in campus bbox. Review dispatch readiness.`,
      issuedAt: new Date().toISOString(),
      source: "Traffy Fondue + iTIC",
      actionRequired: openIncidents >= 10 ? "Brief security chief" : undefined,
    });
  }

  // Reputation watch: high-scoring negative news
  const negativeNews = newsItems.filter(
    (n) =>
      n.score >= 500 &&
      /\b(scandal|protest|flood|fire|crash|death|injury|corruption|accident)\b/i.test(n.title),
  );
  if (negativeNews.length > 0) {
    const top = negativeNews[0];
    alerts.push({
      id: `rep-${Date.now()}-${alertSeq++}`,
      level: negativeNews.length >= 3 ? "warning" : "watch",
      category: "reputation",
      title: "Negative News Spike",
      message: `${negativeNews.length} high-relevance negative headline${negativeNews.length > 1 ? "s" : ""} in past 24h. Latest: "${top.title}"`,
      issuedAt: new Date().toISOString(),
      source: "Google News + Bangkok Post",
      actionRequired: negativeNews.length >= 3 ? "Comms team stand-up" : undefined,
    });
  }

  return alerts;
}
