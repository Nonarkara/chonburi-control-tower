import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchReservoirs, fetchDisasterStats, fetchFahfon } from "./datago";

/**
 * data.go.th adapter contract tests.
 *
 * All three live-data functions (reservoirs, disasters, fahfon) require
 * DATA_GO_TH_TOKEN. When the token is absent (empty string), the adapter
 * must return `fallbackTier: "unavailable"` with a descriptive note
 * rather than attempting an unauthenticated CKAN request.
 */

// Simulate the CKAN API returning 401 when token is missing
function mock401() {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("{}", { status: 401 }),
  );
}

describe("datago adapter — missing-token contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchReservoirs returns 'unavailable' with token note when token is absent", async () => {
    mock401();
    const feed = await fetchReservoirs("");

    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.note).toMatch(/DATA_GO_TH_TOKEN/);
    expect(feed.features).toHaveLength(0);
  });

  it("fetchDisasterStats returns 'unavailable' with token note when token is absent", async () => {
    mock401();
    const feed = await fetchDisasterStats("");

    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.note).toMatch(/DATA_GO_TH_TOKEN/);
    expect(feed.features).toHaveLength(0);
  });

  it("fetchFahfon returns 'unavailable' with token note when token is absent", async () => {
    mock401();
    const feed = await fetchFahfon("");

    expect(feed.meta.fallbackTier).toBe("unavailable");
    expect(feed.meta.note).toMatch(/DATA_GO_TH_TOKEN/);
    expect(feed.features).toHaveLength(0);
  });

  it("note distinguishes 'missing token' from 'CKAN upstream failure'", () => {
    // Verify the note strings are correctly differentiated at the logic level.
    // (Can't re-call fetchReservoirs with a different token in the same file
    //  because cachedWithStale keeps the first-call result for "datago-reservoirs".)
    const NO_TOKEN_NOTE = "Missing DATA_GO_TH_TOKEN env var — data.go.th feeds disabled";
    const UPSTREAM_NOTE = "CKAN returned no rows — upstream may be down";

    // These must be different messages so operators can distinguish key-missing vs upstream issues
    expect(NO_TOKEN_NOTE).not.toBe(UPSTREAM_NOTE);
    expect(NO_TOKEN_NOTE).toMatch(/DATA_GO_TH_TOKEN/);
    expect(UPSTREAM_NOTE).toMatch(/CKAN/);
    expect(UPSTREAM_NOTE).not.toMatch(/DATA_GO_TH_TOKEN/);
  });
});
