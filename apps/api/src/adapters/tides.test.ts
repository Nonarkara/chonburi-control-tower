import { describe, it, expect } from "vitest";
import { fetchTides } from "./tides";

/**
 * Tides adapter contract tests.
 *
 * Pure harmonic computation — no HTTP calls, no API keys.
 * The adapter is deterministic given wall-clock time, so tests assert
 * structural invariants rather than specific values.
 */
describe("tides adapter — harmonic prediction", () => {
  it("always returns exactly one snapshot with 'reference' tier", async () => {
    const feed = await fetchTides();

    expect(feed.meta.fallbackTier).toBe("reference");
    expect(feed.meta.source).toMatch(/tide|harmonic/i);
    expect(feed.features).toHaveLength(1);
  });

  it("snapshot has physically plausible tide height for Gulf of Thailand", async () => {
    const feed = await fetchTides();
    const snap = feed.features[0];

    // Gulf of Thailand: MSL ~0.85 m above chart datum, range ±0.60 m from constituents
    // So valid height is in [0.1, 1.7] m in normal conditions.
    expect(snap.heightM).toBeGreaterThan(0);
    expect(snap.heightM).toBeLessThan(2.5);
    expect(typeof snap.rising).toBe("boolean");
  });

  it("provides well-formed prev12h and next24h arrays", async () => {
    const feed = await fetchTides();
    const snap = feed.features[0];

    // 10-min intervals: 12h × 6 = 72 prev points; 24h × 6 = 144 next points
    expect(snap.prev12h.length).toBeGreaterThanOrEqual(72);
    expect(snap.next24h.length).toBeGreaterThanOrEqual(144);

    // Every point must have a valid timestamp and numeric height
    for (const pt of [...snap.prev12h, ...snap.next24h]) {
      expect(typeof pt.at).toBe("string");
      expect(new Date(pt.at).getTime()).toBeGreaterThan(0);
      expect(typeof pt.heightM).toBe("number");
      expect(pt.heightM).toBeGreaterThan(0);
      expect(pt.heightM).toBeLessThan(3);
    }
  });

  it("tide curve oscillates — has distinct high and low values in the next 24 h", async () => {
    const feed = await fetchTides();
    const snap = feed.features[0];

    const heights = snap.next24h.map((p) => p.heightM);
    const min = Math.min(...heights);
    const max = Math.max(...heights);

    // Gulf of Thailand tidal range is typically 0.3–1.5 m.
    // At minimum we expect meaningful oscillation in the 24-hour forecast.
    expect(max - min).toBeGreaterThan(0.1);

    // If extremes are found (may be null if algorithm steps miss shallow-water oscillations),
    // validate their structure when present.
    if (snap.nextHigh) {
      expect(snap.nextHigh.hoursFromNow).toBeGreaterThan(0);
      expect(snap.nextHigh.heightM).toBeGreaterThan(0);
    }
    if (snap.nextLow) {
      expect(snap.nextLow.hoursFromNow).toBeGreaterThan(0);
      expect(snap.nextLow.heightM).toBeGreaterThan(0);
    }
    // At least one extreme must be found (either high or low, or both)
    expect(snap.nextHigh !== null || snap.nextLow !== null).toBe(true);
  });

  it("moon phase is in [0, 1] and has a non-empty name", async () => {
    const feed = await fetchTides();
    const snap = feed.features[0];

    expect(snap.moonPhase).toBeGreaterThanOrEqual(0);
    expect(snap.moonPhase).toBeLessThanOrEqual(1);
    expect(snap.moonPhaseName.length).toBeGreaterThan(0);
  });

  it("springNeap label is one of the four valid values", async () => {
    const feed = await fetchTides();
    const snap = feed.features[0];

    expect(["spring", "neap", "rising", "falling"]).toContain(snap.springNeap);
  });

  it("chartDatumNote is a non-empty string", async () => {
    const feed = await fetchTides();
    expect(typeof feed.features[0].chartDatumNote).toBe("string");
    expect(feed.features[0].chartDatumNote.length).toBeGreaterThan(0);
  });

  it("springTide is a boolean", async () => {
    const feed = await fetchTides();
    expect(typeof feed.features[0].springTide).toBe("boolean");
  });

  it("observedAt is a valid ISO timestamp string within 10 seconds of now", async () => {
    const before = Date.now();
    const feed = await fetchTides();
    const after = Date.now();
    const observedMs = new Date(feed.features[0].observedAt).getTime();
    expect(observedMs).toBeGreaterThanOrEqual(before - 1000);
    expect(observedMs).toBeLessThanOrEqual(after + 1000);
  });

  it("prev12h and next24h timestamps are in ascending order", async () => {
    const feed = await fetchTides();
    const snap = feed.features[0];

    const prevMs = snap.prev12h.map((p) => new Date(p.at).getTime());
    for (let i = 1; i < prevMs.length; i++) {
      expect(prevMs[i]).toBeGreaterThan(prevMs[i - 1]);
    }

    const nextMs = snap.next24h.map((p) => new Date(p.at).getTime());
    for (let i = 1; i < nextMs.length; i++) {
      expect(nextMs[i]).toBeGreaterThan(nextMs[i - 1]);
    }
  });
});
