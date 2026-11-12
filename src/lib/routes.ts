import { homeGroupFor, useAuth } from "@/lib/auth";

/**
 * Where the shared screens link to. Wall, Give, Profile and Notifications exist in both tab
 * groups, so a bare "/wall" matches two routes; these name the signed-in person's own group,
 * so a link never lands in the other group and bounces off its gate.
 */
const CREW = {
  home: "/(crew)/(tabs)",
  wall: "/(crew)/(tabs)/wall",
  give: "/(crew)/(tabs)/give",
  profile: "/(crew)/(tabs)/profile",
  notifications: "/(crew)/notifications",
} as const;

const MANAGER = {
  home: "/(manager)/(tabs)",
  wall: "/(manager)/(tabs)/wall",
  give: "/(manager)/(tabs)/give",
  profile: "/(manager)/(tabs)/profile",
  notifications: "/(manager)/notifications",
} as const;

export type AppRoutes = typeof CREW | typeof MANAGER;

export function useRoutes(): AppRoutes {
  const { me } = useAuth();
  return me && homeGroupFor(me) === "manager" ? MANAGER : CREW;
}
