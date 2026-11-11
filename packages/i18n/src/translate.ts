import { DEFAULT_LOCALE, type Locale, MESSAGES, type Messages } from "./index";

/**
 * A message lookup for clients without next-intl (the mobile app).
 *
 * The catalogs are the web's, written for next-intl, so they use a little of ICU: simple
 * {name} placeholders, `{count, plural, one {...} other {...}}` (with `#` for the number and
 * `=0` for exact matches), `select`, and `<b>` for bold. That subset is handled here, without
 * Intl.PluralRules, which the phone's JavaScript engine may not have: English and Spanish
 * both say "one" for exactly 1 and "other" for everything else.
 *
 * Anything richer (ordinal, number skeletons, apostrophe escapes) is not supported; if a
 * catalog needs it, swap this for a full ICU formatter rather than growing it further.
 */

export type Values = Record<string, string | number>;

/** A run of text, bold or not: what `t.rich` returns for messages with `<b>` in them. */
export interface RichPart {
  text: string;
  bold: boolean;
}

function lookup(messages: Messages, key: string): string | undefined {
  let current: unknown = messages;
  for (const part of key.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

/** Index of the brace that closes the one at `open`, or -1. */
function closing(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

/** `one {a} other {b}` as a map of selector to message. */
function branches(body: string): Map<string, string> {
  const out = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    const open = body.indexOf("{", i);
    if (open < 0) break;
    const selector = body.slice(i, open).trim();
    const end = closing(body, open);
    if (end < 0) break;
    out.set(selector, body.slice(open + 1, end));
    i = end + 1;
  }
  return out;
}

function pluralCategory(n: number): string {
  return n === 1 ? "one" : "other";
}

/** `#` stands for the number, but only at this level: a nested argument keeps its own. */
function hash(message: string, n: number): string {
  let out = "";
  let depth = 0;
  for (const char of message) {
    if (char === "{") depth++;
    if (char === "}") depth--;
    out += char === "#" && depth === 0 ? String(n) : char;
  }
  return out;
}

function argument(inner: string, values: Values, whole: string): string {
  const [name = "", kind, ...rest] = inner.split(",");
  const key = name.trim();
  if (kind === undefined) return key in values ? String(values[key]) : whole;
  if (!(key in values)) return whole;
  const value = values[key]!;
  const options = branches(rest.join(","));
  const type = kind.trim();
  if (type === "plural") {
    const n = Number(value);
    const chosen = options.get(`=${n}`) ?? options.get(pluralCategory(n)) ?? options.get("other");
    return chosen === undefined ? whole : fill(hash(chosen, n), values);
  }
  if (type === "select") {
    const chosen = options.get(String(value)) ?? options.get("other");
    return chosen === undefined ? whole : fill(chosen, values);
  }
  return String(value);
}

/** Fill a template. Placeholders without a value are left as written, never "undefined". */
export function fill(template: string, values: Values = {}): string {
  let out = "";
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf("{", i);
    if (open < 0) {
      out += template.slice(i);
      break;
    }
    const end = closing(template, open);
    if (end < 0) {
      out += template.slice(i);
      break;
    }
    out += template.slice(i, open);
    const whole = template.slice(open, end + 1);
    out += argument(template.slice(open + 1, end), values, whole);
    i = end + 1;
  }
  return out;
}

const TAG = /<(\w+)>(.*?)<\/\1>/g;

/** Split a filled message into plain and bold runs. */
export function richParts(text: string): RichPart[] {
  const parts: RichPart[] = [];
  let last = 0;
  for (const match of text.matchAll(TAG)) {
    const at = match.index ?? 0;
    if (at > last) parts.push({ text: text.slice(last, at), bold: false });
    parts.push({ text: match[2] ?? "", bold: true });
    last = at + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false });
  return parts;
}

export interface Translator {
  /** The message as plain text; `<b>` tags are dropped, their words kept. */
  (key: string, values?: Values): string;
  /** The message in runs, for the few that set a word in bold. */
  rich(key: string, values?: Values): RichPart[];
  has(key: string): boolean;
  locale: Locale;
}

export function createTranslator(locale: Locale): Translator {
  const messages = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
  const fallback = MESSAGES[DEFAULT_LOCALE];

  const raw = (key: string, values?: Values): string | undefined => {
    const template = lookup(messages, key) ?? lookup(fallback, key);
    return template === undefined ? undefined : fill(template, values);
  };

  // A missing key shows the key: loud in development, harmless in front of the crew.
  const translate = ((key: string, values?: Values) =>
    (raw(key, values) ?? key).replace(TAG, "$2")) as Translator;

  translate.rich = (key: string, values?: Values) => richParts(raw(key, values) ?? key);
  translate.has = (key: string) =>
    lookup(messages, key) !== undefined || lookup(fallback, key) !== undefined;
  translate.locale = locale;
  return translate;
}
