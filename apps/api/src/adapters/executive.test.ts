import { describe, it, expect } from "vitest";
import { fetchExecutiveSnapshot, deriveAlerts } from "./executive";

/**
 * Executive adapter tests.
 *
 * fetchExecutiveSnapshot: pure synchronous factory — no network calls.
 * deriveAlerts: pure function — no side effects.
 */

describe("fetchExecutiveSnapshot", () => {
  it("returns a valid NormalizedFeed with one ExecutiveSnapshot feature", () => {
    const feed = fetchExecutiveSnapshot();

    expect(feed.meta.source).toBe("chonburi-municipality-compendium");
    expect(feed.meta.fallbackTier).toBe("reference");
    expect(feed.features).toHaveLength(1);

    const snap = feed.features[0];
    expect(snap).toHaveProperty("rankings");
    expect(snap).toHaveProperty("initiatives");
    expect(snap).toHaveProperty("peers");
    expect(snap).toHaveProperty("finance");
    expect(snap).toHaveProperty("research");
    expect(typeof snap.updatedAt).toBe("string");
    // updatedAt is fresh-stamped each call
    expect(() => new Date(snap.updatedAt)).not.toThrow();
  });

  it("stamps updatedAt to approximately now on each call", () => {
    const before = Date.now();
    const { features } = fetchExecutiveSnapshot();
    const after = Date.now();

    const stamp = new Date(features[0].updatedAt).getTime();
    expect(stamp).toBeGreaterThanOrEqual(before);
    expect(stamp).toBeLessThanOrEqual(after);
  });

  it("deep-copies arrays so mutations do not affect the static SNAPSHOT", () => {
    const feed1 = fetchExecutiveSnapshot();
    const feed2 = fetchExecutiveSnapshot();

    // Mutate the first result's rankings array
    feed1.features[0].rankings.push({
      system: "qs-world", label: "INJECTED", rank: 999, total: 0,
      year: 2025, previousRank: 0, trend: "stable",
    });

    // Second call must still return the original length
    expect(feed2.features[0].rankings.length).toBe(
      feed1.features[0].rankings.length - 1,
    );
  });
});

describe("deriveAlerts — AQI thresholds", () => {
  const noNews: Array<{ title: string; score: number; publishedAt: string }> = [];

  it("returns no AQI alert when AQI is null", () => {
    const alerts = deriveAlerts(null, 0, noNews);
    expect(alerts.filter((a) => a.category === "environment")).toHaveLength(0);
  });

  it("returns no AQI alert when AQI is at or below 150", () => {
    expect(deriveAlerts(150, 0, noNews).filter((a) => a.category === "environment")).toHaveLength(0);
    expect(deriveAlerts(100, 0, noNews).filter((a) => a.category === "environment")).toHaveLength(0);
  });

  it("returns a warning-level AQI alert when AQI is 151–200", () => {
    const alerts = deriveAlerts(175, 0, noNews);
    const aqAlert = alerts.find((a) => a.category === "environment");
    expect(aqAlert).toBeDefined();
    expect(aqAlert!.level).toBe("warning");
    expect(aqAlert!.message).toContain("175");
  });

  it("escalates to critical level when AQI exceeds 200", () => {
    const alerts = deriveAlerts(201, 0, noNews);
    const aqAlert = alerts.find((a) => a.category === "environment");
    expect(aqAlert!.level).toBe("critical");
  });
});

describe("deriveAlerts — incident thresholds", () => {
  const noNews: Array<{ title: string; score: number; publishedAt: string }> = [];

  it("returns no incident alert when open incidents < 5", () => {
    expect(deriveAlerts(null, 4, noNews).filter((a) => a.category === "safety")).toHaveLength(0);
    expect(deriveAlerts(null, 0, noNews).filter((a) => a.category === "safety")).toHaveLength(0);
  });

  it("returns a watch-level incident alert at threshold 5–9", () => {
    const alerts = deriveAlerts(null, 5, noNews);
    const inc = alerts.find((a) => a.category === "safety");
    expect(inc).toBeDefined();
    expect(inc!.level).toBe("watch");
    expect(inc!.actionRequired).toBeUndefined();
  });

  it("escalates to warning + actionRequired when incidents ≥ 10", () => {
    const alerts = deriveAlerts(null, 10, noNews);
    const inc = alerts.find((a) => a.category === "safety");
    expect(inc!.level).toBe("warning");
    expect(inc!.actionRequired).toBeTruthy();
  });
});

describe("deriveAlerts — reputation news spike", () => {
  const now = new Date().toISOString();
  const highScore = (title: string) => ({ title, score: 600, publishedAt: now });

  it("returns no reputation alert when no high-score negative news", () => {
    const alerts = deriveAlerts(null, 0, [highScore("Chonburi festival")]);
    expect(alerts.filter((a) => a.category === "reputation")).toHaveLength(0);
  });

  it("returns a watch-level alert for 1–2 negative news items", () => {
    const alerts = deriveAlerts(null, 0, [highScore("Protest erupts in Chonburi")]);
    const rep = alerts.find((a) => a.category === "reputation");
    expect(rep).toBeDefined();
    expect(rep!.level).toBe("watch");
    expect(rep!.actionRequired).toBeUndefined();
  });

  it("escalates to warning + actionRequired for 3+ negative news items", () => {
    const items = [
      highScore("Flood hits Chonburi market"),
      highScore("Fire destroys warehouse"),
      highScore("Accident kills two"),
    ];
    const alerts = deriveAlerts(null, 0, items);
    const rep = alerts.find((a) => a.category === "reputation");
    expect(rep!.level).toBe("warning");
    expect(rep!.actionRequired).toMatch(/comms/i);
  });

  it("ignores news with score below 500", () => {
    const alerts = deriveAlerts(null, 0, [{ title: "Flood in Chonburi", score: 499, publishedAt: now }]);
    expect(alerts.filter((a) => a.category === "reputation")).toHaveLength(0);
  });

  it("returns all three alert categories simultaneously when all thresholds are met", () => {
    const alerts = deriveAlerts(
      220,   // AQI → critical environment
      12,    // incidents → warning safety
      [highScore("Scandal rocks Chonburi"), highScore("Protest"), highScore("Flood kills")],
    );
    const cats = alerts.map((a) => a.category);
    expect(cats).toContain("environment");
    expect(cats).toContain("safety");
    expect(cats).toContain("reputation");
  });
});
