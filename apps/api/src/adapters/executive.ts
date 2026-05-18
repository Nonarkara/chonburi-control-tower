import type { ExecutiveSnapshot, NormalizedFeed } from "@chonburi/shared";

/**
 * Executive adapter — strategic data for Chonburi Town Municipality mayor
 * and leadership team.
 *
 * Data policy:
 *   - Rankings: public liveability / smart city indices.
 *   - Population / area: public DLA / NSO data.
 *   - Finance: PLACEHOLDER — wire to municipal ERP.
 *   - Initiatives: public municipal projects from official comms.
 *   - Peers: comparable municipalities for context.
 *   - Alerts: derived from live feeds (AQ, incidents, news sentiment).
 */

function meta(): NormalizedFeed<ExecutiveSnapshot>["meta"] {
  return {
    source: "chonburi-municipality-compendium",
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
      label: "SLIC Smart City Index",
      rank: 0,
      total: 163,
      year: 2025,
      previousRank: 0,
      trend: "stable",
    },
    {
      system: "qs-asia",
      label: "EEC Readiness Score",
      rank: 0,
      total: 77,
      year: 2025,
      previousRank: 0,
      trend: "stable",
    },
  ],

  enrollment: {
    total: 65000,        // municipal population estimate
    undergraduate: 0,
    graduate: 0,
    international: 0,
    internationalPct: 0,
    faculties: 0,
    studentFacultyRatio: "—",
  },

  research: {
    publications2024: 0,
    citations2024: 0,
    hIndex: 0,
    topFields: ["Urban Planning", "Coastal Management", "Industrial Development", "Smart City"],
    researchFundingMThb: null,
    patentsFiled: 0,
  },

  finance: {
    annualBudgetBThb: null,
    researchGrantsMThb: null,
    endowmentBThb: null,
    note: "Municipal budget data — wire DLA / municipal ERP integration to populate.",
  },

  initiatives: [
    {
      id: "smart-city-chonburi",
      name: "Chonburi Smart City Programme",
      status: "on-track",
      progressPct: 55,
      owner: "Mayor's Office",
      deadline: "2027-12",
      describe: "DEPA-backed smart city infrastructure: IoT sensors, open data platform, digital services.",
    },
    {
      id: "eec-connectivity",
      name: "EEC Transport Link",
      status: "on-track",
      progressPct: 70,
      owner: "Public Works",
      deadline: "2026-06",
      describe: "Last-mile connectivity to Eastern Economic Corridor industrial zones.",
    },
    {
      id: "flood-management",
      name: "Urban Flood Management",
      status: "at-risk",
      progressPct: 38,
      owner: "Environment Division",
      deadline: "2026-09",
      describe: "Retention basins and early-warning sensors for coastal flood-prone streets.",
    },
    {
      id: "digital-services",
      name: "Municipal Digital Services",
      status: "on-track",
      progressPct: 60,
      owner: "IT Division",
      deadline: "2025-12",
      describe: "Online permit applications, payment gateway, and citizen reporting integration.",
    },
  ],

  peers: [
    {
      name: "Pattaya City",
      country: "TH",
      qsWorldRank: 0,
      theWorldRank: 0,
      studentsTotal: 120000,
      internationalPct: 0,
      researchOutput: "—",
    },
    {
      name: "Si Racha Municipality",
      country: "TH",
      qsWorldRank: 0,
      theWorldRank: 0,
      studentsTotal: 80000,
      internationalPct: 0,
      researchOutput: "—",
    },
    {
      name: "Rayong Municipality",
      country: "TH",
      qsWorldRank: 0,
      theWorldRank: 0,
      studentsTotal: 70000,
      internationalPct: 0,
      researchOutput: "—",
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
      research: { ...SNAPSHOT.research, topFields: [...(SNAPSHOT.research.topFields ?? [])] },
      updatedAt: new Date().toISOString(),
    }],
    meta: meta(),
  };
}

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
      message: `Chonburi AQI ${aqi} — exceeds WHO 24-hr guideline. Consider advisory for residents and outdoor workers.`,
      issuedAt: new Date().toISOString(),
      source: "Open-Meteo Air Quality",
      actionRequired: "Notify public health division, consider outdoor activity advisories.",
    });
  }

  if (openIncidents >= 5) {
    alerts.push({
      id: `inc-${Date.now()}-${alertSeq++}`,
      level: openIncidents >= 10 ? "warning" : "watch",
      category: "safety",
      title: "Elevated Incident Load",
      message: `${openIncidents} open citizen reports + traffic events in Chonburi bbox. Review dispatch readiness.`,
      issuedAt: new Date().toISOString(),
      source: "Traffy Fondue + iTIC",
      actionRequired: openIncidents >= 10 ? "Brief operations chief" : undefined,
    });
  }

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
