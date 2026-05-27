import { describe, it, expect } from "vitest";
import { safeUrl } from "./safeUrl";

/**
 * safeUrl security tests — this function validates URLs before they are
 * used in href/src attributes inside the ChatBox to prevent XSS. Getting
 * it wrong lets a malicious model response inject javascript: or data: URLs.
 */

describe("safeUrl — valid URLs", () => {
  it("returns the URL for https: protocol", () => {
    expect(safeUrl("https://example.com")).toBe("https://example.com/");
  });

  it("returns the URL for http: protocol", () => {
    expect(safeUrl("http://example.com/path?q=1")).toBe("http://example.com/path?q=1");
  });

  it("returns the canonical href (normalized by URL constructor)", () => {
    // URL() normalizes trailing slashes and casing
    const result = safeUrl("https://EXAMPLE.COM");
    expect(result).toBe("https://example.com/");
  });

  it("handles URLs with paths, queries, and fragments", () => {
    const url = "https://data.chonburi.go.th/api/v1/incidents?page=1&limit=10#results";
    expect(safeUrl(url)).toBe(url);
  });

  it("handles URLs with Thai characters in path (encoded by URL constructor)", () => {
    // URL constructor percent-encodes non-ASCII chars
    const result = safeUrl("https://example.com/ชลบุรี");
    expect(result).not.toBeNull();
    expect(result).toContain("example.com");
  });
});

describe("safeUrl — rejected URLs (XSS vectors)", () => {
  it("returns null for javascript: protocol", () => {
    expect(safeUrl("javascript:alert('xss')")).toBeNull();
  });

  it("returns null for data: protocol", () => {
    expect(safeUrl("data:text/html,<script>alert('xss')</script>")).toBeNull();
  });

  it("returns null for vbscript: protocol", () => {
    expect(safeUrl("vbscript:msgbox('xss')")).toBeNull();
  });

  it("returns null for file: protocol", () => {
    expect(safeUrl("file:///etc/passwd")).toBeNull();
  });

  it("returns null for ftp: protocol", () => {
    expect(safeUrl("ftp://example.com/file.txt")).toBeNull();
  });

  it("returns null for blob: protocol", () => {
    expect(safeUrl("blob:https://example.com/uuid")).toBeNull();
  });
});

describe("safeUrl — invalid inputs", () => {
  it("returns null for null input", () => {
    expect(safeUrl(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(safeUrl(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(safeUrl("")).toBeNull();
  });

  it("returns null for plain text (not a URL)", () => {
    expect(safeUrl("not a url")).toBeNull();
  });

  it("returns null for relative path", () => {
    expect(safeUrl("/relative/path")).toBeNull();
  });

  it("returns null for protocol-relative URL (//example.com)", () => {
    // URL constructor fails without a base, so protocol-relative → null
    expect(safeUrl("//example.com")).toBeNull();
  });
});
