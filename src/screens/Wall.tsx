import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { Mascot } from "@/components/Mascot";
import { PostCard, type PostOut } from "@/components/PostCard";
import {
  Alert,
  Button,
  colors,
  EmptyState,
  ErrorState,
  gutter,
  Icon,
  maxWidth,
  minTouchTarget,
  ScreenTitle,
  Segmented,
  Sheet,
  Skeleton,
  T,
  TextLink,
  Touchable,
  useToast,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { explain } from "@/lib/errors";
import { useMe, useMeRefreshOnFocus } from "@/lib/me";
import { useRefreshOnFocus } from "@/lib/useApi";
import { useFeed } from "@/lib/useFeed";
import { useLikes } from "@/lib/useLikes";
import { useNow } from "@/lib/useNow";

type Filter = "everyone" | "for_you";

function Gap() {
  return <View style={{ height: 12 }} />;
}

/**
 * The ⋯ menu on a post the GM may hide (NF-06, plan G3): "Hide post", then a confirmation
 * that says what happens. The post leaves the wall for everyone; the coins stay where they
 * went.
 */
function HidePostSheet({
  post,
  onClose,
  onHidden,
}: {
  post: PostOut | null;
  onClose: () => void;
  onHidden: (id: string) => void;
}) {
  const { t } = useAuth();
  const [openFor, setOpenFor] = useState(post);
  const [shown, setShown] = useState(post);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Every opening starts at the menu. The last post stays drawn while the sheet slides away.
  if (post !== openFor) {
    setOpenFor(post);
    if (post) {
      setShown(post);
      setConfirming(false);
      setProblem(null);
    }
  }

  const hide = async () => {
    if (!shown || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await api<void>(`/shoutouts/${encodeURIComponent(shown.id)}/hide`, { method: "POST" });
      onHidden(shown.id);
      onClose();
    } catch (err) {
      // Already gone (hidden from the portal meanwhile): take it off this wall too.
      if (err instanceof ApiError && err.code === "not_found") {
        onHidden(shown.id);
        onClose();
      } else {
        setProblem(explain(t, err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={!!post}
      onClose={onClose}
      label={confirming ? t("post.hideTitle") : t("post.optionsTitle")}
      closeLabel={t("common.close")}
      title={confirming ? t("post.hideTitle") : t("post.optionsTitle")}
      footer={
        confirming ? (
          <>
            <Button title={t("post.hide")} busy={busy} full haptic="warning" onPress={() => void hide()} />
            <Button title={t("common.cancel")} variant="ghost" full onPress={onClose} />
          </>
        ) : undefined
      }
    >
      {confirming ? (
        <>
          <T size={14} color={colors.muted}>
            {t("post.hideLead", { name: shown?.recipient.first_name ?? "" })}
          </T>
          {problem ? <Alert>{problem}</Alert> : null}
        </>
      ) : (
        <Touchable accessibilityRole="button" onPress={() => setConfirming(true)} style={styles.menuRow}>
          <Icon name="eyeOff" size={20} color={colors.brandInk} />
          <T size={15} weight={800} color={colors.brandInk}>
            {t("post.hide")}
          </T>
        </Touchable>
      )}
    </Sheet>
  );
}

/**
 * The wall (CR-16 to CR-18), in both tab groups: Everyone (the store's shout-outs, or the
 * area's for supervisors and directors; the server decides) and For you. A flat list read
 * 20 at a time, newest first; pull down for the latest, and coming back to the tab quietly
 * lays the newest page on top.
 */
export function Wall() {
  const { t, me } = useAuth();
  const { refresh: refreshMe } = useMe();
  const toast = useToast();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("everyone");
  const [menuFor, setMenuFor] = useState<PostOut | null>(null);
  const feed = useFeed<PostOut>(`/wall?filter=${filter}`);
  const likes = useLikes({
    onSettled: () => void refreshMe(),
    onFailed: () => toast.show(t("post.likeFailed"), { icon: "info" }),
  });

  useMeRefreshOnFocus();
  const { revalidate, refresh, remove } = feed;
  const { forgetSettled } = likes;
  const onFocus = useCallback(async () => {
    await revalidate();
    forgetSettled();
  }, [revalidate, forgetSettled]);
  useRefreshOnFocus(onFocus);

  const pull = async () => {
    await refresh();
    forgetSettled();
  };

  const hidden = useCallback(
    (id: string) => {
      remove(id);
      toast.show(t("post.hidden"));
    },
    [remove, toast, t],
  );

  const forYou = filter === "for_you";

  const header = (
    <View style={styles.header}>
      <AppHeader />
      <ScreenTitle title={t("wall.title")} lead={t("wall.lead")} />
      <Segmented
        label={t("wall.filterLabel")}
        value={filter}
        onChange={setFilter}
        options={[
          { value: "everyone", label: t("wall.everyone") },
          { value: "for_you", label: t("wall.forYou") },
        ]}
      />
      {feed.error && feed.items.length > 0 ? <Alert>{explain(t, feed.error)}</Alert> : null}
    </View>
  );

  let empty;
  if (feed.loading) {
    empty = (
      <View style={{ gap: 12 }}>
        <Skeleton height={150} />
        <Skeleton height={150} />
        <Skeleton height={150} />
      </View>
    );
  } else if (feed.error) {
    empty = (
      <View style={{ gap: 16 }}>
        <ErrorState
          message={`${t("wall.loadError")} ${explain(t, feed.error)}`}
          retryLabel={t("common.retry")}
          onRetry={() => void feed.reload()}
        />
      </View>
    );
  } else {
    empty = (
      <EmptyState
        art={<Mascot pose="happy" size={90} />}
        title={forYou ? t("wall.emptyForYouTitle") : t("wall.emptyTitle")}
        lead={forYou ? t("wall.emptyForYouLead") : t("wall.emptyLead")}
      />
    );
  }

  let footer = null;
  if (feed.loadingMore) {
    footer = (
      <View style={styles.footer} accessible accessibilityLabel={t("wall.loadingMore")}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  } else if (feed.moreError) {
    footer = (
      <View style={[styles.footer, { gap: 4 }]}>
        <T size={13} color={colors.muted} align="center">
          {t("wall.moreError")}
        </T>
        <TextLink title={t("common.retry")} role="button" onPress={() => void feed.loadMore()} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.page}>
      <FlatList
        data={feed.loading ? [] : feed.items}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => {
          const like = likes.view(item);
          return (
            <PostCard
              post={item}
              meId={me?.id}
              now={now}
              liked={like.liked}
              likes={like.count}
              onLike={likes.toggle}
              onMore={item.can_hide ? setMenuFor : undefined}
            />
          );
        }}
        extraData={likes.view}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        contentContainerStyle={styles.content}
        onEndReached={() => {
          if (!feed.moreError) void feed.loadMore();
        }}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl
            refreshing={feed.refreshing}
            onRefresh={() => void pull()}
            tintColor={colors.brand}
            colors={[colors.brand]}
            progressBackgroundColor={colors.raised}
          />
        }
      />
      <HidePostSheet post={menuFor} onClose={() => setMenuFor(null)} onHidden={hidden} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: {
    width: "100%",
    maxWidth,
    alignSelf: "center",
    paddingHorizontal: gutter,
    paddingTop: 18,
    paddingBottom: 28,
    flexGrow: 1,
  },
  header: { gap: 16, paddingBottom: 16 },
  footer: { paddingVertical: 18, alignItems: "center" },
  menuRow: {
    minHeight: minTouchTarget + 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
  },
});
