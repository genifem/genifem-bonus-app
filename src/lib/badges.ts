import type { Schemas } from "@crewstars/api-client";
import type { Translator } from "@crewstars/i18n";

import type { IconName } from "@/components/ui/Icon";
import { isTagId } from "@/lib/recognition";
import { localized } from "@/lib/rewards";

/**
 * The badge grid (CR-33) and what the profile reads from it. Which badges exist, which are
 * earned and how far along someone is all come from `/me/badges`; Lucky Star arrives only once
 * won. This file words how to earn each one and works out its progress bar.
 */

export type MyBadge = Schemas["MyBadgeOut"];

export function badgeName(badge: Pick<MyBadge, "name" | "name_es">, locale: string): string {
  return localized(badge.name, badge.name_es, locale);
}

/** The owner picks a badge's glyph by name; these are the ones this app draws. */
const BADGE_ICONS = {
  heart: "heart",
  users: "users",
  bolt: "bolt",
  sparkle: "sparkle",
  send: "send",
  calendar: "calendar",
  star: "star",
  award: "award",
  trophy: "trophy",
  flag: "flag",
  arrowUp: "arrowUp",
  gift: "gift",
  wheel: "wheel",
} as const satisfies Record<string, IconName>;

export type BadgeIconName = (typeof BADGE_ICONS)[keyof typeof BADGE_ICONS];

/** A badge's glyph, or the star for a name this app doesn't draw. */
export function badgeIcon(name: string): BadgeIconName {
  return Object.prototype.hasOwnProperty.call(BADGE_ICONS, name)
    ? BADGE_ICONS[name as keyof typeof BADGE_ICONS]
    : "star";
}

/**
 * How to earn a locked badge, from its rule (CR-33): "Get 3 Guest Hero shout-outs", "Give 8
 * shout-outs", "Reach 90 days on the team", "Win it on the wheel".
 */
export function howToEarn(t: Translator, badge: Pick<MyBadge, "rule" | "tag" | "count">): string {
  const rule: string = badge.rule;
  const count = Math.max(1, badge.count);
  switch (rule) {
    case "tag": {
      if (!badge.tag) return t("badges.how.other");
      const tag = isTagId(badge.tag) ? t(`tags.${badge.tag}`) : badge.tag;
      return t("badges.how.tag", { count, tag });
    }
    case "given":
      return t("badges.how.given", { count });
    case "days":
      return t("badges.how.days", { count });
    case "spin":
      return t("badges.how.spin");
    default:
      return t("badges.how.other");
  }
}

export interface BadgeProgress {
  value: number;
  target: number;
  fraction: number;
}

/** How far along a locked badge is ("2 of 3"), or null for an earned one, Lucky Star, or a
 *  milestone for someone with no hire date on file. */
export function badgeProgress(badge: Pick<MyBadge, "earned" | "progress" | "count">): BadgeProgress | null {
  if (badge.earned || badge.progress === null) return null;
  const target = Math.max(1, badge.count);
  const value = Math.min(target, Math.max(0, badge.progress));
  return { value, target, fraction: value / target };
}

export function earnedCount(badges: readonly Pick<MyBadge, "earned">[]): number {
  return badges.filter((badge) => badge.earned).length;
}

/**
 * CR-32's "shout-outs given": the API has no field of its own for it, but the "give N
 * shout-outs" badge's progress is exactly that count (all time). Null when the owners have no
 * such badge, so the stat is left out rather than shown wrong.
 */
export function shoutoutsGiven(badges: readonly Pick<MyBadge, "rule" | "progress">[]): number | null {
  const giver = badges.find((badge) => badge.rule === "given" && badge.progress !== null);
  return giver ? Math.max(0, giver.progress ?? 0) : null;
}
