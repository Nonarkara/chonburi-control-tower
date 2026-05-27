import { describe, it, expect, vi, afterEach } from "vitest";
import { parsePositiveInt, parseBool, dbUrlMeta, shouldUseSsl } from "./twinDb.js";

/**
 * twinDb.ts utility-function contract tests.
 *
 * Tests the four pure / near-pure helpers that govern database connection
 * config. Getting these wrong silently causes:
 *   - Wrong pool size (parsePositiveInt)
 *   - SSL not applied to production Supabase connections (shouldUseSsl)
 *   - Wrong host/db extracted from connection strings (dbUrlMeta)
 *
 * We do NOT test the DB I/O functions (dbUpsertObject, etc.) — those
 * require a live PostgreSQL instance. These helpers are the testable slice.
 */

// ─── parsePositiveInt ──────────────────────────────────────────────────────

describe("parsePositiveInt", () => {
  it("returns the parsed integer for a valid positive int string", () => {
    expect(parsePositiveInt("10", 5)).toBe(10);
    expect(parsePositiveInt("1", 5)).toBe(1);
  });

  it("returns the fallback for undefined input", () => {
    expect(parsePositiveInt(undefined, 5)).toBe(5);
  });

  it("returns the fallback for empty string", () => {
    expect(parsePositiveInt("", 5)).toBe(5);
  });

  it("returns the fallback for zero (not positive)", () => {
    expect(parsePositiveInt("0", 5)).toBe(5);
  });

  it("returns the fallback for negative numbers", () => {
    expect(parsePositiveInt("-1", 5)).toBe(5);
    expect(parsePositiveInt("-100", 5)).toBe(5);
  });

  it("returns the fallback for non-integer values (float)", () => {
    expect(parsePositiveInt("3.5", 5)).toBe(5);
    expect(parsePositiveInt("1.0", 5)).toBe(1); // 1.0 IS an integer
  });

  it("returns the fallback for non-numeric strings", () => {
    expect(parsePositiveInt("abc", 5)).toBe(5);
    expect(parsePositiveInt("NaN", 5)).toBe(5);
  });
});

// ─── parseBool ────────────────────────────────────────────────────────────

describe("parseBool", () => {
  it("returns true for truthy string values (case-insensitive)", () => {
    expect(parseBool("1")).toBe(true);
    expect(parseBool("true")).toBe(true);
    expect(parseBool("TRUE")).toBe(true);
    expect(parseBool("yes")).toBe(true);
    expect(parseBool("YES")).toBe(true);
    expect(parseBool("on")).toBe(true);
    expect(parseBool("ON")).toBe(true);
  });

  it("returns false for falsy string values (case-insensitive)", () => {
    expect(parseBool("0")).toBe(false);
    expect(parseBool("false")).toBe(false);
    expect(parseBool("FALSE")).toBe(false);
    expect(parseBool("no")).toBe(false);
    expect(parseBool("NO")).toBe(false);
    expect(parseBool("off")).toBe(false);
    expect(parseBool("OFF")).toBe(false);
  });

  it("returns undefined for null/undefined input", () => {
    expect(parseBool(undefined)).toBeUndefined();
    expect(parseBool(null as unknown as undefined)).toBeUndefined();
  });

  it("returns undefined for unrecognised strings", () => {
    expect(parseBool("maybe")).toBeUndefined();
    expect(parseBool("2")).toBeUndefined();
    expect(parseBool("")).toBeUndefined();
  });
});

// ─── dbUrlMeta ────────────────────────────────────────────────────────────

