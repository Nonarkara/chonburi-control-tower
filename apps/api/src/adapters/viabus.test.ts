import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as common from "./common.js";

/**
 * viabus adapter contract tests — the ViaBus CU POP Bus integration.
 * The API is partner-gated (VIABUS_TOKEN required). Tests verify:
 *   - No token → null (never fetches)
 *   - Token present + valid response → vehicle array
 *   - Empty vehicles array → null (caller falls back to scenario)
 *   - Network failure → null (fetchJsonOrNull already swallows it)
 */

// We mock fetchJsonOrNull so no real network traffic is made.
vi.mock("./common.js", async (importOriginal) => {
  const mod = await importOriginal<typeof common>();
  return { ...mod, fetchJsonOrNull: vi.fn() };
});

const mockedFetchJson = common.fetchJsonOrNull as ReturnType<typeof vi.fn>;

// Import after mock is registered
const { fetchViabusCuShuttle } = await import("./viabus.js");

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchViabusCuShuttle — token guard", () => {
  it("returns null immediately when no VIABUS_TOKEN is provided", async () => {
    const result = await fetchViabusCuShuttle({});
    expect(result).toBeNull();
    expect(mockedFetchJson).not.toHaveBeenCalled();
  });

  it("returns null when VIABUS_TOKEN is an empty string", async () => {
    const result = await fetchViabusCuShuttle({ VIABUS_TOKEN: "" });
    expect(result).toBeNull();
    expect(mockedFetchJson).not.toHaveBeenCalled();
  });
});

describe("fetchViabusCuShuttle — URL construction", () => {
  it("uses the default Open-Meteo base URL when no VIABUS_BASE_URL is set", async () => {
    mockedFetchJson.mockResolvedValueOnce({ vehicles: [] });
    await fetchViabusCuShuttle({ VIABUS_TOKEN: "tok123" });
    const url = mockedFetchJson.mock.calls[0][0] as string;
    expect(url).toContain("api.viabus.co");
    expect(url).toContain("cu-pop-bus");
    expect(url).toContain("vehicles");
  });

  it("uses VIABUS_BASE_URL override when provided", async () => {
    mockedFetchJson.mockResolvedValueOnce({ vehicles: [] });
    await fetchViabusCuShuttle({
      VIABUS_TOKEN: "tok123",
      VIABUS_BASE_URL: "https://custom-viabus.example.com/",
    });
    const url = mockedFetchJson.mock.calls[0][0] as string;
    expect(url).toContain("custom-viabus.example.com");
    // trailing slash should be stripped before appending path
    expect(url).not.toContain("//v1");
  });

  it("passes Bearer token in Authorization header", async () => {
    mockedFetchJson.mockResolvedValueOnce({ vehicles: [] });
    await fetchViabusCuShuttle({ VIABUS_TOKEN: "my-secret-token" });
    const init = mockedFetchJson.mock.calls[0][1] as RequestInit;
    expect((init?.headers as Record<string, string>)?.authorization).toBe("Bearer my-secret-token");
  });
});

describe("fetchViabusCuShuttle — response handling", () => {
  it("returns null when upstream returns an empty vehicles array", async () => {
    mockedFetchJson.mockResolvedValueOnce({ vehicles: [] });
    const result = await fetchViabusCuShuttle({ VIABUS_TOKEN: "tok" });
    expect(result).toBeNull();
  });

  it("returns null when upstream returns no vehicles field", async () => {
    mockedFetchJson.mockResolvedValueOnce({});
    const result = await fetchViabusCuShuttle({ VIABUS_TOKEN: "tok" });
    expect(result).toBeNull();
  });

  it("returns null when fetchJsonOrNull returns null (network error)", async () => {
    mockedFetchJson.mockResolvedValueOnce(null);
    const result = await fetchViabusCuShuttle({ VIABUS_TOKEN: "tok" });
    expect(result).toBeNull();
  });

  it("returns the vehicle array when the API responds with valid data", async () => {
    const vehicles = [
      {
        id: "bus-001",
        line: "1",
        lat: 13.741,
        lng: 100.537,
        bearing: 90,
        speedKmh: 25,
        occupancy: "low" as const,
        updatedAt: "2026-05-27T07:00:00Z",
      },
      {
        id: "bus-002",
        line: "2",
        lat: 13.738,
        lng: 100.534,
        bearing: 270,
        speedKmh: 0,
        occupancy: "medium" as const,
        updatedAt: "2026-05-27T07:00:05Z",
      },
    ];
    mockedFetchJson.mockResolvedValueOnce({ vehicles });
    const result = await fetchViabusCuShuttle({ VIABUS_TOKEN: "tok" });
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![0].id).toBe("bus-001");
    expect(result![1].line).toBe("2");
  });

  it("forwards vehicle shape with all optional fields", async () => {
    mockedFetchJson.mockResolvedValueOnce({
      vehicles: [{
        id: "bus-003",
        line: "3",
        lat: 13.742,
        lng: 100.540,
        updatedAt: "2026-05-27T07:01:00Z",
        // bearing, speedKmh, occupancy are optional
      }],
    });
    const result = await fetchViabusCuShuttle({ VIABUS_TOKEN: "tok" });
    expect(result).not.toBeNull();
    expect(result![0].bearing).toBeUndefined();
    expect(result![0].speedKmh).toBeUndefined();
    expect(result![0].occupancy).toBeUndefined();
  });
});
