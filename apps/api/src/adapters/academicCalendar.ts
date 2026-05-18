/**
 * Academic-calendar nowcast — turns the static phase list in
 * @chula/shared into a "where are we right now / what's next / how
 * busy should we expect campus to be" snapshot.
 *
 * Pure compute (no network), but cached for 30 min so we don't churn
 * downstream consumers on every request.
 */

import type { AcademicPhase, AcademicSnapshot, NormalizedFeed } from "@chula/shared";
import { CHULA_CALENDAR_ALL } from "@chula/shared";
import { cacheAgeMinutes, cached } from "../lib/cache.js";

const TTL_SECONDS = 1800;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const ta = new Date(a + "T00:00:00+07:00").getTime();
  const tb = new Date(b + "T00:00:00+07:00").getTime();
  return Math.round((tb - ta) / 86400000);
}

function tempoFor(id: AcademicPhase["id"] | null): AcademicSnapshot["tempo"] {
  if (!id) return "normal";
  switch (id) {
    case "freshy-week":
    case "graduation":
    case "semester-1-finals":
    case "semester-2-finals":
      return "peak";
    case "semester-1":
    case "semester-2":
      return "high";
    case "summer-term":
      return "normal";
    case "break":
    case "holiday":
      return "low";
    default:
      return "normal";
  }
}

export async function fetchAcademicSnapshot(): Promise<NormalizedFeed<AcademicSnapshot>> {
  return cached("academic-calendar", TTL_SECONDS, async () => {
    const fetchedAt = new Date().toISOString();
    const today = dayKey(new Date());

    const sorted = [...CHULA_CALENDAR_ALL].sort((a, b) => a.start.localeCompare(b.start));
    const current = sorted.find((p) => p.start <= today && p.end >= today) ?? null;
    const next = sorted.find((p) => p.start > today) ?? null;
    const daysToNext = next ? daysBetween(today, next.start) : null;
    const tempo = tempoFor(current?.id ?? null);

    const snapshot: AcademicSnapshot = { current, next, daysToNext, tempo };

    return {
      features: [snapshot],
      meta: {
        source: "chula-academic-calendar-static",
        fetchedAt,
        ageMinutes: cacheAgeMinutes(fetchedAt),
        fallbackTier: "reference" as const,
      },
    };
  });
}
