import type { Schemas } from "@crewstars/api-client";
import type { Translator, Values } from "@crewstars/i18n";

import type { IconName } from "@/components/ui/Icon";
import type { PillStatus } from "@/components/ui/primitives";
import { formatCount } from "@/lib/format";

/**
 * Rewards as the app shows them (CR-24 to CR-27, MG-09). Whether a reward can be redeemed is
 * the server's call (plan D6): each card arrives with `eligibility {ok, code, params}`, and
 * this file only turns the code into words, in the language on screen, and works out the
 * numbers the limit card and the confirm sheet draw.
 */

export type RewardsOut = Schemas["RewardsOut"];
export type RewardOut = Schemas["RewardOut"];
export type Limits = Schemas["LimitsOut"];
export type Eligibility = Schemas["Eligibility"];
export type EligibilityCode = NonNullable<Eligibility["code"]>;
export type MyRequest = Schemas["MyRequestOut"];
export type RequestStatus = MyRequest["status"];
export type RedeemResult = Schemas["RedeemResult"];

/** The checks in the spec's order ("Redeeming rewards"); the first that fails is the reason. */
export const ELIGIBILITY_CODES = [
  "locked_tier",
  "locked_badge",
  "reward_limit",
  "monthly_rewards_used",
  "monthly_coin_cap",
  "coins_short",
  "store_budget_used",
] as const satisfies readonly EligibilityCode[];

export function isEligibilityCode(value: unknown): value is EligibilityCode {
  return typeof value === "string" && (ELIGIBILITY_CODES as readonly string[]).includes(value);
}

/** An owner-typed name in the language on screen: Spanish when there is one (plan G8). */
export function localized(english: string, spanish: string | null | undefined, locale: string): string {
  return locale === "es" && spanish ? spanish : english;
}

export function rewardName(item: { name: string; name_es?: string | null }, locale: string): string {
  return localized(item.name, item.name_es, locale);
}

export function rewardDescription(
  item: { description: string; description_es?: string | null },
  locale: string,
): string {
  return localized(item.description, item.description_es, locale);
}

type Params = Record<string, unknown>;

function text(params: Params, key: string): string {
  const value = params[key];
  return typeof value === "string" ? value : "";
}

