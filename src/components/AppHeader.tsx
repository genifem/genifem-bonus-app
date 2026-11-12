import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Avatar, colors, Icon, minTouchTarget, T, Touchable } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useMe } from "@/lib/me";
import { useRoutes } from "@/lib/routes";

/** The small wordmark (`.m-logo b`): a red star and the name. */
export function Wordmark() {
  const { t } = useAuth();
  return (
    <View style={styles.wordmark} accessibilityRole="header" accessible accessibilityLabel={t("common.appName")}>
      <Icon name="star" size={18} color={colors.brand} filled stroke={1} />
      <T size={18} weight={900} tracking={-0.4}>
        {t("common.appName").toLowerCase()}
      </T>
      <View style={styles.wordmarkDot} />
    </View>
  );
}

/**
 * The top of every tab (CR-10, `.m-head`): the wordmark over the person's store, the bell
 * with a dot while anything is unread (it opens the notifications), and their initials,
 * which open the profile. The operator logo joins it once the operator sends one (G16).
 */
export function AppHeader() {
  const { t, me } = useAuth();
  const { summary } = useMe();
  const router = useRouter();
  const routes = useRoutes();
  const unread = summary?.unread_notifications ?? 0;
  // Supervisors and directors have no one store: their area stands in.
  const place = me?.store
    ? t("header.store", { number: me.store.number, name: me.store.name })
    : (me?.area?.name ?? "");

  return (
    <View style={styles.head}>
      <View style={styles.logo}>
        <Wordmark />
        {place ? (
          <T size={11} weight={700} color={colors.muted} numberOfLines={1}>
            {place}
          </T>
        ) : null}
      </View>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={
          unread > 0 ? t("header.notificationsUnread", { count: unread }) : t("header.notifications")
        }
        onPress={() => router.push(routes.notifications)}
        style={styles.iconButton}
      >
        <Icon name="bell" size={21} />
        {unread > 0 ? <View style={styles.dot} /> : null}
      </Touchable>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={t("header.profile")}
        onPress={() => router.navigate(routes.profile)}
        style={styles.iconButton}
      >
        <Avatar name={me?.name ?? ""} seed={me?.id} size={34} />
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  logo: { flex: 1, minWidth: 0 },
  wordmark: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 28 },
  wordmarkDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand, marginTop: 8 },
  iconButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: minTouchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 9,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.background,
  },
});
