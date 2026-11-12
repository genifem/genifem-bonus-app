/**
 * "5m ago" on posts and notifications, in both languages, without Intl.RelativeTimeFormat
 * (Hermes has none).
 */
import { createTranslator } from "@crewstars/i18n";

import { agoParts, timeAgo } from "@/lib/time";

const en = createTranslator("en");
const es = createTranslator("es");

const NOW = new Date(2026, 10, 12, 15, 0, 0).getTime();
const before = (ms: number) => new Date(NOW - ms).toISOString();
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("agoParts", () => {
  it("says just now for the first minute", () => {
    expect(agoParts(before(0), NOW)).toEqual({ unit: "now" });
    expect(agoParts(before(59 * SECOND), NOW)).toEqual({ unit: "now" });
  });

  it("floors to the largest whole unit", () => {
    expect(agoParts(before(MINUTE), NOW)).toEqual({ unit: "minute", count: 1 });
    expect(agoParts(before(59 * MINUTE + 59 * SECOND), NOW)).toEqual({ unit: "minute", count: 59 });
    expect(agoParts(before(HOUR), NOW)).toEqual({ unit: "hour", count: 1 });
    expect(agoParts(before(23 * HOUR + 59 * MINUTE), NOW)).toEqual({ unit: "hour", count: 23 });
    expect(agoParts(before(DAY), NOW)).toEqual({ unit: "day", count: 1 });
    expect(agoParts(before(6 * DAY + 23 * HOUR), NOW)).toEqual({ unit: "day", count: 6 });
  });

  it("switches to the date after a week", () => {
    expect(agoParts(before(7 * DAY), NOW)).toEqual({ unit: "date" });
  });

  it("treats a server clock slightly ahead as just now, and a bad value as a date", () => {
    expect(agoParts(new Date(NOW + 20 * SECOND).toISOString(), NOW)).toEqual({ unit: "now" });
    expect(agoParts("not a date", NOW)).toEqual({ unit: "date" });
  });
});

describe("timeAgo", () => {
  it("writes the prototype's short forms in English", () => {
    expect(timeAgo(en, before(10 * SECOND), NOW)).toBe("just now");
    expect(timeAgo(en, before(5 * MINUTE), NOW)).toBe("5m ago");
    expect(timeAgo(en, before(3 * HOUR), NOW)).toBe("3h ago");
    expect(timeAgo(en, before(2 * DAY), NOW)).toBe("2d ago");
  });

  it("writes them in Spanish", () => {
    expect(timeAgo(es, before(10 * SECOND), NOW)).toBe("ahora mismo");
    expect(timeAgo(es, before(5 * MINUTE), NOW)).toBe("hace 5 min");
    expect(timeAgo(es, before(3 * HOUR), NOW)).toBe("hace 3 h");
    expect(timeAgo(es, before(2 * DAY), NOW)).toBe("hace 2 d");
  });

  it("spells units out for a screen reader, with plurals", () => {
    expect(timeAgo(en, before(MINUTE), NOW, true)).toBe("1 minute ago");
    expect(timeAgo(en, before(5 * MINUTE), NOW, true)).toBe("5 minutes ago");
    expect(timeAgo(en, before(HOUR), NOW, true)).toBe("1 hour ago");
    expect(timeAgo(es, before(2 * DAY), NOW, true)).toBe("hace 2 días");
    expect(timeAgo(es, before(DAY), NOW, true)).toBe("hace 1 día");
  });

  it("shows the date for older posts, with the year only when it is another one", () => {
    const sameYear = new Date(2026, 8, 29, 12).toISOString();
    expect(timeAgo(en, sameYear, NOW)).toBe("Sep 29");
    expect(timeAgo(es, sameYear, NOW)).toMatch(/29 sept?/);
    const lastYear = new Date(2025, 8, 29, 12).toISOString();
    expect(timeAgo(en, lastYear, NOW)).toBe("Sep 29, 2025");
  });
});
