import type { Schemas } from "@crewstars/api-client";
import type { Translator } from "@crewstars/i18n";

import { formatCount } from "@/lib/format";
import { monthLabel } from "@/lib/notifications";
import { localized } from "@/lib/rewards";

/**
 * The store leaderboard (CR-35) and this month's awards (CR-36), and an award as a Wall post
 * names it. The server ranks and picks leaders; it sends a rank only inside the top 5, and
 * this file never works one out (plan C1).
 */

export type Leaderboard = Schemas["LeaderboardOut"];
export type LeaderRow = Schemas["LeaderRow"];
export type AwardsCurrent = Schemas["AwardsCurrentOut"];
export type AwardCategory = Schemas["AwardCategoryOut"];
export type AwardPerson = Schemas["AwardPersonOut"];
type Role = Schemas["PartyOut"]["role"];

/** Who is on a store's board and wins its awards: crew members and shift managers. */
const ON_BOARD: readonly string[] = ["crew", "shift"];

export function onBoard(role: Role): boolean {
  return ON_BOARD.includes(role);
}

/**
 * CR-35: someone outside the top 5 sees only their own total this month, never a rank or the
 * rest of the list. Null when they are in the top 5 (their row is highlighted instead), or
 * when they aren't on the board at all (a GM, a supervisor).
 */
export function ownTotal(board: Pick<Leaderboard, "top" | "me">, role: Role): number | null {
  if (!onBoard(role) || board.top.some((row) => row.me)) return null;
  return Math.max(0, board.me.earned);
}

export function awardName(award: { name: string; name_es?: string | null }, locale: string): string {
  return localized(award.name, award.name_es, locale);
}

/** Who has an award: the winner once it is paid, else whoever leads now, else nobody yet. */
export function awardStanding(t: Translator, category: Pick<AwardCategory, "leader" | "winner">, meId: string | undefined): string {
  const { winner, leader } = category;
  if (winner) return winner.id === meId ? t("awards.youWon") : t("awards.winner", { name: winner.name });
  if (leader) return leader.id === meId ? t("awards.leadingYou") : t("awards.leading", { name: leader.name });
  return t("awards.upForGrabs");
}

/**
 * What the leader's number means for each kind of award: coins this month (Top Earner),
 * coins more than last month (Most Improved), Guest Hero shout-outs, or shout-outs from the
 * crew (Peer Favorite).
 */
export function awardValue(t: Translator, metric: AwardCategory["metric"], value: number): string {
  const count = Math.max(0, value);
  const amount = formatCount(count, t.locale);
  const kind: string = metric;
  switch (kind) {
    case "earned":
      return t("awards.value.earned", { count, amount });
    case "improved":
      return t("awards.value.improved", { count, amount });
    case "guest":
      return t("awards.value.guest", { count, tag: t("tags.guest") });
    case "peer":
      return t("awards.value.peer", { count });
    default:
      return formatCount(count, t.locale);
  }
}

/** The person the standing names, if any: the winner, else the leader. */
export function standingPerson(category: Pick<AwardCategory, "leader" | "winner">): AwardPerson | null {
  return category.winner ?? category.leader ?? null;
}

/**
 * An award on a Wall post, in the language on screen: "November's Top Earner",
 * "Mayor ganador de noviembre". The Spanish name stands in when there is one (plan G8), and
 * without a month it is just the award's name.
 */
export function awardTitle(
  t: Translator,
  post: { award_name: string | null; award_name_es?: string | null; award_month?: string | null },
): string {
  const name = localized(post.award_name ?? "", post.award_name_es, t.locale);
  if (!name) return "";
  return post.award_month ? t("post.awardOfMonth", { award: name, month: monthLabel(post.award_month, t.locale) }) : name;
}
