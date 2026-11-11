/**
 * Dates, times and numbers as the prototype writes them: "Tue, Sep 29", "Sep 29", "0:30",
 * "2h ago", "1,240".
 *
 * Calendar dates ("2026-09-29") are formatted in UTC, so a date never slides to the day
 * before for someone west of Greenwich: the date the API sent is the date the person reads.
 * Moments (a shout-out, a decision) are shown in the phone's own clock.
 */

function asDate(value: string): Date {
  // A bare date is midnight UTC; a full timestamp is taken as it is.
  return new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
}

function format(locale: string, value: string, options: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat(locale, options).format(asDate(value));
  } catch {
    return value.slice(0, 10);
  }
}

/** "Tue, Sep 29". */
export function shortDate(value: string, locale: string): string {
  return format(locale, value, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** "Sat, Sep 26, 2026". */
export function longDate(value: string, locale: string): string {
  return format(locale, value, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Sep 29": a reset date ("Resets Nov 1"). */
export function dayMonth(value: string, locale: string): string {
  return format(locale, value, { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "Sep 22, 9:14 AM", in the phone's own clock. */
export function dateTime(value: string, locale: string): string {
  return format(locale, value, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "September": the month the awards are for. */
export function monthName(locale: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat(locale, { month: "long" }).format(now);
  } catch {
    return "";
  }
}

/**
 * "2 hours ago", "yesterday": the largest unit that is at least one. Where the phone's engine
 * has no relative-time formatter, the date itself is shown instead.
 */
export function ago(value: string, locale: string, now = Date.now()): string {
  const seconds = Math.round((asDate(value).getTime() - now) / 1000);
  if (typeof Intl.RelativeTimeFormat !== "function") return dayMonth(value, locale);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return formatter.format(0, "minute");
}

/** "0:30", "6:42", or "1:02:05" past an hour. */
export function formatTime(total: number): string {
  const whole = Math.max(0, Math.floor(total));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = String(whole % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

/** "1,240" in English, "1240" / "1.240" as the locale writes it: coin amounts. */
export function formatCount(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}

/** Initials for an avatar. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** "Maria" from "Maria Lopez": the greeting on Home. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}
