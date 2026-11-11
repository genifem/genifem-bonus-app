import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";

import { colors } from "@/components/ui";
import { homeGroupFor, useAuth } from "@/lib/auth";

/** While the session is read: the page colour and a status for screen readers, not a
 *  spinner on a full screen. */
export function Waiting() {
  const { t } = useAuth();
  return (
    <View
      accessible
      accessibilityLabel={t("common.loading")}
      accessibilityLiveRegion="polite"
      style={{ flex: 1, backgroundColor: colors.background }}
    />
  );
}

/**
 * The way into a tab group. Nobody signed in goes to the welcome screen; someone signed in to
 * the other group is sent there: a GM to the manager tabs, everyone else to the crew tabs
 * (plan §8, role from `/me`).
 */
export function RoleGate({ group, children }: { group: "crew" | "manager"; children: ReactNode }) {
  const { ready, me } = useAuth();
  if (!ready) return <Waiting />;
  if (!me) return <Redirect href="/welcome" />;
  const home = homeGroupFor(me);
  if (home !== group) return <Redirect href={home === "manager" ? "/(manager)/(tabs)" : "/(crew)/(tabs)"} />;
  return <>{children}</>;
}

/**
 * The screens for someone not signed in (welcome, sign-in, setup). Once a sign-in lands, the
 * session reloads and this sends the person on to their tabs, so those screens never have to
 * navigate after a success themselves.
 */
export function SignedOutOnly({ children }: { children: ReactNode }) {
  const { ready, me } = useAuth();
  if (!ready) return <Waiting />;
  if (me) return <Redirect href={homeGroupFor(me) === "manager" ? "/(manager)/(tabs)" : "/(crew)/(tabs)"} />;
  return <>{children}</>;
}
