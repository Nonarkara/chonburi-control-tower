import type { Locale, FallbackTier } from "./types";

export const LOCALES: Locale[] = ["en", "th", "zh"];

export const LOCALE_LABEL: Record<Locale, string> = {
  en: "EN",
  th: "TH",
  zh: "CN",
};

export interface TrilingualText {
  en: string;
  th: string;
  zh: string;
}

export function translate(locale: Locale, text: TrilingualText): string {
  return text[locale] ?? text.en;
}

/** Format age in minutes to human-readable string. */
export function fmtAge(minutes: number | undefined | null): string {
  if (minutes == null || minutes < 0) return '—';
  if (minutes < 1) return 'LIVE';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

/** Short label for fallback tier — empty string for live data. */
export function tierLabel(tier: FallbackTier): string {
  switch (tier) {
    case 'live':        return '';
    case 'database':    return 'DB';
    case 'cache':       return 'CACHE';
    case 'scenario':    return 'SCENARIO';
    case 'reference':   return 'REF';
    case 'unavailable': return 'OFFLINE';
    default:            return '';
  }
}
