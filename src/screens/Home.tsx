import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { TierChip } from "@/components/Chips";
import { Coin, CoinPill } from "@/components/Coin";
import { Floaty, Mascot } from "@/components/Mascot";
import { PostCard, type PostOut } from "@/components/PostCard";
import { SpinTile } from "@/components/SpinTile";
import {
  Body,
  Card,
  colors,
  ErrorState,
  Icon,
  Page,
  ProgressBar,
  radius,
  ScreenTitle,
  Segmented,
  Skeleton,
  T,
  TextLink,
  Touchable,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { explain } from "@/lib/errors";
import { dayMonth, firstName, formatCount } from "@/lib/format";
import { type Summary, useMe, useMeRefreshOnFocus } from "@/lib/me";
import { useRoutes } from "@/lib/routes";
import type { WheelOut } from "@/lib/spin";
import { tierName, tierProgress } from "@/lib/tiers";
import { useApi, useRefreshOnFocus } from "@/lib/useApi";
import { useLikes } from "@/lib/useLikes";
import { useNow } from "@/lib/useNow";

/**
 * The balance card (CR-11, `.balance`): earned coins on butter with the mascot holding a
 * coin, the tier, and the way to the next one, "N to go" and a bar from this tier's
 * threshold to the next. Lifetime coins drive the tier, so spending never moves the bar back.
 */
function BalanceCard({ summary }: { summary: Summary }) {
  const { t, locale } = useAuth();
  const progress = tierProgress(summary);
  const next = summary.next_tier;
  const nextName = next ? tierName(next, locale) : "";
  const unit = summary.balance === 1 ? t("common.coinOne") : t("common.coinOther");
  return (
    <View style={styles.balance}>
      <View style={styles.mascot}>
        <Floaty>
          <Mascot pose="coin" size={112} />
        </Floaty>
      </View>
      <View style={{ gap: 10 }}>
        <T size={12} weight={800} color={colors.coinInk}>
          {t("home.balanceLabel")}
        </T>
        <View
          accessible
          accessibilityLabel={t("home.balanceA11y", { count: summary.balance })}
          style={styles.amountRow}
        >
          <Coin size={34} />
          <T size={46} weight={900} tracking={-1.5} line={50} tabular maxFontSizeMultiplier={1.2}>
            {formatCount(summary.balance, locale)}
          </T>
          <T weight={800} color={colors.muted} style={{ marginBottom: 6 }}>
            {unit}
          </T>
        </View>
        <TierChip tier={summary.tier} />
        <View style={styles.divider} />
        <View style={styles.nextRow}>
          <T size={14} weight={800} style={{ flexShrink: 1 }}>
            {next ? t("home.nextTier", { tier: nextName }) : t("home.topTier")}
          </T>
          {next && progress.toGo !== null ? (
            <CoinPill
              amount={t("home.toGo", { count: formatCount(progress.toGo, locale) })}
              label={t("home.toGoA11y", { count: progress.toGo, tier: nextName })}
            />
          ) : null}
        </View>
        <ProgressBar
          value={progress.fraction}
          track={colors.raised}
          label={next ? t("home.toGoA11y", { count: progress.toGo ?? 0, tier: nextName }) : t("home.topTier")}
        />
        <T size={11} color={colors.muted} tabular>
          {progress.target !== null
            ? t("home.lifetime", {
                lifetime: formatCount(summary.lifetime, locale),
                target: formatCount(progress.target, locale),
              })
            : t("home.lifetimeTop", { lifetime: formatCount(summary.lifetime, locale) })}
        </T>
      </View>
    </View>
  );
}

/** The wheel as Home sees it: hidden while spins are off (plan D19), a placeholder until the
 *  first answer, and quietly left out if it can't be loaded. */
interface WheelState {
  data: WheelOut | null;
  loading: boolean;
}

/** CR-12 and CR-13: the Spin tile (opens Spin) and kudos left (opens Give). */
function Tiles({
  summary,
  wheel,
  onGive,
  onSpin,
}: {
  summary: Summary;
  wheel: WheelState;
  onGive: () => void;
  onSpin: () => void;
}) {
  const { t, locale } = useAuth();
  const { kudos } = summary;
  const kudosTitle = t("home.kudosTitle", { left: kudos.left, allowance: kudos.allowance });
  const kudosLead = t("home.kudosLead", { date: dayMonth(kudos.resets_on, locale) });
  return (
    <View style={styles.tiles}>
      {wheel.data?.enabled ? (
        <SpinTile wheel={wheel.data} ready={summary.spins_available} onPress={onSpin} style={{ flex: 1 }} />
      ) : wheel.loading && !wheel.data ? (
        <View style={{ flex: 1 }}>
          <Skeleton height={112} corner={radius.card} />
        </View>
      ) : null}
      <Touchable
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={`${kudosTitle}. ${kudosLead}`}
        onPress={onGive}
        style={[styles.tile, { backgroundColor: colors.successSubtle }]}
      >
        <Icon name="send" size={24} color={colors.successInk} />
        <T size={15} weight={900} line={18}>
          {kudosTitle}
        </T>
        <T size={12} color={colors.successInk} line={16}>
          {kudosLead}
        </T>
      </Touchable>
    </View>
  );
}

/**
 * CR-14: this month at the store, which opens the leaderboard and the month's awards (CR-35,
 * CR-36). A rank shows only in the top 5; otherwise it is the month's coins and a nudge,
 * never a low rank (C1).
 */
function MonthTile({ summary, onPress }: { summary: Summary; onPress: () => void }) {
  const { t, locale } = useAuth();
  const { store_rank: rank, earned_this_month: month } = summary;
  const monthCount = formatCount(month, locale);
  const label = rank ? t("home.rankA11y", { rank, count: month }) : t("home.monthA11y", { count: month });
  return (
    <Touchable
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`${label} ${t("home.boardLink")}`}
      onPress={onPress}
      style={styles.cta}
    >
      <View style={[styles.ctaIcon, { backgroundColor: colors.coinSubtle }]}>
        <Icon name="trophy" size={20} color={colors.coinInk} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <T size={14} weight={900}>
          {rank ? t("home.rankTitle", { rank }) : t("home.monthTitle", { count: month, amount: monthCount })}
        </T>
        <T size={12} color={colors.muted}>
          {rank ? t("home.rankLead", { count: month, amount: monthCount }) : t("home.monthLead")}
        </T>
        <T size={12} weight={800} color={colors.brandInk}>
          {t("home.boardLink")}
        </T>
      </View>
      <Icon name="chev" size={18} color={colors.brand} />
    </Touchable>
  );
}

