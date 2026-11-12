import type { Schemas } from "@crewstars/api-client";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { RoleChip } from "@/components/Chips";
import { CoinPill } from "@/components/Coin";
import { SpinTile } from "@/components/SpinTile";
import {
  Avatar,
  Body,
  Button,
  Card,
  colors,
  ErrorState,
  Icon,
  Page,
  ProgressBar,
  radius,
  ScreenTitle,
  Skeleton,
  T,
  TextLink,
  Touchable,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { explain } from "@/lib/errors";
import { dayMonth, firstName, formatCount } from "@/lib/format";
import { kudosFraction, preview } from "@/lib/manager";
import { type Kudos, useMe, useMeRefreshOnFocus } from "@/lib/me";
import { monthLabel } from "@/lib/notifications";
import { rewardName } from "@/lib/rewards";
import { MANAGER_ROUTES } from "@/lib/routes";
import type { WheelOut } from "@/lib/spin";
import { timeAgo } from "@/lib/time";
import { useApi, useRefreshOnFocus } from "@/lib/useApi";
import { useNow } from "@/lib/useNow";

type ManagerHomeOut = Schemas["ManagerHomeOut"];
type ManagerMonth = Schemas["ManagerMonthOut"];
type PartyOut = Schemas["PartyOut"];
type RequestRow = Schemas["RequestRow"];
type Spotlight = Schemas["SpotlightOut"];

/** MG-01 (`This month ✨`): shout-outs the GM has given, the store's crew and shift managers
 *  recognized this month out of all of them, and the GM's kudos left with the reset date. */
function MonthCard({ month, kudos }: { month: ManagerMonth; kudos: Kudos }) {
  const { t, locale } = useAuth();
  const kudosValues = { left: formatCount(kudos.left, locale), allowance: formatCount(kudos.allowance, locale) };
  return (
    <View style={styles.month}>
      <T size={13} weight={800} color={colors.brandInk} heading>
        {t("managerHome.monthTitle")}
      </T>
      <View style={styles.stats}>
        <View accessible accessibilityLabel={t("managerHome.givenA11y", { count: month.shoutouts_given_month })}>
          <T size={30} weight={900} tabular line={36}>
            {formatCount(month.shoutouts_given_month, locale)}
          </T>
          <T size={12} color={colors.muted}>
            {t("managerHome.given")}
          </T>
        </View>
        <View
          accessible
          accessibilityLabel={t("managerHome.recognizedA11y", {
            count: month.crew_recognized,
            total: month.crew_total,
          })}
        >
          <T size={30} weight={900} tabular line={36}>
            {formatCount(month.crew_recognized, locale)}
            <T size={16} weight={800} color={colors.muted}>
              {` / ${formatCount(month.crew_total, locale)}`}
            </T>
          </T>
          <T size={12} color={colors.muted}>
            {t("managerHome.recognized")}
          </T>
        </View>
      </View>
      <ProgressBar
        value={kudosFraction(kudos)}
        color={colors.brand}
        track={colors.raised}
        label={t("managerHome.kudosA11y", kudosValues)}
      />
      <T size={12} color={colors.muted} tabular importantForAccessibility="no" accessibilityElementsHidden>
        {t("managerHome.kudos", { ...kudosValues, date: dayMonth(kudos.resets_on, locale) })}
      </T>
    </View>
  );
}

/** MG-02: the store's crew with nothing earned yet this month, each a tap from Give. Hidden
 *  once everyone has been recognized; a long list shows its first few. */
function NeedsLove({ people, onRecognize }: { people: PartyOut[]; onRecognize: (person: PartyOut) => void }) {
  const { t } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const { shown, hidden } = preview(people, expanded);
  return (
    <Card style={styles.love}>
      <View style={styles.loveHead}>
        <Icon name="info" size={18} color={colors.warningInk} />
        <T size={14} weight={900} heading style={{ flex: 1 }}>
          {t("managerHome.loveTitle", { count: people.length })}
        </T>
      </View>
      {shown.map((person) => (
        <View key={person.id} style={styles.loveRow}>
          <Avatar name={person.name} seed={person.id} size={32} />
          <View style={styles.loveName}>
            <T size={14} weight={800} numberOfLines={1} style={{ flexShrink: 1 }}>
              {person.name}
            </T>
            {person.role !== "crew" ? <RoleChip role={person.role} /> : null}
          </View>
          <Button
            title={t("managerHome.recognize")}
            accessibilityLabel={t("managerHome.recognizeA11y", { name: person.name })}
            size="sm"
            haptic="light"
            onPress={() => onRecognize(person)}
          />
        </View>
      ))}
      {hidden > 0 || expanded ? (
        <TextLink
          role="button"
          align="flex-start"
          title={expanded ? t("managerHome.showLess") : t("managerHome.showMore", { count: hidden })}
          onPress={() => setExpanded((open) => !open)}
        />
      ) : null}
    </Card>
  );
}

/** MG-03: how many requests wait, the oldest of them, and the way to Approvals. */
function RequestsPreview({
  count,
  oldest,
  now,
  onReview,
}: {
  count: number;
  oldest: RequestRow | null;
  now: number;
  onReview: () => void;
}) {
  const { t, locale } = useAuth();
  return (
    <>
      <View style={styles.section}>
        <T
          size={17}
          weight={900}
          heading
          style={{ flex: 1 }}
          accessibilityLabel={count > 0 ? t("managerHome.requestsA11y", { count }) : t("managerHome.requests")}
        >
          {count > 0 ? t("managerHome.requestsCount", { count }) : t("managerHome.requests")}
        </T>
        <TextLink title={t("common.seeAll")} align="flex-end" onPress={onReview} />
      </View>
      {count > 0 && oldest ? (
        <Card style={{ gap: 12 }}>
          <View
            accessible
            accessibilityLabel={[
              t("managerHome.oldest"),
              t("approvals.requestA11y", { name: oldest.person.name, reward: rewardName(oldest, locale) }),
              t("common.coins", { count: oldest.cost }),
              timeAgo(t, oldest.created_at, now, true),
            ].join(". ")}
            style={styles.requestRow}
          >
            <Avatar name={oldest.person.name} seed={oldest.person.id} size={38} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={14} weight={800} numberOfLines={1}>
                {oldest.person.name}
              </T>
              <T size={12} color={colors.muted}>
                {`${rewardName(oldest, locale)} · ${timeAgo(t, oldest.created_at, now)}`}
              </T>
            </View>
            <CoinPill amount={formatCount(oldest.cost, locale)} label={t("common.coins", { count: oldest.cost })} />
          </View>
          <Button title={t("managerHome.review")} variant="soft" size="sm" full onPress={onReview} />
        </Card>
      ) : (
        <Card style={styles.empty}>
          <T size={13} color={colors.muted} align="center">
            {t("managerHome.noRequests")}
          </T>
        </Card>
      )}
    </>
  );
}

/** MG-04: the store's top earner this month, on butter. Hidden until someone has earned.
 *  The month is the store's (`month` from the API), not the phone's, so it is right around
 *  midnight on the 1st whatever time zone the phone is in. "See all" opens the leaderboard
 *  and the month's awards (CR-35, CR-36). */
function SpotlightCard({ spotlight, month, onBoard }: { spotlight: Spotlight; month: string; onBoard: () => void }) {
  const { t, locale } = useAuth();
  const { person, earned_this_month: earned } = spotlight;
  const rising = t("managerHome.risingStar", { month: monthLabel(month, locale) });
  const amount = t("managerHome.earned", { count: earned, amount: formatCount(earned, locale) });
  return (
    <>
      <View style={styles.section}>
        <T size={17} weight={900} heading style={{ flex: 1 }}>
          {t("managerHome.spotlight")}
        </T>
        <TextLink title={t("common.seeAll")} align="flex-end" onPress={onBoard} />
      </View>
      <Card style={styles.spotlight}>
        <View accessible accessibilityLabel={`${rising}: ${person.name}. ${amount}`} style={styles.requestRow}>
          <Avatar name={person.name} seed={person.id} size={42} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={11} weight={800} color={colors.brandInk}>
              {rising}
            </T>
            <T size={15} weight={900} numberOfLines={1}>
              {person.name}
            </T>
            <T size={12} color={colors.muted} tabular>
              {amount}
            </T>
          </View>
          <Icon name="trophy" size={24} color={colors.coinInk} />
        </View>
      </Card>
    </>
  );
}

function ManagerHomeSkeleton() {
  return (
    <>
      <Skeleton height={168} corner={radius.tile} />
      <Skeleton height={68} />
      <Skeleton height={180} />
      <Skeleton height={120} />
    </>
  );
}

/**
 * The GM's Home (MG-01 to MG-04): this month at a glance, the GM's own spins (CR-12; hidden
 * while spins are off), the crew who haven't been recognized yet (Recognize opens Give with
 * them chosen), the reward requests waiting, and the store's rising star. `/manager/home`
 * works most of it out; coming back to the tab or pulling down fetches it again.
 */
export function ManagerHome() {
  const { t, me } = useAuth();
  const { summary, refresh: refreshMe } = useMe();
  const router = useRouter();
  const now = useNow();
  const home = useApi<ManagerHomeOut>("/manager/home");
  const wheel = useApi<WheelOut>("/spin");
  const [refreshing, setRefreshing] = useState(false);
  useRefreshOnFocus(home.revalidate);
  useRefreshOnFocus(wheel.revalidate);
  useMeRefreshOnFocus();

  const pull = async () => {
    setRefreshing(true);
    await Promise.all([refreshMe(), home.revalidate(), wheel.revalidate()]);
    setRefreshing(false);
  };

  const give = () => router.navigate(MANAGER_ROUTES.give);
  const spin = () => router.push(MANAGER_ROUTES.spin);
  const board = () => router.push(MANAGER_ROUTES.leaderboard);
  // `at` makes each tap a fresh request, so the same person can be chosen again after the
  // form moved on to someone else.
  const recognize = (person: PartyOut) =>
    router.navigate({ pathname: MANAGER_ROUTES.give, params: { to: person.id, at: String(Date.now()) } });
  const review = () => router.navigate(MANAGER_ROUTES.approvals);

  const data = home.data;
  const name = me ? firstName(me.name) : "";
  // The summary is patched the moment a shout-out answers, so it has the freshest kudos.
  const kudos = summary?.kudos ?? data?.this_month.kudos ?? null;

  return (
    <Page refreshing={refreshing} onRefresh={() => void pull()}>
      <Body>
        <AppHeader />
        <ScreenTitle title={name ? t("home.greeting", { name }) : t("home.greetingNoName")} lead={t("home.managerLead")} />

        {!data && home.error ? (
          <ErrorState
            message={`${t("managerHome.loadError")} ${explain(t, home.error)}`}
            retryLabel={t("common.retry")}
            onRetry={() => void home.reload()}
            error={home.error}
          />
        ) : !data || !kudos ? (
          <ManagerHomeSkeleton />
        ) : (
          <>
            <MonthCard month={data.this_month} kudos={kudos} />
            {wheel.data?.enabled ? (
              <SpinTile wheel={wheel.data} ready={summary?.spins_available} onPress={spin} />
            ) : null}
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
            {data.needs_some_love.length ? <NeedsLove people={data.needs_some_love} onRecognize={recognize} /> : null}
            <RequestsPreview
              count={data.requests.pending_count}
              oldest={data.requests.oldest}
              now={now}
              onReview={review}
            />
            {data.spotlight ? <SpotlightCard spotlight={data.spotlight} month={data.month} onBoard={board} /> : null}
          </>
        )}
      </Body>
    </Page>
  );
}

const styles = StyleSheet.create({
  month: {
    backgroundColor: colors.brandSubtle,
    borderRadius: radius.tile,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 10,
  },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 24 },
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
  love: { backgroundColor: colors.warningSubtle, borderColor: colors.coinStrong, gap: 10 },
  loveHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  loveRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loveName: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  section: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: -8 },
  requestRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  spotlight: { backgroundColor: colors.coinSubtle, borderColor: colors.coinStrong },
  empty: { alignItems: "center", paddingVertical: 20 },
});
