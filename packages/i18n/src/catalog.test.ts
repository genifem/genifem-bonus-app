import { describe, expect, it } from "vitest";

import { fromAcceptLanguage, LOCALES, MESSAGES } from "./index";

function keys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

/**
 * The arguments a message takes, so a translation cannot quietly drop one. An argument is
 * a name directly followed by } or , - which is what tells it apart from the translated
 * words inside a plural branch, as in {n, plural, other {# questions}}. A branch holding a
 * single word would still look like an argument, so messages avoid those.
 */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\s*(\w+)\s*[},]/g)].map((m) => m[1]!).sort();
}

describe("message catalogs", () => {
  const reference = keys(MESSAGES.en).sort();

  it.each(LOCALES)("%s has exactly the English keys", (locale) => {
    expect(keys(MESSAGES[locale]).sort()).toEqual(reference);
  });

  it.each(LOCALES)("%s keeps every ICU placeholder", (locale) => {
    for (const key of reference) {
      const get = (m: unknown) =>
        key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], m);
      expect(placeholders(String(get(MESSAGES[locale]))), key).toEqual(
        placeholders(String(get(MESSAGES.en))),
      );
    }
  });
});

describe("fromAcceptLanguage", () => {
  it("picks the first supported language", () => {
    expect(fromAcceptLanguage("es-MX,es;q=0.9,en;q=0.8")).toBe("es");
    expect(fromAcceptLanguage("fr-FR,en;q=0.5")).toBe("en");
    expect(fromAcceptLanguage("fr-FR")).toBeUndefined();
    expect(fromAcceptLanguage(null)).toBeUndefined();
  });
});
