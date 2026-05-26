import { describe, it, expect } from "vitest";
import { fetchAisVessels } from "./ais";

/**
 * AIS adapter contract tests.
 *
 * The module-level WebSocket state starts as disconnected with no token.
 * We can test the no-token path without network calls since the adapter
 * short-circuits before attempting a WebSocket connection.
 */
describe("ais adapter — missing-token contract", () => {
  it("returns 'unavailable' with a descriptive note when no token is configured", () => {
    // Fresh import — wsTokenConfigured=false, wsConnected=false
    const feed = fetchAisVessels();

    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.source).toBe("aisstream.io");
    expect(feed.meta.note).toMatch(/AISSTREAM_TOKEN/);
    expect(feed.features).toHaveLength(0);
  });

  it("returns an empty features array with valid ageMinutes", () => {
    const feed = fetchAisVessels();

    expect(Array.isArray(feed.features)).toBe(true);
    expect(typeof feed.meta.ageMinutes).toBe("number");
    expect(feed.meta.ageMinutes).toBeGreaterThanOrEqual(0);
  });
});
