import type { Locale } from "./types";

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
