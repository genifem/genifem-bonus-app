import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Mascot, type MascotPose } from "@/components/Mascot";
import { Body, colors, EmptyState, Icon, Page, ScreenTitle, T } from "@/components/ui";
import { useAuth } from "@/lib/auth";

/** The small wordmark at the top of every tab (`.m-head .m-logo`): a red star and the name. */
export function Wordmark() {
  const { t } = useAuth();
  return (
    <View style={styles.wordmark} accessibilityRole="header" accessible accessibilityLabel={t("common.appName")}>
      <Icon name="star" size={18} color={colors.brand} filled stroke={1} />
      <T size={18} weight={900} tracking={-0.4}>
        {t("common.appName").toLowerCase()}
      </T>
      <View style={styles.dot} />
    </View>
  );
}

/**
 * A tab that is not built yet: its real title from the prototype, and the mascot saying the
 * screen arrives in a later phase. `children` sit under the empty state (the profile's
 * language switch and sign-out).
 */
export function PlaceholderTab({
  title,
  lead,
  pose = "wave",
  children,
}: {
  title: string;
  lead?: string;
  pose?: MascotPose;
  children?: ReactNode;
}) {
  const { t } = useAuth();
  return (
    <Page>
      <Body>
        <Wordmark />
        <ScreenTitle title={title} lead={lead} />
        <EmptyState art={<Mascot pose={pose} size={110} />} title={t("soon.title")} lead={t("soon.lead")} />
        {children}
      </Body>
    </Page>
  );
}

const styles = StyleSheet.create({
  wordmark: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 40 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand, marginTop: 8 },
});