function HomeSkeleton() {
  return (
    <>
      <Skeleton height={248} corner={radius.hero} />
      <View style={styles.tiles}>
        <View style={{ flex: 1 }}>
          <Skeleton height={112} corner={radius.card} />
        </View>
        <View style={{ flex: 1 }}>
          <Skeleton height={112} corner={radius.card} />
        </View>
      </View>
    </>
  );
}

type Direction = "received" | "sent";

/**
 * The crew's Home (CR-10 to CR-15): the header with the bell, the balance card, the Spin
 * tile and kudos, the way to Give, this month at the store (which opens the leaderboard), and
 * the latest shout-outs received and sent (4 each).
 */
export function CrewHome() {
  const { t, me } = useAuth();
  const { summary, error, refresh: refreshMe } = useMe();
  const router = useRouter();
  const routes = useRoutes();
  const now = useNow();
  const [direction, setDirection] = useState<Direction>("received");
  const [refreshing, setRefreshing] = useState(false);
  const received = useApi<PostOut[]>("/me/shoutouts?direction=received&limit=4");
  const sent = useApi<PostOut[]>("/me/shoutouts?direction=sent&limit=4");
  const wheel = useApi<WheelOut>("/spin");
  const likes = useLikes({ onSettled: () => void refreshMe() });
  const { forgetSettled } = likes;

  useMeRefreshOnFocus();
  useRefreshOnFocus(wheel.revalidate);
  const { revalidate: revalidateReceived } = received;
  const { revalidate: revalidateSent } = sent;
  const revalidateLists = useCallback(async () => {
    await Promise.all([revalidateReceived(), revalidateSent()]);
    forgetSettled();
  }, [revalidateReceived, revalidateSent, forgetSettled]);
  useRefreshOnFocus(revalidateLists);

  const pull = async () => {
    setRefreshing(true);
    await Promise.all([refreshMe(), revalidateLists(), wheel.revalidate()]);
    setRefreshing(false);
  };

  const list = direction === "received" ? received : sent;
  const posts = list.data ?? [];
  const name = me ? firstName(me.name) : "";
  const give = () => router.navigate(routes.give);
  const spin = () => router.push(routes.spin);
  const board = () => router.push(routes.leaderboard);

  return (
    <Page refreshing={refreshing} onRefresh={() => void pull()}>
      <Body>
        <AppHeader />
        <ScreenTitle title={name ? t("home.greeting", { name }) : t("home.greetingNoName")} lead={t("home.lead")} />

        {summary ? (
          <>
            <BalanceCard summary={summary} />
            <Tiles
              summary={summary}
              wheel={{ data: wheel.data, loading: wheel.loading }}
              onGive={give}
              onSpin={spin}
            />
          </>
        ) : error ? (
          <ErrorState
            message={`${t("home.loadError")} ${explain(t, error)}`}
            retryLabel={t("common.retry")}
            onRetry={() => void refreshMe()}
            error={error}
          />
        ) : (
          <HomeSkeleton />
        )}

        <Touchable
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={`${t("home.giveTitle")}. ${t("home.giveLead")}`}
          onPress={give}
          style={styles.cta}
        >
          <View style={styles.ctaIcon}>
            <Icon name="heart" size={20} color={colors.brand} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={14} weight={900}>
              {t("home.giveTitle")}
            </T>
            <T size={12} color={colors.muted}>
              {t("home.giveLead")}
            </T>
          </View>
          <Icon name="chev" size={18} color={colors.brand} />
        </Touchable>
        {summary ? <MonthTile summary={summary} onPress={board} /> : null}

        <View style={styles.section}>
          <T size={17} weight={900} heading style={{ flex: 1 }}>
            {t("home.latest")}
          </T>
          <TextLink title={t("common.seeAll")} align="flex-end" onPress={() => router.navigate(routes.wall)} />
        </View>
        <Segmented
          label={t("home.listLabel")}
          value={direction}
          onChange={setDirection}
          options={[
            { value: "received", label: t("home.received") },
            { value: "sent", label: t("home.sent") },
          ]}
        />
        {list.loading && !list.data ? (
          <>
            <Skeleton height={132} />
            <Skeleton height={132} />
          </>
        ) : list.error && !list.data ? (
          <ErrorState
            message={t("home.listError")}
            retryLabel={t("common.retry")}
            onRetry={() => void list.reload()}
            error={list.error}
            compact
          />
        ) : posts.length ? (
          posts.map((post) => {
            const like = likes.view(post);
            return (
              <PostCard
                key={post.id}
                post={post}
                meId={me?.id}
                now={now}
                liked={like.liked}
                likes={like.count}
                onLike={likes.toggle}
              />
            );
          })
        ) : (
          <Card style={styles.empty}>
            <T size={13} color={colors.muted} align="center">
              {direction === "sent" ? t("home.emptySent") : t("home.emptyReceived")}
            </T>
          </Card>
        )}
      </Body>
    </Page>
  );
}

const styles = StyleSheet.create({
  balance: {
    backgroundColor: colors.coinSubtle,
    borderRadius: radius.hero,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 16,
    overflow: "hidden",
  },
  mascot: { position: "absolute", right: -4, top: 8 },
  amountRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  divider: { height: 1, backgroundColor: colors.coinStrong, marginTop: 4 },
  nextRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  tiles: { flexDirection: "row", gap: 12 },
  tile: { flex: 1, borderRadius: radius.card, paddingVertical: 13, paddingHorizontal: 14, gap: 6, minHeight: 104 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 14,
    minHeight: 68,
  },
  ctaIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.chip,
    backgroundColor: colors.brandSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: -8 },
  empty: { alignItems: "center", paddingVertical: 20 },
});
