import { describe, it, expect, beforeEach } from "vitest";
import {
  getAdapterHealth,
  recordAdapterSuccess,
  recordAdapterError,
  recordAdapterStale,
  getAllHealth,
  getSystemStatus,
  isCircuitOpen,
} from "./health";

// The health module uses a module-level Map. Each test gets a unique name so
// runs are independent without needing a reset hook.
function nextName(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

describe("health: getAdapterHealth", () => {
  it("returns 'unknown' status for an unseen adapter", () => {
    const h = getAdapterHealth(nextName("never-seen"));
    expect(h.status).toBe("unknown");
    expect(h.consecutiveFailures).toBe(0);
    expect(h.totalCalls).toBe(0);
    expect(h.lastSuccessAt).toBeNull();
    expect(h.lastErrorAt).toBeNull();
  });
});

describe("health: recordAdapterSuccess", () => {
  it("marks adapter healthy and resets failures", () => {
    const name = nextName("success");
    recordAdapterError(name, "first failure");
    recordAdapterError(name, "second failure");
    recordAdapterSuccess(name, 0);
    const h = getAdapterHealth(name);
    expect(h.status).toBe("healthy");
    expect(h.consecutiveFailures).toBe(0);
    expect(h.lastSuccessAt).not.toBeNull();
  });

  it("records age in minutes when provided", () => {
    const name = nextName("age");
    recordAdapterSuccess(name, 5);
    expect(getAdapterHealth(name).ageMinutes).toBe(5);
  });
});

describe("health: recordAdapterError → circuit breaker", () => {
  it("stays healthy after 1 or 2 failures (below DEGRADED_THRESHOLD)", () => {
    const name = nextName("two-fails");
    recordAdapterSuccess(name, 0);
    recordAdapterError(name, "blip 1");
    recordAdapterError(name, "blip 2");
    expect(getAdapterHealth(name).status).toBe("healthy");
  });

  it("becomes degraded after 3 consecutive failures", () => {
    const name = nextName("degraded");
    recordAdapterError(name, "f1");
    recordAdapterError(name, "f2");
    recordAdapterError(name, "f3");
    expect(getAdapterHealth(name).status).toBe("degraded");
    expect(getAdapterHealth(name).consecutiveFailures).toBe(3);
  });

  it("becomes down after 5 consecutive failures", () => {
    const name = nextName("down");
    for (let i = 0; i < 5; i++) recordAdapterError(name, `f${i}`);
    expect(getAdapterHealth(name).status).toBe("down");
    expect(getAdapterHealth(name).consecutiveFailures).toBe(5);
  });

  it("preserves the last error message", () => {
    const name = nextName("err-msg");
    recordAdapterError(name, "Missing API_KEY env var — adapter disabled");
    expect(getAdapterHealth(name).lastErrorMessage).toMatch(/Missing API_KEY/);
  });

  it("a success after going down resets to healthy", () => {
    const name = nextName("recovery");
    for (let i = 0; i < 5; i++) recordAdapterError(name, "boom");
    expect(getAdapterHealth(name).status).toBe("down");
    recordAdapterSuccess(name, 0);
    expect(getAdapterHealth(name).status).toBe("healthy");
    expect(getAdapterHealth(name).consecutiveFailures).toBe(0);
  });

  it("remains degraded at exactly 4 consecutive failures (between thresholds)", () => {
    const name = nextName("four-fails");
    for (let i = 0; i < 4; i++) recordAdapterError(name, `f${i}`);
    const h = getAdapterHealth(name);
    expect(h.status).toBe("degraded");
    expect(h.consecutiveFailures).toBe(4);
  });

  it("stays down when failures continue accumulating beyond DOWN_THRESHOLD", () => {
    const name = nextName("stays-down");
    for (let i = 0; i < 7; i++) recordAdapterError(name, `f${i}`);
    const h = getAdapterHealth(name);
    expect(h.status).toBe("down");
    expect(h.consecutiveFailures).toBe(7);
  });

  it("stale adapter stays degraded even after a single additional error (stale branch)", () => {
    // Arrange: healthy adapter that goes stale → degraded
    const name = nextName("stale-err");
    recordAdapterSuccess(name, 0);
    recordAdapterStale(name, 45); // ageMinutes=45 > STALE_MINUTES=30
    expect(getAdapterHealth(name).status).toBe("degraded");

    // Act: 1 error (consecutiveFailures=1, below DEGRADED_THRESHOLD=3)
    // Without the stale branch, this would flip back to "healthy"
    recordAdapterError(name, "minor blip");

    // Assert: stale flag keeps it degraded
    expect(getAdapterHealth(name).status).toBe("degraded");
    expect(getAdapterHealth(name).consecutiveFailures).toBe(1);
  });
});

describe("health: recordAdapterStale", () => {
  it("downgrades healthy → degraded when data ages past 30 min", () => {
    const name = nextName("stale");
    recordAdapterSuccess(name, 0);
    recordAdapterStale(name, 45);
    expect(getAdapterHealth(name).status).toBe("degraded");
  });

  it("does NOT alter status when data is fresh", () => {
    const name = nextName("fresh");
    recordAdapterSuccess(name, 0);
    recordAdapterStale(name, 5);
    expect(getAdapterHealth(name).status).toBe("healthy");
  });
});

describe("health: totalCalls + totalErrors counters", () => {
  it("increments totalCalls and totalErrors on each error", () => {
    const name = nextName("counters");
    recordAdapterError(name, "e1");
    recordAdapterError(name, "e2");
    const h = getAdapterHealth(name);
    expect(h.totalCalls).toBe(2);
    expect(h.totalErrors).toBe(2);
  });

  it("increments totalCalls but not totalErrors on success", () => {
    const name = nextName("success-counter");
    recordAdapterError(name, "e1");
    recordAdapterSuccess(name, 0);
    const h = getAdapterHealth(name);
    expect(h.totalCalls).toBe(2);
    expect(h.totalErrors).toBe(1);
  });

  it("sets lastErrorAt on each error and lastSuccessAt on success", () => {
    const name = nextName("timestamps");
    recordAdapterError(name, "boom");
    expect(getAdapterHealth(name).lastErrorAt).not.toBeNull();
    expect(getAdapterHealth(name).lastSuccessAt).toBeNull();
    recordAdapterSuccess(name, 0);
    expect(getAdapterHealth(name).lastSuccessAt).not.toBeNull();
  });
});

describe("health: getSystemStatus + isCircuitOpen", () => {
  it("getSystemStatus computes counts across all adapters", () => {
    // Seed at least one of each so the snapshot has expected shape
    recordAdapterSuccess(nextName("ok"), 0);
    const s = getSystemStatus();
    expect(s.healthy + s.degraded + s.down).toBeLessThanOrEqual(s.total);
    expect(s.total).toBeGreaterThan(0);
  });

  it("getAllHealth returns the same adapter we wrote", () => {
    const name = nextName("findable");
    recordAdapterError(name, "test");
    const all = getAllHealth();
    expect(all.find((a) => a.name === name)).toBeTruthy();
  });

  it("isCircuitOpen is false only for 'down' adapters", () => {
    const name = nextName("circuit");
    recordAdapterSuccess(name, 0);
    expect(isCircuitOpen(name)).toBe(true);
    for (let i = 0; i < 5; i++) recordAdapterError(name, "down");
    expect(isCircuitOpen(name)).toBe(false);
  });
});