function number(params: Params, key: string): number | null {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Why Redeem is off, as a catalog key and its values. */
export interface Reason {
  key: string;
  values?: Values;
  /** A tier or badge lock: drawn with a padlock, and waiting won't open it. */
  locked: boolean;
}

const UNAVAILABLE: Reason = { key: "rewards.reasons.unavailable", locked: false };

/**
 * The first failing check as words (CR-25): "Unlocks at Gold", "75 more coins to go"... Null
 * when the reward can be redeemed. A code this app has never heard of, or one that arrives
 * without its number, still says something true rather than a sentence with a hole in it.
 */
export function eligibilityReason(eligibility: Pick<Eligibility, "ok" | "code" | "params">, locale: string): Reason | null {
  if (eligibility.ok) return null;
  const params: Params = eligibility.params ?? {};
  const key = (code: EligibilityCode) => `rewards.reasons.${code}`;
  const code: string | null = eligibility.code;
  switch (code) {
    case "locked_tier": {
      const tier = localized(text(params, "tier_name"), text(params, "tier_name_es"), locale);
      return tier ? { key: key(code), values: { tier }, locked: true } : { ...UNAVAILABLE, locked: true };
    }
    case "locked_badge": {
      const badge = localized(text(params, "badge_name"), text(params, "badge_name_es"), locale);
      return badge ? { key: key(code), values: { badge }, locked: true } : { ...UNAVAILABLE, locked: true };
    }
    case "reward_limit": {
      const limit = number(params, "limit");
      return limit === null ? UNAVAILABLE : { key: key(code), values: { count: limit }, locked: false };
    }
    case "monthly_rewards_used": {
      const max = number(params, "max");
      return max === null ? UNAVAILABLE : { key: key(code), values: { count: max }, locked: false };
    }
    case "monthly_coin_cap": {
      const max = number(params, "max");
      return max === null ? UNAVAILABLE : { key: key(code), values: { max: formatCount(max, locale) }, locked: false };
    }
    case "coins_short": {
      const short = number(params, "short");
      return short === null
        ? UNAVAILABLE
        : { key: key(code), values: { count: short, amount: formatCount(short, locale) }, locked: false };
    }
    case "store_budget_used":
      return { key: key(code), locked: false };
    default:
      return UNAVAILABLE;
  }
}

/** The reason under a card's Redeem button, or null when it can be redeemed. */
export function reasonText(t: Translator, eligibility: Pick<Eligibility, "ok" | "code" | "params">): string | null {
  const reason = eligibilityReason(eligibility, t.locale);
  return reason ? t(reason.key, reason.values) : null;
}

export interface LimitView {
  coinsUsed: number;
  coinsMax: number;
  /** How full the coin bar is, 0 to 1. A cap of 0 leaves nothing to spend: a full bar. */
  coinsFraction: number;
  rewardsUsed: number;
  rewardsMax: number;
}

/** CR-24's card: coins redeemed of the monthly cap (the bar) and rewards of the count. */
export function limitView(limits: Pick<Limits, "coins_redeemed" | "max_coins" | "rewards_redeemed" | "max_rewards">): LimitView {
  const coinsUsed = Math.max(0, limits.coins_redeemed);
  const coinsMax = Math.max(0, limits.max_coins);
  const fraction = coinsMax > 0 ? coinsUsed / coinsMax : 1;
  return {
    coinsUsed,
    coinsMax,
    coinsFraction: Math.min(1, Math.max(0, fraction)),
    rewardsUsed: Math.max(0, limits.rewards_redeemed),
    rewardsMax: Math.max(0, limits.max_rewards),
  };
}

export interface AfterRedeem {
  balance: number;
  rewardsUsed: number;
  rewardsMax: number;
}

/** CR-26: the balance and this month's reward count once this one is redeemed. */
export function afterRedeem(
  balance: number,
  limits: Pick<Limits, "rewards_redeemed" | "max_rewards">,
  cost: number,
): AfterRedeem {
  return {
    balance: Math.max(0, balance - Math.max(0, cost)),
    rewardsUsed: Math.max(0, limits.rewards_redeemed) + 1,
    rewardsMax: Math.max(0, limits.max_rewards),
  };
}

export type Approver = MyRequest["approver"];

/**
 * CR-26: what the confirm sheet says happens next, from the catalogue's `approval` (the
 * owners' setting): it waits for approval, or it is ready to collect straight away.
 */
export function nextStepKey(approval: boolean): string {
  return approval ? "rewards.confirmApproval" : "rewards.confirmReady";
}

/**
 * Who decides a request, as the server routed it when it was made (`approver`): the store's
 * GM for crew and shift managers, the owners for a GM's own, a supervisor's or a director's
 * (MG-09, plan G7). The app never works this out from a role.
 */
export function approverKey(approver: Approver): string {
  const value: string = approver;
  return value === "owner" ? "rewards.approver.owner" : "rewards.approver.gm";
}

/** The answer's words for a request now waiting: who has it. */
export function pendingLeadKey(approver: Approver): string {
  const value: string = approver;
  return value === "owner" ? "rewards.pendingLead.owner" : "rewards.pendingLead.gm";
}

/** CR-27's words for a request: "Waiting for approval", "Ready to collect"... */
export function statusKey(request: Pick<MyRequest, "status" | "cost">): string {
  const status: string = request.status;
  switch (status) {
    case "pending":
      return "rewards.status.pending";
    case "approved":
      return "rewards.status.approved";
    case "collected":
      return "rewards.status.collected";
    case "cancelled":
      return "rewards.status.cancelled";
    case "declined":
      // A free prize has nothing to give back.
      return request.cost > 0 ? "rewards.status.declined" : "rewards.status.declinedFree";
    default:
      return "rewards.status.other";
  }
}

/** The pill's colours for a status: waiting amber, ready mint, collected sky, the rest grey. */
export function statusTone(status: RequestStatus): PillStatus {
  const value: string = status;
  switch (value) {
    case "pending":
      return "pending";
    case "approved":
      return "approved";
    case "collected":
      return "info";
    default:
      return "declined";
  }
}

/** MG-07: a recent decision says Approved or Declined (one collected since was approved). */
export function decisionKey(status: RequestStatus): string {
  const value: string = status;
  switch (value) {
    case "approved":
    case "collected":
      return "approvals.decisionApproved";
    case "declined":
      return "approvals.decisionDeclined";
    default:
      return statusKey({ status, cost: 0 });
  }
}

/** The owner picks a reward's glyph by name; these are the ones the prototype draws. */
const REWARD_ICONS = {
  burger: "burger",
  cup: "cup",
  calendar: "calendar",
  gift: "gift",
  shirt: "shirt",
  sun: "sun",
  fries: "fries",
  star: "star",
} as const satisfies Record<string, IconName>;

export type RewardIconName = (typeof REWARD_ICONS)[keyof typeof REWARD_ICONS];

/** A reward's glyph, or the gift for a name this app doesn't draw. */
export function rewardIcon(name: string): RewardIconName {
  // Own keys only: "constructor" or "toString" is no glyph.
  return Object.prototype.hasOwnProperty.call(REWARD_ICONS, name)
    ? REWARD_ICONS[name as keyof typeof REWARD_ICONS]
    : "gift";
}
