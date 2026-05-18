/**
 * Validate a URL string for safe use in href/src.
 * Only allows http: and https: protocols.
 * Returns the URL if safe, otherwise null.
 */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {
    // invalid URL
  }
  return null;
}
