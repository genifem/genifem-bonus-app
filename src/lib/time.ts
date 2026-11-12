import type { Translator } from "@crewstars/i18n";

/**
 * "just now", "5m ago", "3h ago", "2d ago", then the date: how long ago a post or a
 * notification happened, as the prototype writes it.
 *
 * The words come from the catalog rather than Intl.RelativeTimeFormat, which Hermes does not
 * have, so a phone would otherwise fall back to bare dates. Units are floored: a post from 59
 * minutes ago says "59m", not "1h".
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Past a week a count of days stops meaning much; the date says it better. */
const WEEK = 7 * DAY;

export type Ago = { unit: "now" } | { unit: "minute" | "hour" | "day"; count: number } | { unit: "date" };

export function agoParts(value: string, now: number): Ago {
  const at = Date.parse(value);
  if (Number.isNaN(at)) return { unit: "date" };
  // A server clock a little ahead of the phone's makes a new post look like it is from the
  // future; it is still "just now".
  const elapsed = Math.max(0, now - at);
  if (elapsed < MINUTE) return { unit: "now" };
  if (elapsed < HOUR) return { unit: "minute", count: Math.floor(elapsed / MINUTE) };
  if (elapsed < DAY) return { unit: "hour", count: Math.floor(elapsed / HOUR) };
  if (elapsed < WEEK) return { unit: "day", count: Math.floor(elapsed / DAY) };
  return { unit: "date" };
}

/** "Sep 29", or "Sep 29, 2025" from another year, on the phone's own calendar. */
export function momentDate(value: string, locale: string, now: number): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return value.slice(0, 10);
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (at.getFullYear() !== new Date(now).getFullYear()) options.year = "numeric";
  try {
    return new Intl.DateTimeFormat(locale, options).format(at);
  } catch {
    return value.slice(0, 10);
  }
}

/**
 * The words for `value` as seen at `now`. `long` is the form a screen reader gets ("5
 * minutes ago" rather than "5m ago", which it would read as metres).
 */
export function timeAgo(t: Translator, value: string, now: number, long = false): string {
  const parts = agoParts(value, now);
  const suffix = long ? "Long" : "";
  switch (parts.unit) {
    case "now":
      return t("time.justNow");
    case "minute":
      return t(`time.minutes${suffix}`, { count: parts.count });
    case "hour":
      return t(`time.hours${suffix}`, { count: parts.count });
    case "day":
      return t(`time.days${suffix}`, { count: parts.count });
    case "date":
      return momentDate(value, t.locale, now);
  }
}
