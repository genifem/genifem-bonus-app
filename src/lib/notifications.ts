import type { Schemas } from "@crewstars/api-client";
import type { Translator } from "@crewstars/i18n";

import type { IconName } from "@/components/ui/Icon";
import { isTagId, TAG_ICONS } from "@/lib/recognition";

/**
 * Notification sentences, written on the phone from the type and its params in the language
 * on screen now (plan D14), so switching language rewrites the whole list at once (NF-02).
 * The texts are the spec's "Notifications" table.
 *
 * Only `shoutout_received` and `tier_reached` are sent so far; the rest arrive with rewards,
 * badges, spins and awards, and are written here already so an older app reads them. A type
 * this app has never heard of still says something rather than nothing.
 */

export type NotificationOut = Schemas["NotificationOut"];
type Params = NotificationOut["params"];

function text(params: Params, key: string): string {
  const value = params[key];
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

/** An owner-typed name with its optional Spanish (plan G8): `badge_name` / `badge_name_es`. */
function named(params: Params, key: string, locale: string): string {
  const spanish = locale === "es" ? text(params, `${key}_es`) : "";
  return spanish || text(params, key);
}

/** "October", from the award's month ("2026-10"), in the language on screen. */
export function monthLabel(month: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const at = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 15));
  try {
    return new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(at);
  } catch {
    return month;
  }
}

function tagName(t: Translator, tag: string): string {
  return isTagId(tag) ? t(`tags.${tag}`) : tag;
}

export function notificationText(t: Translator, notification: Pick<NotificationOut, "type" | "params" | "coins">): string {
  const { params, coins } = notification;
  const key = (name: string) => `notifications.types.${name}`;
  const type: string = notification.type;
  switch (type) {
    case "shoutout_received":
      return t(key(type), { name: text(params, "from_name"), tag: tagName(t, text(params, "tag")) });
    case "tier_reached":
      return t(key(type), { tier: named(params, "tier_name", t.locale) });
    case "badge_earned": {
      const badge = named(params, "badge_name", t.locale);
      return coins ? t(key("badge_earned_bonus"), { badge, coins }) : t(key(type), { badge });
    }
    case "spin_earned": {
      const reason = text(params, "reason");
      const why = `notifications.spinReasons.${reason}`;
      return reason && t.has(why) ? t(key("spin_earned_for"), { reason: t(why) }) : t(key(type));
    }
    case "spin_result":
      return t(key(type), { prize: named(params, "prize_label", t.locale) });
    case "reward_requested":
      return t(key(type), { name: text(params, "from_name"), reward: named(params, "reward_name", t.locale) });
    case "reward_approved":
      return t(key(type), { reward: named(params, "reward_name", t.locale) });
    case "reward_declined": {
      const reward = named(params, "reward_name", t.locale);
      return coins ? t(key("reward_declined_refund"), { reward, coins }) : t(key(type), { reward });
    }
    case "award_won":
      return t(key(type), {
        award: named(params, "award_name", t.locale),
        month: monthLabel(text(params, "month"), t.locale),
      });
    default:
      return t(key("other"));
  }
}

/** The glyph in the notification's tile, as the prototype picks them. */
export function notificationIcon(notification: Pick<NotificationOut, "type" | "params">): IconName {
  const type: string = notification.type;
  switch (type) {
    case "shoutout_received": {
      const tag = text(notification.params, "tag");
      return isTagId(tag) ? TAG_ICONS[tag] : "heart";
    }
    case "tier_reached":
      return "star";
    case "badge_earned":
      return "award";
    case "spin_earned":
    case "spin_result":
      return "wheel";
    case "reward_requested":
    case "reward_approved":
      return "gift";
    case "reward_declined":
      return "info";
    case "award_won":
      return "trophy";
    default:
      return "bell";
  }
}