describe("dbUrlMeta", () => {
  it("returns configured=false for undefined input", () => {
    const m = dbUrlMeta(undefined);
    expect(m.configured).toBe(false);
    expect(m.host).toBeNull();
    expect(m.isSupabase).toBe(false);
  });

  it("parses host, port, database, user from a standard postgres URL", () => {
    const m = dbUrlMeta("postgresql://alice:secret@db.example.com:5432/mydb");
    expect(m.configured).toBe(true);
    expect(m.host).toBe("db.example.com");
    expect(m.port).toBe("5432");
    expect(m.database).toBe("mydb");
    expect(m.user).toBe("alice");
    expect(m.isSupabase).toBe(false);
  });

  it("detects a Supabase host by *.supabase.co domain", () => {
    const m = dbUrlMeta("postgresql://postgres:pass@db.abc123.supabase.co:5432/postgres");
    expect(m.isSupabase).toBe(true);
  });

  it("detects a Supabase pooler host", () => {
    const m = dbUrlMeta("postgresql://postgres:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres");
    expect(m.isSupabase).toBe(true);
  });

  it("does not flag a non-Supabase host as isSupabase", () => {
    const m = dbUrlMeta("postgresql://user:pass@my-db.fly.dev:5432/app");
    expect(m.isSupabase).toBe(false);
  });

  it("extracts sslmode from query string", () => {
    const m = dbUrlMeta("postgresql://user:pass@host:5432/db?sslmode=require");
    expect(m.sslMode).toBe("require");
  });

  it("returns sslMode=null when sslmode is absent", () => {
    const m = dbUrlMeta("postgresql://user:pass@host:5432/db");
    expect(m.sslMode).toBeNull();
  });

  it("decodes percent-encoded usernames", () => {
    // '@' in username must be encoded as '%40' in a valid URL
    const m = dbUrlMeta("postgresql://user%40example.com:pass@host:5432/db");
    expect(m.user).toBe("user@example.com");
  });

  it("returns configured=true with null fields for a malformed URL", () => {
    const m = dbUrlMeta("not-a-valid-url");
    expect(m.configured).toBe(true);
    expect(m.host).toBeNull();
  });
});

// ─── shouldUseSsl ─────────────────────────────────────────────────────────

describe("shouldUseSsl", () => {
  afterEach(() => {
    // Clean up any env vars we set in tests
    delete process.env.DATABASE_SSL;
    delete process.env.SUPABASE_DB_SSL;
  });

  it("returns true for Supabase URL when no SSL env var is set", () => {
    const supabaseUrl = "postgresql://postgres:pass@db.abc123.supabase.co:5432/postgres";
    expect(shouldUseSsl(supabaseUrl)).toBe(true);
  });

  it("returns false for a non-Supabase URL when no SSL env var is set and no sslmode", () => {
    const regularUrl = "postgresql://user:pass@localhost:5432/app";
    expect(shouldUseSsl(regularUrl)).toBe(false);
  });

  it("DATABASE_SSL=true overrides and forces SSL for any URL", () => {
    process.env.DATABASE_SSL = "true";
    const regularUrl = "postgresql://user:pass@localhost:5432/app";
    expect(shouldUseSsl(regularUrl)).toBe(true);
  });

  it("DATABASE_SSL=false overrides and disables SSL even for Supabase", () => {
    process.env.DATABASE_SSL = "false";
    const supabaseUrl = "postgresql://postgres:pass@db.abc123.supabase.co:5432/postgres";
    expect(shouldUseSsl(supabaseUrl)).toBe(false);
  });

  it("returns true for sslmode=require in URL (no env override)", () => {
    const url = "postgresql://user:pass@localhost:5432/db?sslmode=require";
    expect(shouldUseSsl(url)).toBe(true);
  });

  it("returns true for sslmode=verify-full in URL (no env override)", () => {
    const url = "postgresql://user:pass@localhost:5432/db?sslmode=verify-full";
    expect(shouldUseSsl(url)).toBe(true);
  });

  it("returns false for sslmode=disable in URL (no env override)", () => {
    const url = "postgresql://user:pass@host:5432/db?sslmode=disable";
    expect(shouldUseSsl(url)).toBe(false);
  });

  it("returns false for sslmode=allow in URL (no env override)", () => {
    const url = "postgresql://user:pass@host:5432/db?sslmode=allow";
    expect(shouldUseSsl(url)).toBe(false);
  });
});
