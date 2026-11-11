import { createTranslator, DEFAULT_LOCALE, isLocale, type Locale, type Translator } from "@crewstars/i18n";
import { getLocales } from "expo-localization";

/** The phone's language, to start with; after sign-in the profile's language wins, and the
 *  English / Español switch beats both. */
export function deviceLocale(): Locale {
  const first = getLocales()[0]?.languageCode;
  return isLocale(first) ? first : DEFAULT_LOCALE;
}

export function translatorFor(locale: Locale | string | null | undefined): Translator {
  return createTranslator(isLocale(locale) ? locale : deviceLocale());
}
