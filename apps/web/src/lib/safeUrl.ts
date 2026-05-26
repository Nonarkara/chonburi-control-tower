/**
 * Validate a URL string for safe use in href/src.
 * Only allows absolute http: and https: URLs — rejects relative paths,
 * raw text, and dangerous protocols (javascript:, data:, etc.).
 *
 * NB: we do NOT pass a base URL to URL() because that would resolve
 * arbitrary garbage strings ("not a url") into apparently-valid relative
 * URLs against the current origin — defeating the safety check.
 */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {
    // invalid URL
  }
  return null;
}
