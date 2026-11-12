import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { RoleChip } from "@/components/Chips";
import { CoinPill } from "@/components/Coin";
import { Mascot } from "@/components/Mascot";
import {
  Avatar,
  Body,
  Card,
  CHROME_SCALE,
  colors,
  EmptyState,
  ErrorState,
  Icon,
  Page,
  radius,
  ScreenHeader,
  ScreenTitle,
  Skeleton,
  T,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { explain } from "@/lib/errors";
import { dayMonth, formatCount, monthName } from "@/lib/format";
import {
  type AwardCategory,
  awardName,
  type AwardsCurrent,
  awardStanding,
  awardValue,
  type Leaderboard as Board,
  type LeaderRow,
  ownTotal,
  standingPerson,
} from "@/lib/leaderboard";
import { monthLabel } from "@/lib/notifications";
import { useRoutes } from "@/lib/routes";
import { useApi, useRefreshOnFocus } from "@/lib/useApi";
import { useNow } from "@/lib/useNow";

/** One place in the top 5 (`.lb`): the crown for first, the person, their coins this month.
 *  The person's own row is highlighted and says "You". One element to a screen reader. */
function BoardRow({ row, last }: { row: LeaderRow; last: boolean }) {
  const { t, locale } = useAuth();
  const name = row.me ? t("post.you") : row.name;
  return (
    <View
      accessible
      accessibilityLabel={t("leaderboard.rowA11y", { rank: row.rank, name, count: row.earned })}
      style={[styles.row, row.me ? styles.mine : !last && styles.line]}
    >
      <View style={styles.rank}>
        {row.rank === 1 ? (
          <Icon name="crown" size={18} color={colors.coin} filled stroke={1.5} />
        ) : (
          <T size={14} weight={900} color={colors.muted} tabular maxFontSizeMultiplier={CHROME_SCALE}>
            {String(row.rank)}
          </T>
        )}
      </View>
      <Avatar name={row.name} seed={row.id} size={34} />
      <View style={styles.name}>
        <T size={14} weight={800} numberOfLines={1} style={{ flexShrink: 1 }}>
          {name}
        </T>
        {row.role !== "crew" ? <RoleChip role={row.role} /> : null}
      </View>
      <CoinPill amount={formatCount(row.earned, locale)} label={t("common.coins", { count: row.earned })} />
    </View>
  );
}

/** CR-35's top 5 at the store, and, for someone further down, only their own total. */
function BoardCard({ board }: { board: Board }) {
  const { t, me, locale } = useAuth();
  if (!board.store) {
    return (
      <EmptyState
        art={<Mascot pose="wave" size={90} />}
        title={t("leaderboard.noStoreTitle")}
        lead={t("leaderboard.noStoreLead")}
      />
    );
  }
  const own = me ? ownTotal(board, me.role) : null;
  return (
    <>
      <T size={17} weight={900} heading style={{ marginBottom: -6 }}>
        {t("leaderboard.top")}
      </T>
      {board.top.length ? (
        <Card padding={0} style={styles.board}>
          {board.top.map((row, index) => (
            <BoardRow key={row.id} row={row} last={index === board.top.length - 1} />
          ))}
        </Card>
      ) : (
        <EmptyState
          art={<Mascot pose="happy" size={90} />}
          title={t("leaderboard.emptyTitle")}
          lead={t("leaderboard.emptyLead")}
        />
      )}
      {own !== null ? (
        <View accessible accessibilityLabel={t("leaderboard.ownTotalA11y", { count: own })} style={styles.own}>
          <T size={14} weight={900} style={{ flex: 1 }}>
            {t("leaderboard.ownTotal", { count: own, amount: formatCount(own, locale) })}
          </T>
          <View style={styles.keepGoing}>
            <T size={11} weight={900} color={colors.brandFg} maxFontSizeMultiplier={CHROME_SCALE}>
              {t("home.monthLead")}
            </T>
          </View>
        </View>
      ) : null}
    </>
  );
}

/** One of the month's awards (CR-36): its name, who leads it now (or won it, once paid),
 *  their number, and the prize. Butter when it is the person's own. */
function AwardRow({ category }: { category: AwardCategory }) {
  const { t, me, locale } = useAuth();
  const name = awardName(category, locale);
  const standing = awardStanding(t, category, me?.id);
  const person = standingPerson(category);
  const value = person ? awardValue(t, category.metric, person.value) : null;
  const mine = !!person && person.id === me?.id;
  const label = [t("awards.prizeA11y", { award: name, count: category.coins }), standing, value]
    .filter(Boolean)
    .join(". ");
  return (
    <Card style={mine ? styles.mineAward : undefined}>
      <View accessible accessibilityLabel={label} style={styles.award}>
        <View style={[styles.trophy, { backgroundColor: mine ? colors.raised : colors.coinSubtle }]}>
          <Icon name="trophy" size={20} color={colors.coinInk} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T size={14} weight={900}>
            {name}
          </T>
          <T size={12} weight={mine ? 800 : 400} color={mine ? colors.foreground : colors.muted}>
            {standing}
          </T>
          {value ? (
            <T size={11} color={colors.muted} tabular>
              {value}
            </T>
          ) : null}
        </View>
        <CoinPill amount={formatCount(category.coins, locale)} plus label={t("common.plusCoins", { count: category.coins })} />
      </View>
    </Card>
  );
}

function AwardsList({ awards, month }: { awards: AwardsCurrent; month: string }) {
  const { t } = useAuth();
  return (
    <>
      <T size={17} weight={900} heading style={{ marginBottom: -6 }}>
        {t("awards.title", { month })}
      </T>
      {awards.categories.length ? (
        awards.categories.map((category) => <AwardRow key={category.id} category={category} />)
      ) : (
        <Card style={styles.empty}>
          <T size={13} color={colors.muted} align="center">
            {t("awards.empty")}
          </T>
        </Card>
      )}
    </>
  );
}

/**
 * The leaderboard and this month's awards (CR-35, CR-36), pushed from Home's "this month"
 * tile and from Profile, in both tab groups. The store's top 5 crew and shift managers by
 * coins this month, the person's own row highlighted; someone outside the top 5 sees only
 * their own total, never a rank or the bottom of the list (the server sends no rank past 5).
 * Then each award with its prize and who leads it now, and the winners once paid.
 *
 * The month is the store's (`month` from the API), so it is right around midnight on the 1st
 * whatever time zone the phone is in.
 */
export function Leaderboard() {
  const { t, locale } = useAuth();
  const router = useRouter();
  const routes = useRoutes();
  const now = useNow();
  const board = useApi<Board>("/leaderboard");
  const awards = useApi<AwardsCurrent>("/awards/current");
  useRefreshOnFocus(board.revalidate);
  useRefreshOnFocus(awards.revalidate);
  const [refreshing, setRefreshing] = useState(false);

  const pull = async () => {
    setRefreshing(true);
    await Promise.all([board.revalidate(), awards.revalidate()]);
    setRefreshing(false);
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace(routes.home));
  const storeMonth = board.data?.month ?? awards.data?.month ?? null;
  // Until the store's month arrives, the phone's stands in for the title.
  const month = storeMonth ? monthLabel(storeMonth, locale) : monthName(locale, new Date(now));
  const store = board.data?.store ?? awards.data?.store ?? null;
  const announced = awards.data
    ? awards.data.announced
      ? t("leaderboard.announced")
      : t("leaderboard.announcedOn", { date: dayMonth(awards.data.resets_on, locale) })
    : null;
  const lead = [store ? t("header.store", { number: store.number, name: store.name }) : null, announced]
    .filter(Boolean)
    .join(" · ");

  return (
    <Page refreshing={refreshing} onRefresh={() => void pull()} bottomInset>
      <Body>
        <ScreenHeader onBack={back} />
        <ScreenTitle title={t("leaderboard.title", { month })} lead={lead || undefined} />

        {board.data ? (
          <BoardCard board={board.data} />
        ) : board.error ? (
          <ErrorState
            message={`${t("leaderboard.loadError")} ${explain(t, board.error)}`}
            retryLabel={t("common.retry")}
            onRetry={() => void board.reload()}
          />
        ) : (
          <Skeleton height={260} />
        )}

        {awards.data ? (
          <AwardsList awards={awards.data} month={monthLabel(awards.data.month, locale)} />
        ) : awards.error ? (
          <ErrorState
            message={`${t("awards.loadError")} ${explain(t, awards.error)}`}
            retryLabel={t("common.retry")}
            onRetry={() => void awards.reload()}
          />
        ) : (
          <>
            <Skeleton height={76} />
            <Skeleton height={76} />
          </>
        )}
      </Body>
    </Page>
  );
}

const styles = StyleSheet.create({
  board: { paddingHorizontal: 14, paddingVertical: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  line: { borderBottomWidth: 1, borderBottomColor: colors.border },
  mine: {
    backgroundColor: colors.brandSubtle,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: radius.chip,
  },
  rank: { width: 24, alignItems: "center" },
  name: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  own: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    backgroundColor: colors.brandSubtle,
    borderRadius: radius.card,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  keepGoing: {
    backgroundColor: colors.brandInk,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  award: { flexDirection: "row", alignItems: "center", gap: 12 },
  trophy: {
    width: 42,
    height: 42,
    borderRadius: radius.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  mineAward: { backgroundColor: colors.coinSubtle, borderColor: colors.coinStrong },
  empty: { alignItems: "center", paddingVertical: 20 },
});
