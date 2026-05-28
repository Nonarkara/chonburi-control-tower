import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchJsonOrNull, fetchTextOrNull } from "./common";

/**
 * common.ts utility contract tests.
 *
 * fetchJsonOrNull and fetchTextOrNull are used by every single adapter.
 * Getting them wrong would silently break all feeds.
 */

describe("fetchJsonOrNull", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed JSON on 200 OK", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ key: "value" }), { status: 200 }),
    );
    const result = await fetchJsonOrNull<{ key: string }>("https://example.com/api");
    expect(result).toEqual({ key: "value" });
  });

  it("returns null on non-OK status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    );
    const result = await fetchJsonOrNull("https://example.com/api");
    expect(result).toBeNull();
  });

  it("returns null on 500 error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );
    const result = await fetchJsonOrNull("https://example.com/api");
    expect(result).toBeNull();
  });

  it("returns null on network error (fetch throws)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const result = await fetchJsonOrNull("https://example.com/api");
    expect(result).toBeNull();
  });

  it("returns null on abort (timeout)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      Object.assign(new Error("Aborted"), { name: "AbortError" }),
    );
    const result = await fetchJsonOrNull("https://example.com/api");
    expect(result).toBeNull();
  });

  it("passes through custom init options (method, headers)", async () => {
    let capturedInit: RequestInit | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      capturedInit = init;
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    await fetchJsonOrNull("https://example.com/api", {
      method: "POST",
      headers: { "x-custom": "header" },
    });

    expect(capturedInit?.method).toBe("POST");
    const headers = new Headers(capturedInit?.headers);
    expect(headers.get("x-custom")).toBe("header");
  });

  it("adds accept: application/json header by default", async () => {
    let capturedHeaders: Headers | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      capturedHeaders = new Headers(init?.headers);
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    await fetchJsonOrNull("https://example.com/api");

    expect(capturedHeaders?.get("accept")).toBe("application/json");
  });

  it("does not override an explicitly set accept header", async () => {
    let capturedHeaders: Headers | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      capturedHeaders = new Headers(init?.headers);
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    await fetchJsonOrNull("https://example.com/api", {
      headers: { accept: "text/csv" },
    });

    expect(capturedHeaders?.get("accept")).toBe("text/csv");
  });

  it("returns null when response body is malformed JSON (res.json() throws)", async () => {
    // Response with 200 OK but invalid JSON body — res.json() will throw
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not-valid-json{{{", { status: 200 }),
    );
    const result = await fetchJsonOrNull("https://example.com/api");
    expect(result).toBeNull();
  });

  it("adds user-agent header in Node.js environment (navigator is undefined)", async () => {
    let capturedHeaders: Headers | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      capturedHeaders = new Headers(init?.headers);
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });

    await fetchJsonOrNull("https://example.com/api");

    // In Node.js test environment, navigator is undefined → user-agent is added
    if (typeof navigator === "undefined") {
      expect(capturedHeaders?.get("user-agent")).toMatch(/ChulaControlTower|chula/i);
    }
    // In Workers environment, user-agent is suppressed — test is a no-op there
  });
});

describe("fetchTextOrNull", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns text body on 200 OK", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("hello world", { status: 200 }),
    );
    const result = await fetchTextOrNull("https://example.com/page");
    expect(result).toBe("hello world");
  });

  it("returns null on non-OK status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Forbidden", { status: 403 }),
    );
    const result = await fetchTextOrNull("https://example.com/page");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await fetchTextOrNull("https://example.com/page");
    expect(result).toBeNull();
  });

  it("returns empty string response correctly (not null)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 200 }),
    );
    const result = await fetchTextOrNull("https://example.com/page");
    expect(result).toBe("");
  });

  it("returns null on abort (timeout) — AbortError caught by catch block", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      Object.assign(new Error("Aborted"), { name: "AbortError" }),
    );
    const result = await fetchTextOrNull("https://example.com/page");
    expect(result).toBeNull();
  });

  it("does not add accept header (fetchTextOrNull uses plain text — no accept override needed)", async () => {
    let capturedHeaders: Headers | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      capturedHeaders = new Headers(init?.headers);
      return Promise.resolve(new Response("data", { status: 200 }));
    });

    await fetchTextOrNull("https://example.com/page");

    // fetchTextOrNull does NOT add accept: application/json (unlike fetchJsonOrNull)
    // The accept header should be absent unless set via init
    expect(capturedHeaders?.get("accept")).toBeNull();
  });
});
