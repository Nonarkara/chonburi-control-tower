/**
 * Pure helpers for the ChatBox component —
 * extracted for unit testing.
 */

/**
 * Translate an HTTP status code + optional raw error message into a
 * user-friendly string shown inside the chat panel.
 *
 * Handles common Gemini backend failure modes:
 *   503 → service not configured (missing API key)
 *   429 → daily rate limit hit
 *   400 "long" → message too long
 *   400 "turns" → conversation too long
 *   5xx → generic transient error
 *   other → raw message or "Request failed (N)"
 */
export function friendlyError(status: number, raw?: string): string {
  if (status === 503)
    return "Chat is not available — the AI service isn't configured yet. Ask your administrator to set a Gemini API key.";
  if (status === 429)
    return "The AI assistant has hit its usage limit for today — try again tomorrow.";
  if (status === 400 && raw?.toLowerCase().includes("long"))
    return "Your message is too long — please shorten it and try again.";
  if (status === 400 && raw?.toLowerCase().includes("turns"))
    return "This conversation is too long. Clear it and start fresh.";
  if (status >= 500)
    return "The AI service returned an error — try again in a moment.";
  return raw ?? `Request failed (${status})`;
}
