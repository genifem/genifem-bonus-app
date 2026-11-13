import type { Schemas } from "@crewstars/api-client";

/**
 * Which part of the app a phone may be in, worked out from what the session knows. The root
 * stack guards its screens with this (app/_layout.tsx), so a deep link or a tapped push can
 * only reach a screen its guard allows, and nothing has to navigate after a change: when a
 * guard turns off, the stack drops its screens and opens the first one still allowed.
 *
 * Kept apart from auth.tsx, which holds the session, so the rules are tested without it.
 */

/** The tab group a signed-in person belongs to: GMs get the manager tabs, everyone else the
 *  crew tabs (CR-08, plan §8). */
export function homeGroupFor(me: Pick<Schemas["MeOut"], "role">): "manager" | "crew" {
  return me.role === "gm" ? "manager" : "crew";
}

export type Place =
  /** The saved session (and company) are still being read: the splash screen stays up. */
  | "loading"
  /** No company chosen yet, or it was let go: the company code screen and nothing else. */
  | "company"
  /** Signed in at a company that is paused: one full screen, with sign-out (P7). */
  | "paused"
  /** A saved session but no connection, on a phone that never kept the profile (OfflineStart). */
  | "offline"
  /** A company, nobody signed in: welcome, sign-in and setup (the texted-code flows). */
  | "signedOut"
  /** Signed in: the person's own tab group. */
  | "crew"
  | "manager";

export interface PlaceInput {
  ready: boolean;
  /** The company code in use, if any. */
  company: string | null;
  me: Pick<Schemas["MeOut"], "role"> | null;
  offline: boolean;
  paused: boolean;
}

/**
 * In order: nothing until the session is read; no company, the company screen (a session
 * never outlives its company, so this comes before everything else); a paused company, the
 * paused screen; then signed out, or the person's own tabs, as before P7.
 */
export function placeFor({ ready, company, me, offline, paused }: PlaceInput): Place {
  if (!ready) return "loading";
  if (!company) return "company";
  if (paused) return "paused";
  if (!me) return offline ? "offline" : "signedOut";
  return homeGroupFor(me);
}
