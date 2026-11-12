import type { Href } from "expo-router";

import { homeGroupFor, useAuth } from "@/lib/auth";

/**
 * Where the shared screens link to. Wall, Give, Profile and Notifications exist in both tab
 * groups, so a bare "/wall" matches two routes; these name the signed-in person's own group,
 * so a link never lands in the other group and bounces off its gate.
 *
 * Rewards is a tab for the crew, and a screen pushed from My rewards for a GM, whose tab bar
 * has Approvals in its place (MG-09).
 */
const CREW = {
  home: "/(crew)/(tabs)",
  wall: "/(crew)/(tabs)/wall",
  give: "/(crew)/(tabs)/give",
  profile: "/(crew)/(tabs)/profile",
  rewards: "/(crew)/(tabs)/rewards",
  myRewards: "/(crew)/my-rewards",
  notifications: "/(crew)/notifications",
  spin: "/(crew)/spin",
  leaderboard: "/(crew)/leaderboard",
} as const;

const MANAGER = {
  home: "/(manager)/(tabs)",
  wall: "/(manager)/(tabs)/wall",
  give: "/(manager)/(tabs)/give",
  profile: "/(manager)/(tabs)/profile",
  rewards: "/(manager)/rewards",
  myRewards: "/(manager)/my-rewards",
  notifications: "/(manager)/notifications",
  spin: "/(manager)/spin",
  leaderboard: "/(manager)/leaderboard",
} as const;

/** The GM's own places, for the screens only the manager tabs have. */
export const MANAGER_ROUTES = {
  ...MANAGER,
  approvals: "/(manager)/(tabs)/approvals",
} as const;

export type AppRoutes = typeof CREW | typeof MANAGER;

export type Group = "crew" | "manager";

export function routesFor(group: Group): AppRoutes {
  return group === "manager" ? MANAGER : CREW;
}

export function useRoutes(): AppRoutes {
  const { me } = useAuth();
  return routesFor(me ? homeGroupFor(me) : "crew");
}

/** Where a notification takes someone, and whether that is a tab (navigated to) or a screen
 *  pushed over the tabs, as every other link in the app does it. */
export interface Destination {
  href: Href;
  push: boolean;
}

/**
 * Where tapping a push lands (plan §8 "Push"), by the notification's type (D14), always in
 * the signed-in person's own group so it never meets the other group's gate:
 *
 * - a shout-out: the wall's For you list, where it is (`at` makes each tap choose the list
 *   again, even after the person moved the wall on to Everyone);
 * - a spin earned or a prize won: Spin;
 * - a badge or a tier: Profile, where the badge grid and the tier are;
 * - a reward approved or declined: My rewards;
 * - a reward request: Approvals, for a GM. Anyone else (the owners decide a GM's own
 *   request, so the crew group should never get one) lands on the list;
 * - a monthly award: the leaderboard and the month's awards;
 * - anything else, or a type this app has never heard of: the notification list.
 */
export function notificationDestination(type: string, group: Group, id?: string | null): Destination {
  const routes = routesFor(group);
  switch (type) {
    case "shoutout_received":
      return { href: { pathname: routes.wall, params: { filter: "for_you", at: id ?? "" } }, push: false };
    case "spin_earned":
    case "spin_result":
      return { href: routes.spin, push: true };
    case "badge_earned":
    case "tier_reached":
      return { href: routes.profile, push: false };
    case "reward_approved":
    case "reward_declined":
      return { href: routes.myRewards, push: true };
    case "reward_requested":
      return group === "manager"
        ? { href: MANAGER_ROUTES.approvals, push: false }
        : { href: routes.notifications, push: true };
    case "award_won":
      return { href: routes.leaderboard, push: true };
    default:
      return { href: routes.notifications, push: true };
  }
}
