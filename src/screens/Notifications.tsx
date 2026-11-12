import type { Schemas } from "@crewstars/api-client";
import { useRouter } from "expo-router";
import { memo, useEffect, useRef } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { CoinPill } from "@/components/Coin";
import { Mascot } from "@/components/Mascot";
import {
  colors,
  EmptyState,
  ErrorState,
  gutter,
  Icon,
  maxWidth,
  radius,
  ScreenHeader,
  ScreenTitle,
  Skeleton,
  T,
  TextLink,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { explain } from "@/lib/errors";
import { useMe } from "@/lib/me";
import { notificationIcon, type NotificationOut, notificationText } from "@/lib/notifications";
import { useRoutes } from "@/lib/routes";
import { timeAgo } from "@/lib/time";
import { useFeed } from "@/lib/useFeed";
import { useNow } from "@/lib/useNow";

type ReadAllOut = Schemas["ReadAllOut"];

/** One notification, written from its type and params in the language on screen (plan D14).
 *  Unread ones are bolder, on a red-soft tile, and say "New" to a screen reader. */
const NotificationRow = memo(function NotificationRow({
  item,
  now,
  first,
  last,
}: {
  item: NotificationOut;
  now: number;
  first: boolean;
  last: boolean;
}) {
  const { t } = useAuth();
  const text = notificationText(t, item);
  const unread = !item.read;
  const label = [
    unread ? t("notifications.unreadA11y", { text }) : text,
    item.coins ? t("common.plusCoins", { count: item.coins }) : null,
    timeAgo(t, item.created_at, now, true),
  ]
    .filter(Boolean)
    .join(". ");
  return (
    <View accessible accessibilityLabel={label} style={[styles.row, first && styles.rowFirst, last && styles.rowLast]}>
      <View style={[styles.inner, !last && styles.divider]}>
        <View style={[styles.icon, { backgroundColor: unread ? colors.brandSubtle : colors.surface }]}>
          <Icon name={notificationIcon(item)} size={17} color={colors.brand} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T size={14} weight={unread ? 900 : 700}>
            {text}
          </T>
          <T size={11} color={colors.muted}>
            {timeAgo(t, item.created_at, now)}
          </T>
        </View>
        {item.coins ? <CoinPill amount={item.coins} plus label={t("common.plusCoins", { count: item.coins })} /> : null}
      </View>
    </View>
  );
});

/**
 * Notifications (CR-37), pushed over the tabs from the bell. Newest first, a page at a time.
 * Opening it marks everything read, once the first page is on screen, so the rows that were
 * new still look new for this visit; the bell's dot clears at once.
 */
export function Notifications() {
  const { t } = useAuth();
  const router = useRouter();
  const routes = useRoutes();
  const insets = useSafeAreaInsets();
  const { patch, refresh: refreshMe } = useMe();
  const now = useNow();
  const feed = useFeed<NotificationOut>("/me/notifications");
  const marked = useRef(false);

  const shown = !feed.loading && !feed.error;
  useEffect(() => {
    if (!shown || marked.current) return;
    marked.current = true;
    void (async () => {
      try {
        const result = await api<ReadAllOut>("/me/notifications/read-all", { method: "POST" });
        patch({ unread_notifications: result.unread });
      } catch {
        // The dot stays, and the next visit tries again: nothing here depends on it.
      } finally {
        void refreshMe();
      }
    })();
  }, [shown, patch, refreshMe]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(routes.home));
  const count = feed.items.length;

  let empty;
  if (feed.loading) {
    empty = <Skeleton height={240} />;
  } else if (feed.error) {
    empty = (
      <View style={{ gap: 16 }}>
        <ErrorState
          message={`${t("notifications.loadError")} ${explain(t, feed.error)}`}
          retryLabel={t("common.retry")}
          onRetry={() => void feed.reload()}
          error={feed.error}
        />
      </View>
    );
  } else {
    empty = (
      <EmptyState
        art={<Mascot pose="happy" size={90} />}
        title={t("notifications.emptyTitle")}
        lead={t("notifications.emptyLead")}
      />
    );
  }

  let footer = null;
  if (feed.loadingMore) {
    footer = (
      <View style={styles.footer} accessible accessibilityLabel={t("common.loading")}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  } else if (feed.moreError) {
    footer = (
      <View style={[styles.footer, { gap: 4 }]}>
        <T size={13} color={colors.muted} align="center">
          {t("notifications.moreError")}
        </T>
        <TextLink title={t("common.retry")} role="button" onPress={() => void feed.loadMore()} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.page}>
      <FlatList
        data={feed.loading ? [] : feed.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <NotificationRow item={item} now={now} first={index === 0} last={index === count - 1} />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader onBack={back} />
            <ScreenTitle title={t("notifications.title")} />
          </View>
        }
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]}
        onEndReached={() => {
          if (!feed.moreError) void feed.loadMore();
        }}
        onEndReachedThreshold={0.6}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth, alignSelf: "center", paddingHorizontal: gutter, paddingTop: 8, flexGrow: 1 },
  header: { gap: 12, paddingBottom: 16 },
  // The rows read as one card (`.card` around the list), drawn a row at a time so the list
  // stays virtualized.
  row: {
    backgroundColor: colors.raised,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
  },
  rowFirst: { borderTopWidth: 1, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, paddingTop: 4 },
  rowLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
    paddingBottom: 4,
  },
  inner: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  footer: { paddingVertical: 18, alignItems: "center" },
});
