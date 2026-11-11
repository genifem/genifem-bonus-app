import en from "../messages/en.json";
import es from "../messages/es.json";

/** UI languages. Adding one = a new messages/<code>.json, no code change. */
export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Cookie that remembers the chosen UI language on the web. */
export const LOCALE_COOKIE = "cs_locale";

export type Messages = typeof en;

export const MESSAGES: Record<Locale, Messages> = { en, es };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Best supported locale from an Accept-Language header, or undefined. */
export function fromAcceptLanguage(header: string | null | undefined): Locale | undefined {
  if (!header) return undefined;
  for (const part of header.split(",")) {
    const code = part.split(";")[0]?.trim().toLowerCase().split("-")[0];
    if (isLocale(code)) return code;
  }
  return undefined;
}

export * from "./translate";
