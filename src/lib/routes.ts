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
} as const;

const MANAGER = {
  home: "/(manager)/(tabs)",
  wall: "/(manager)/(tabs)/wall",
  give: "/(manager)/(tabs)/give",
  profile: "/(manager)/(tabs)/profile",
  rewards: "/(manager)/rewards",
  myRewards: "/(manager)/my-rewards",
  notifications: "/(manager)/notifications",
} as const;

/** The GM's own places, for the screens only the manager tabs have. */
export const MANAGER_ROUTES = {
  ...MANAGER,
  approvals: "/(manager)/(tabs)/approvals",
} as const;

export type AppRoutes = typeof CREW | typeof MANAGER;

export function useRoutes(): AppRoutes {
  const { me } = useAuth();
  return me && homeGroupFor(me) === "manager" ? MANAGER : CREW;
}
