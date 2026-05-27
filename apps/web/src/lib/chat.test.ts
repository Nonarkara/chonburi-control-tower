import { describe, it, expect } from "vitest";
import { friendlyError } from "./chat";

/**
 * chat.ts contract tests.
 *
 * friendlyError() translates HTTP status + optional raw server message
 * into user-facing strings inside the ChatBox. Getting these wrong means
 * operators see confusing technical error codes instead of actionable text.
 *
 * Covered:
 *   - 503 → missing API key message
 *   - 429 → rate limit message
 *   - 400 + "long" in raw → message-too-long
 *   - 400 + "turns" in raw → conversation-too-long
 *   - 400 + unmatched raw → raw passthrough
 *   - 5xx → generic transient error
 *   - Other status → raw or fallback "Request failed (N)"
 */

describe("friendlyError", () => {
  it("returns 503 message about missing API key", () => {
    const msg = friendlyError(503);
    expect(msg).toContain("not available");
    expect(msg).toContain("Gemini API key");
  });

  it("returns 429 rate limit message", () => {
    const msg = friendlyError(429);
    expect(msg).toContain("usage limit");
    expect(msg).toContain("tomorrow");
  });

  it("returns message-too-long for 400 with 'long' in raw", () => {
    const msg = friendlyError(400, "Input too long for model");
    expect(msg).toContain("too long");
    expect(msg).toContain("shorten");
  });

  it("matches 'long' case-insensitively", () => {
    const msg = friendlyError(400, "CONTEXT_TOO_LONG");
    expect(msg).toContain("too long");
  });

  it("returns conversation-too-long for 400 with 'turns' in raw", () => {
    const msg = friendlyError(400, "Too many turns in conversation");
    expect(msg).toContain("too long");
    expect(msg).toContain("Clear");
  });

  it("matches 'turns' case-insensitively", () => {
    const msg = friendlyError(400, "Maximum TURNS exceeded");
    expect(msg).toContain("Clear");
  });

  it("returns raw for 400 with unrecognised message", () => {
    const msg = friendlyError(400, "Bad request: unknown field");
    expect(msg).toBe("Bad request: unknown field");
  });

  it("returns generic 5xx message for status 500", () => {
    const msg = friendlyError(500);
    expect(msg).toContain("error");
    expect(msg).toContain("try again");
  });

  it("returns generic 5xx message for status 502", () => {
    const msg = friendlyError(502, "Bad gateway");
    expect(msg).toContain("error");
    expect(msg).toContain("try again");
  });

  it("returns raw message for unhandled status when raw is provided", () => {
    expect(friendlyError(401, "Unauthorised")).toBe("Unauthorised");
  });

  it("returns fallback 'Request failed (N)' for unhandled status without raw", () => {
    expect(friendlyError(403)).toBe("Request failed (403)");
    expect(friendlyError(404)).toBe("Request failed (404)");
  });
});
