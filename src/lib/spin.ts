import type { Schemas } from "@crewstars/api-client";
import type { Values } from "@crewstars/i18n";

import { formatCount } from "@/lib/format";
import { localized } from "@/lib/rewards";
import { isSegment } from "@/lib/wheel";

/**
 * Spin the wheel as the app shows it (CR-12, CR-28 to CR-31; plan D19). The server decides
 * everything that matters: whether spins are on, how many are ready, what was won. This file
 * turns its answers into words in the language on screen, and works out the numbers the
 * progress bar and the Home tile draw.
 */

export type WheelOut = Schemas["WheelOut"];
export type PrizeOut = Schemas["PrizeOut"];
export type SpinResult = Schemas["SpinResult"];
export type SpinRules = Schemas["SpinRulesOut"];

/** A message as a catalog key and its values, so it is said in whichever language is on. */
export interface Message {
  key: string;
  values?: Values;
}

/** A prize's label in the language on screen: the Spanish one when there is one (plan G8). */
export function prizeLabel(prize: Pick<PrizeOut, "label" | "label_es">, locale: string): string {
  return localized(prize.label, prize.label_es, locale);
}

/** Where the result sheet can take them next: My rewards for an item to collect, Profile for
 *  the badge. */
export type PrizeAction = "myRewards" | "profile" | null;

export interface Outcome extends Message {
  action: PrizeAction;
}

/**
 * CR-30: what happens next for each kind of prize. Coins are already in the balance, extra
 * kudos are this month's to give, an item waits in My rewards ready to collect, and the
 * Lucky Star badge is on the profile. A kind this app doesn't know is still a win.
 */
export function prizeOutcome(prize: Pick<PrizeOut, "kind" | "amount">, locale: string): Outcome {
  const kind: string = prize.kind;
  const amount = Math.max(0, prize.amount);
  switch (kind) {
    case "coins":
      return { key: "spin.won.coins", values: { count: amount, amount: formatCount(amount, locale) }, action: null };
    case "kudos":
      return { key: "spin.won.kudos", values: { count: amount, amount: formatCount(amount, locale) }, action: null };
    case "item":
      return { key: "spin.won.item", action: "myRewards" };
    case "badge":
      return { key: "spin.won.badge", action: "profile" };
    default:
      return { key: "spin.won.other", action: null };
  }
}

/**
 * Whether the app can turn the wheel on screen to the result: the same prize list (the
 * server's `prizes_version`) and a segment it has. When an owner edited the prizes since the
 * wheel loaded, the app loads it again first; if it still doesn't match, the result is shown
 * without the animation rather than landing on the wrong prize.
 */
export function canLand(
  wheel: Pick<WheelOut, "prizes_version" | "prizes"> | null,
  result: Pick<SpinResult, "prizes_version" | "segment_index">,
): boolean {
  return (
    !!wheel &&
    wheel.prizes_version === result.prizes_version &&
    isSegment(result.segment_index, wheel.prizes.length)
  );
}

/** Whether the result was drawn on a different prize list from the one on screen. */
export function wheelChanged(
  wheel: Pick<WheelOut, "prizes_version">,
  result: Pick<SpinResult, "prizes_version">,
): boolean {
  return wheel.prizes_version !== result.prizes_version;
}

export interface SpinProgress {
  /** The bar is drawn: spins come from coins, and this month's cap isn't reached. */
  show: boolean;
  /** How full the bar is, 0 to 1. */
  fraction: number;
  /** Coins still to earn for the next spin (never below one while coins earn spins). */
  toGo: number;
  earned: number;
  max: number;
  /** This month's spins are all earned. */
  capped: boolean;
}

/**
 * CR-31's progress to the next spin. Leftover coins carry over, so `progress` is coins toward
 * the next one. An owner who lowers "every N coins" mid-month can leave progress past N; the
 * next coin earned then grants it, so one coin is still to go.
 */
export function spinProgress(
  wheel: Pick<WheelOut, "progress" | "spins_earned"> & { rules: Pick<SpinRules, "every_coins" | "max_per_month"> },
): SpinProgress {
  const every = Math.max(0, wheel.rules.every_coins);
  const max = Math.max(0, wheel.rules.max_per_month);
  const earned = Math.max(0, wheel.spins_earned);
  const progress = Math.max(0, wheel.progress);
  const capped = earned >= max;
  return {
    show: every > 0 && !capped,
    fraction: every > 0 ? Math.min(1, progress / every) : 0,
    toGo: every > 0 ? Math.max(1, every - progress) : 0,
    earned,
    max,
    capped,
  };
}

export type RuleId = "coins" | "badge" | "milestone" | "cap";

export interface RuleLine extends Message {
  id: RuleId;
}

/**
 * CR-31: "How you earn spins" lists only the rules the owners have turned on, then the
 * monthly cap.
 */
export function ruleLines(rules: SpinRules, locale: string): RuleLine[] {
  const lines: RuleLine[] = [];
  const every = Math.max(0, rules.every_coins);
  if (every > 0) {
    lines.push({ id: "coins", key: "spin.rules.coins", values: { count: every, amount: formatCount(every, locale) } });
  }
  if (rules.on_badge) lines.push({ id: "badge", key: "spin.rules.badge" });
  if (rules.on_milestone) lines.push({ id: "milestone", key: "spin.rules.milestone" });
  lines.push({ id: "cap", key: "spin.rules.cap", values: { count: Math.max(0, rules.max_per_month) } });
  return lines;
}

export interface TileText {
  title: Message;
  lead: Message;
}

/**
 * CR-12's Spin tile: "N spins ready" when there are some. Otherwise the most useful status:
 * the coins to the next spin, or that this month's spins are all earned, or how else spins
 * come when coins don't earn them.
 */
export function spinTile(
  wheel: Pick<WheelOut, "spins_available" | "spins_earned" | "progress" | "rules">,
  locale: string,
): TileText {
  const ready = Math.max(0, wheel.spins_available);
  if (ready > 0) return { title: { key: "spin.ready", values: { count: ready } }, lead: { key: "spin.tile.tap" } };
  const title: Message = { key: "spin.spin" };
  const { rules } = wheel;
  const progress = spinProgress(wheel);
  if (progress.max === 0) return { title, lead: { key: "spin.tile.none" } };
  if (progress.capped) return { title, lead: { key: "spin.tile.allEarned", values: { count: progress.max } } };
  if (rules.every_coins > 0) {
    return {
      title,
      lead: { key: "spin.toGo", values: { count: progress.toGo, amount: formatCount(progress.toGo, locale) } },
    };
  }
  if (rules.on_badge) return { title, lead: { key: "spin.tile.byBadges" } };
  if (rules.on_milestone) return { title, lead: { key: "spin.tile.byMilestones" } };
  return { title, lead: { key: "spin.tile.noRules" } };
}

/** The Spin button's words: spinning, nothing to spin, or the invitation. */
export function spinButtonKey(state: { spinning: boolean; ready: number }): string {
  if (state.spinning) return "spin.spinning";
  return state.ready > 0 ? "spin.spin" : "spin.noSpins";
}

/** Every tap on Spin is the same kind of intent; only an unanswered one is retried with its
 *  key (plan D13), so a spin that landed while the connection dropped comes back as itself. */
export const SPIN_INTENT = "spin";
