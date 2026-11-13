import { Redirect } from "expo-router";
import { type ReactNode, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Mascot } from "@/components/Mascot";
import { Body, Button, Card, colors, OfflineState, Page, T } from "@/components/ui";
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
 * Opened with a saved session but no connection, on a phone that has never kept this
 * person's profile (auth.tsx): the welcome screen would look like being signed out, so this
 * waits calmly instead. Retry reads the session again; so does coming back to the app.
 */
export function OfflineStart() {
  const { reload } = useAuth();
  return (
    <Page bottomInset>
      <Body fill top={26} style={{ justifyContent: "center" }}>
        <View style={{ alignItems: "center" }}>
          <Mascot pose="wave" size={120} />
        </View>
        <OfflineState onRetry={() => void reload()} />
      </Body>
    </Page>
  );
}

/**
 * Signed in at a company the platform has paused (403 `tenant_suspended`, P7): one calm
 * screen over the whole app, in place of the stack, so no tab, deep link or tapped push gets
 * past it. The session is kept, since nothing about the person changed; "Check again" reads
 * it again (so does coming back to the app), and signing out keeps the company, as always.
 */
export function CompanyPaused() {
  const { t, company, reload, signOut } = useAuth();
  const [busy, setBusy] = useState<"retry" | "signOut" | null>(null);
  const run = async (what: "retry" | "signOut", action: () => Promise<void>) => {
    if (busy) return;
    setBusy(what);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  };
  return (
    <Page bottomInset>
      <Body fill top={26} gap={14} style={{ justifyContent: "center" }}>
        <View style={{ alignItems: "center" }}>
          <Mascot pose="happy" size={120} />
        </View>
        <Card padding={20}>
          <View accessibilityLiveRegion="polite" style={styles.paused}>
            {company?.name ? (
              <T size={13} weight={800} color={colors.muted} align="center">
                {company.name}
              </T>
            ) : null}
            <T size={20} weight={900} align="center" heading>
              {t("company.pausedTitle")}
            </T>
            <T size={14} weight={700} align="center">
              {t("errors.tenant_suspended")}
            </T>
            <T size={13} color={colors.muted} align="center">
              {t("company.pausedLead")}
            </T>
          </View>
        </Card>
        <Button
          title={t("company.pausedRetry")}
          variant="soft"
          full
          busy={busy === "retry"}
          disabled={busy === "signOut"}
          onPress={() => void run("retry", reload)}
        />
        <Button
          title={t("common.signOut")}
          variant="ghost"
          full
          busy={busy === "signOut"}
          disabled={busy === "retry"}
          onPress={() => void run("signOut", signOut)}
        />
      </Body>
    </Page>
  );
}

/**
 * The way into a tab group. Nobody signed in goes to the welcome screen; someone signed in to
 * the other group is sent there: a GM to the manager tabs, everyone else to the crew tabs
 * (plan §8, role from `/me`).
 */
export function RoleGate({ group, children }: { group: "crew" | "manager"; children: ReactNode }) {
  const { ready, company, me } = useAuth();
  if (!ready) return <Waiting />;
  if (!company) return <Redirect href="/company" />;
  if (!me) return <Redirect href="/welcome" />;
  const home = homeGroupFor(me);
  if (home !== group) return <Redirect href={home === "manager" ? "/(manager)/(tabs)" : "/(crew)/(tabs)"} />;
  return <>{children}</>;
}

/**
 * The screens for someone not signed in (welcome, sign-in, setup), at a company. Once a
 * sign-in lands, the session reloads and this sends the person on to their tabs, so those
 * screens never have to navigate after a success themselves; with no company yet they wait
 * behind the company screen.
 */
export function SignedOutOnly({ children }: { children: ReactNode }) {
  const { ready, company, me } = useAuth();
  if (!ready) return <Waiting />;
  if (!company) return <Redirect href="/company" />;
  if (me) return <Redirect href={homeGroupFor(me) === "manager" ? "/(manager)/(tabs)" : "/(crew)/(tabs)"} />;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  paused: { alignItems: "center", gap: 8 },
});
