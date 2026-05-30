import { describe, it, expect } from "vitest";
import app from "./index.js";

/**
 * /api/health/keys integration tests.
 *
 * The endpoint reports which optional API keys are configured (presence only,
 * never values) so the web UI can drive its "needs key" layer state. Uses
 * Hono's app.request() with a per-call env so we can simulate present/missing
 * keys without touching process.env.
 */

interface KeyEntry {
  key: string;
  label: string;
  powers: string;
  getAt: string;
  configured: boolean;
}
interface KeysResponse {
  keys: KeyEntry[];
  configured: number;
  total: number;
  at: string;
}

async function getKeys(env: Record<string, string>): Promise<KeysResponse> {
  const res = await app.request("/api/health/keys", {}, env);
  expect(res.status).toBe(200);
  return (await res.json()) as KeysResponse;
}

describe("/api/health/keys", () => {
  it("reports all keys missing when env is empty", async () => {
    const body = await getKeys({ ENVIRONMENT: "test" });
    expect(body.configured).toBe(0);
    expect(body.total).toBeGreaterThan(0);
    expect(body.keys.every((k) => k.configured === false)).toBe(true);
  });

  it("marks a key configured when its env var is set", async () => {
    const body = await getKeys({ ENVIRONMENT: "test", AISSTREAM_TOKEN: "abc123" });
    const ais = body.keys.find((k) => k.key === "AISSTREAM_TOKEN");
    expect(ais?.configured).toBe(true);
    expect(body.configured).toBe(1);
  });

  it("treats whitespace-only values as not configured", async () => {
    const body = await getKeys({ ENVIRONMENT: "test", AQICN_TOKEN: "   " });
    const aqicn = body.keys.find((k) => k.key === "AQICN_TOKEN");
    expect(aqicn?.configured).toBe(false);
  });

  it("never leaks key values, only presence + metadata", async () => {
    const secret = "super-secret-token-value";
    const res = await app.request("/api/health/keys", {}, { ENVIRONMENT: "test", GEMINI_API_KEY: secret });
    const text = await res.text();
    expect(text).not.toContain(secret);
    const gemini = (JSON.parse(text) as KeysResponse).keys.find((k) => k.key === "GEMINI_API_KEY");
    expect(gemini?.configured).toBe(true);
    expect(gemini?.label).toBe("Gemini");
    expect(gemini?.getAt).toMatch(/^https:\/\//);
  });
});
