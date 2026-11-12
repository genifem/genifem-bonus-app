/**
 * Where a tapped push lands (plan §8 "Push"): by the notification's type, always in the
 * signed-in person's own tab group, so it never meets the other group's gate.
 */
import { notificationDestination, routesFor } from "@/lib/routes";

// The route tables need no session; the hook beside them does.
jest.mock("@/lib/auth", () => ({ useAuth: jest.fn(), homeGroupFor: jest.fn() }));

describe("a tapped push", () => {
  it("opens the wall's For you list for a shout-out, choosing that list again on each tap", () => {
    expect(notificationDestination("shoutout_received", "crew", "n1")).toEqual({
      href: { pathname: "/(crew)/(tabs)/wall", params: { filter: "for_you", at: "n1" } },
      push: false,
    });
    expect(notificationDestination("shoutout_received", "manager", null)).toEqual({
      href: { pathname: "/(manager)/(tabs)/wall", params: { filter: "for_you", at: "" } },
      push: false,
    });
  });

  it("opens Spin for a spin earned or a prize won", () => {
    for (const type of ["spin_earned", "spin_result"]) {
      expect(notificationDestination(type, "crew")).toEqual({ href: "/(crew)/spin", push: true });
      expect(notificationDestination(type, "manager")).toEqual({ href: "/(manager)/spin", push: true });
    }
  });

  it("opens the profile tab for a badge or a tier", () => {
    for (const type of ["badge_earned", "tier_reached"]) {
      expect(notificationDestination(type, "crew")).toEqual({ href: "/(crew)/(tabs)/profile", push: false });
      expect(notificationDestination(type, "manager")).toEqual({ href: "/(manager)/(tabs)/profile", push: false });
    }
  });

  it("opens My rewards for a decision on a reward", () => {
    for (const type of ["reward_approved", "reward_declined"]) {
      expect(notificationDestination(type, "crew")).toEqual({ href: "/(crew)/my-rewards", push: true });
      expect(notificationDestination(type, "manager")).toEqual({ href: "/(manager)/my-rewards", push: true });
    }
  });

  it("opens Approvals for a GM's reward request, and the list for anyone else", () => {
    expect(notificationDestination("reward_requested", "manager")).toEqual({
      href: "/(manager)/(tabs)/approvals",
      push: false,
    });
    expect(notificationDestination("reward_requested", "crew")).toEqual({ href: "/(crew)/notifications", push: true });
  });

  it("opens the leaderboard and awards for an award won", () => {
    expect(notificationDestination("award_won", "crew")).toEqual({ href: "/(crew)/leaderboard", push: true });
    expect(notificationDestination("award_won", "manager")).toEqual({ href: "/(manager)/leaderboard", push: true });
  });

  it("opens the notification list for a type this app has never heard of", () => {
    expect(notificationDestination("something_new", "crew")).toEqual({ href: "/(crew)/notifications", push: true });
    expect(notificationDestination("", "manager")).toEqual({ href: "/(manager)/notifications", push: true });
  });
});

describe("each group's places", () => {
  it("never mixes the groups", () => {
    const crew = Object.values(routesFor("crew"));
    const manager = Object.values(routesFor("manager"));
    expect(crew.every((href) => href.startsWith("/(crew)/"))).toBe(true);
    expect(manager.every((href) => href.startsWith("/(manager)/"))).toBe(true);
  });
});
