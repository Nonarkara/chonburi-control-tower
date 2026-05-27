import { describe, it, expect } from "vitest";
import { fetchPortOps } from "./portOps";

/**
 * Port operations adapter tests — verifies the stub shape and metadata
 * contract. These tests prevent silent breaks when the adapter is
 * eventually replaced with a live PAT / AIS feed.
 */

describe("portOps adapter (stub)", () => {
  it("returns a NormalizedFeed with scenario fallback tier", async () => {
    const feed = await fetchPortOps();
    expect(feed.meta.source).toBe("port-ops-stub");
    expect(feed.meta.fallbackTier).toBe("scenario");
    expect(feed.meta.fetchedAt).toBeTruthy();
  });

  it("returns at least one port entry", async () => {
    const feed = await fetchPortOps();
    expect(feed.features.length).toBeGreaterThanOrEqual(1);
  });

  it("includes Laem Chabang port with correct UN/LOCODE", async () => {
    const feed = await fetchPortOps();
    const laemChabang = feed.features.find((p) => p.portId === "THLCH");
    expect(laemChabang).toBeDefined();
    expect(laemChabang!.portName).toMatch(/Laem Chabang/i);
    expect(laemChabang!.lat).toBeGreaterThan(12);
    expect(laemChabang!.lng).toBeGreaterThan(100);
  });

  it("every port entry has the required PortOpsSnapshot shape", async () => {
    const feed = await fetchPortOps();
    for (const port of feed.features) {
      expect(port).toHaveProperty("portId");
      expect(port).toHaveProperty("portName");
      expect(port).toHaveProperty("portNameTh");
      expect(port).toHaveProperty("lat");
      expect(port).toHaveProperty("lng");
      expect(port).toHaveProperty("observedAt");
      expect(port).toHaveProperty("operationalStatus");
    }
  });

  it("vessel counts are null until AIS/PAT feed is wired", async () => {
    const feed = await fetchPortOps();
    for (const port of feed.features) {
      // These are intentionally null until external data partnerships land.
      // If they stop being null, this test alerts us to update the documentation.
      expect(port.vesselsBerthed).toBeNull();
      expect(port.berthUtilisationPct).toBeNull();
      expect(port.teuTodayEstimate).toBeNull();
    }
  });
});
