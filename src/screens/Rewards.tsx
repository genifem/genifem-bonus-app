import { useRouter } from "expo-router";
import { memo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { ReduceMotion, ZoomIn } from "react-native-reanimated";

import { AppHeader } from "@/components/AppHeader";
import { Coin, CoinPill } from "@/components/Coin";
import { Floaty, Mascot } from "@/components/Mascot";
import { MyRequestRow } from "@/components/MyRequestRow";
import { RewardThumb } from "@/components/RewardThumb";
import {
  Alert,
  Body,
  Button,
  Card,
  colors,
  EmptyState,
  ErrorState,
  haptic,
  Icon,
  Page,
  ProgressBar,
  Rich,
  ScreenHeader,
  ScreenTitle,
  Sheet,
  Skeleton,
  T,
  TextLink,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { explain, redeemProblem, say } from "@/lib/errors";
import { dayMonth, formatCount } from "@/lib/format";
import { afterAttempt, fingerprintOf, type Intent, intentFor } from "@/lib/idempotency";
import { useMe, useMeRefreshOnFocus } from "@/lib/me";
import {
  afterRedeem,
  eligibilityReason,
  type Limits,
  limitView,
  type MyRequest,
  nextStepKey,
  pendingLeadKey,
  type RedeemResult,
  rewardDescription,
  type RewardOut,
  rewardName,
  type RewardsOut,
} from "@/lib/rewards";
import { useRoutes } from "@/lib/routes";
import { useApi, useRefreshOnFocus } from "@/lib/useApi";
import { useNow } from "@/lib/useNow";

/** How many of the person's requests the catalogue previews under it. */
const MINE_PREVIEW = 3;

/** CR-24: the earned balance on butter. */
function BalanceStrip({ balance }: { balance: number }) {
  const { t, locale } = useAuth();
  return (
    <View accessible accessibilityLabel={t("rewards.balanceA11y", { count: balance })} style={styles.strip}>
      <T size={14} weight={800} style={{ flex: 1 }}>
        {t("rewards.balance")}
      </T>
      <Coin size={20} />
      <T size={18} weight={900} tabular>
        {formatCount(balance, locale)}
      </T>
    </View>
  );
}

/** CR-24: coins redeemed this month against the cap (the bar), rewards against the count,
 *  and when both start again. */
function LimitCard({ limits }: { limits: Limits }) {
  const { t, locale } = useAuth();
  const view = limitView(limits);
  const coins = { used: formatCount(view.coinsUsed, locale), max: formatCount(view.coinsMax, locale) };
  const rewards = { used: view.rewardsUsed, max: view.rewardsMax };
  return (
    <Card style={{ gap: 8 }}>
      <View style={styles.limitHead}>
        <T size={14} weight={800} heading style={{ flexShrink: 1 }}>
          {t("rewards.limitTitle")}
        </T>
        <T size={11} color={colors.muted}>
          {t("rewards.resets", { date: dayMonth(limits.resets_on, locale) })}
        </T>
      </View>
      <ProgressBar value={view.coinsFraction} color={colors.brand} label={t("rewards.coinsUsedA11y", coins)} />
      <View style={styles.limitFoot}>
        <Rich size={12} parts={t.rich("rewards.coinsUsed", coins)} importantForAccessibility="no" accessibilityElementsHidden />
        <Rich
          size={12}
          parts={t.rich("rewards.rewardsUsed", rewards)}
          accessibilityLabel={t("rewards.rewardsUsedA11y", rewards)}
        />
      </View>
    </Card>
  );
}

/**
 * One reward (CR-25, `.card.reward`): its glyph, name, description and cost, and Redeem. When
 * a check fails the button is off and the first reason shows under it, with a padlock for a
 * tier or badge lock. The words, the cost and the reason are one element to a screen reader;
 * Redeem is its own button beside them.
 */
const RewardCard = memo(function RewardCard({
  item,
  onRedeem,
}: {
  item: RewardOut;
  onRedeem: (item: RewardOut) => void;
}) {
  const { t, locale } = useAuth();
  const name = rewardName(item, locale);
  const description = rewardDescription(item, locale);
  const reason = eligibilityReason(item.eligibility, locale);
  const why = reason ? t(reason.key, reason.values) : null;
  const ok = item.eligibility.ok;
  const label = [t("rewards.cardA11y", { reward: name, count: item.cost }), description, why].filter(Boolean).join(". ");
  return (
    <Card style={styles.reward}>
      <RewardThumb icon={item.icon} />
      <View style={styles.rewardBody}>
        <View accessible accessibilityLabel={label} style={{ gap: 3 }}>
          <T size={15} weight={800}>
            {name}
          </T>
          {description ? (
            <T size={12} color={colors.muted}>
              {description}
            </T>
          ) : null}
        </View>
        <View style={styles.rewardFoot}>
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <CoinPill amount={formatCount(item.cost, locale)} label={t("common.coins", { count: item.cost })} />
          </View>
          <Button
            title={t("rewards.redeem")}
            accessibilityLabel={t("rewards.redeemA11y", { reward: name })}
            size="sm"
            variant={ok ? "soft" : "ghost"}
            icon={reason?.locked ? "lock" : undefined}
            disabled={!ok}
            haptic="light"
            onPress={() => onRedeem(item)}
          />
        </View>
        {why ? (
          <View style={styles.reason} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Icon name={reason?.locked ? "lock" : "info"} size={12} color={colors.muted} stroke={2.4} />
            <T size={11} weight={800} color={colors.muted} style={{ flexShrink: 1 }}>
              {why}
            </T>
          </View>
        ) : null}
      </View>
    </Card>
  );
});

function RewardsSkeleton() {
  return (
    <>
      <Skeleton height={50} corner={16} />
      <Skeleton height={96} />
      <Skeleton height={112} />
      <Skeleton height={112} />
      <Skeleton height={112} />
    </>
  );
}

type Stage = "confirm" | "done";

/**
 * Redeem, in one sheet with two faces so no second modal has to open while the first is
 * closing. First the confirmation (CR-26): the cost, what happens next (approval, or ready
 * at once, from the catalogue's `approval`), and the balance and reward count once it's done.
 * Then the server's answer, with the mascot cheering: ready to collect, or waiting for the
 * GM or the owners, as the request's own `approver` says (MG-09).
 */
function RedeemSheet({
  visible,
  stage,
  reward,
  balance,
  limits,
  approval,
  canConfirm,
  busy,
  problem,
  result,
  onConfirm,
  onClose,
  onMine,
}: {
  visible: boolean;
  stage: Stage;
  reward: RewardOut | null;
  balance: number;
  limits: Limits | null;
  approval: boolean;
  canConfirm: boolean;
  busy: boolean;
  problem: string | null;
  result: RedeemResult | null;
  onConfirm: () => void;
  onClose: () => void;
  onMine: () => void;
}) {
  const { t, locale } = useAuth();
  const name = reward ? rewardName(reward, locale) : "";

  if (stage === "done" && result) {
    const ready = result.request.status === "approved";
    const title = ready ? t("rewards.readyTitle") : t("rewards.pendingTitle");
    const lead = ready
      ? t("rewards.readyLead", { reward: rewardName(result.request, locale) })
      : t(pendingLeadKey(result.request.approver));
    const after = {
      count: result.balance,
      amount: formatCount(result.balance, locale),
      used: result.limits.rewards_redeemed,
      max: result.limits.max_rewards,
    };
    return (
      <Sheet
        visible={visible}
        onClose={onClose}
        label={title}
        closeLabel={t("common.close")}
        footer={
          <>
            <Button title={t("rewards.seeMine")} full onPress={onMine} />
            <Button title={t("rewards.done")} variant="soft" full onPress={onClose} />
          </>
        }
      >
        <View style={styles.done}>
          <Animated.View entering={ZoomIn.duration(320).reduceMotion(ReduceMotion.System)}>
            <Floaty>
              <Mascot pose="cheer" size={120} />
            </Floaty>
          </Animated.View>
          <T size={24} weight={900} align="center" heading accessibilityLiveRegion="polite">
            {title}
          </T>
          <T size={14} color={colors.muted} align="center">
            {lead}
          </T>
          <Rich size={13} color={colors.muted} align="center" parts={t.rich("rewards.resultAfter", after)} />
        </View>
      </Sheet>
    );
  }

  const next = reward && limits ? afterRedeem(balance, limits, reward.cost) : null;
  return (
    <Sheet
      visible={visible}
      onClose={busy ? () => {} : onClose}
      label={t("rewards.confirmTitle", { reward: name })}
      closeLabel={t("common.close")}
      footer={
        <>
          <Button
            title={t("rewards.redeem")}
            accessibilityLabel={t("rewards.redeemA11y", { reward: name })}
            full
            busy={busy}
            disabled={!canConfirm}
            onPress={onConfirm}
          />
          <Button title={t("rewards.notNow")} variant="ghost" full disabled={busy} onPress={onClose} />
        </>
      }
    >
      {reward ? (
        <View style={styles.confirmHead}>
          <RewardThumb icon={reward.icon} size={56} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <T size={20} weight={900} heading>
              {t("rewards.confirmTitle", { reward: name })}
            </T>
            <CoinPill amount={t("common.coins", { count: reward.cost })} label={t("common.coins", { count: reward.cost })} />
          </View>
        </View>
      ) : null}
      <T size={14} color={colors.muted}>
        {t(nextStepKey(approval))}
      </T>
      {next ? (
        <Rich
          size={13}
          parts={t.rich("rewards.confirmAfter", {
            count: next.balance,
            amount: formatCount(next.balance, locale),
            used: next.rewardsUsed,
            max: next.rewardsMax,
          })}
        />
      ) : null}
      {problem ? <Alert>{problem}</Alert> : null}
    </Sheet>
  );
}

/** The balance and limits a redeem answered with, shown until the catalogue's next answer
 *  (`for`) replaces the one they were laid over. */
interface Fresh {
  for: RewardsOut;
  balance: number;
  limits: Limits;
}

/**
 * Rewards (CR-24 to CR-27): the balance, this month's limits, every active reward by cost
 * with the server's verdict on each, and the latest of the person's own requests. The crew
 * have it as a tab; a GM opens it from My rewards (MG-09), so it is drawn with a back button
 * there instead of the header.
 *
 * A redeem is one intent with its own Idempotency-Key (plan D13), as on Give: retrying after
 * a dead connection reuses it, so two taps, or a retry of one that did land, never take the
 * coins twice. Afterwards the summary, the catalogue and the list are fetched again (D12).
 */
function RewardsView({ stacked }: { stacked: boolean }) {
  const { t } = useAuth();
  const { patch, refresh: refreshMe } = useMe();
  const router = useRouter();
  const routes = useRoutes();
  const now = useNow();
  const catalog = useApi<RewardsOut>("/rewards");
  const mine = useApi<MyRequest[]>(`/me/reward-requests?limit=${MINE_PREVIEW}`);
  useRefreshOnFocus(catalog.revalidate);
  useRefreshOnFocus(mine.revalidate);
  useMeRefreshOnFocus();

  const [refreshing, setRefreshing] = useState(false);
  const [picked, setPicked] = useState<RewardOut | null>(null);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("confirm");
  const [redeeming, setRedeeming] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [fresh, setFresh] = useState<Fresh | null>(null);
  const intent = useRef<Intent | null>(null);
  // Blocks a second tap in the same frame, before `redeeming` has re-rendered the button.
  const inFlight = useRef(false);

  const data = catalog.data;
  const shown = fresh && fresh.for === data ? fresh : data;
  const balance = shown?.balance ?? 0;
  const limits = shown?.limits ?? null;
  // The card as the catalogue says it is now: a refusal refetches it, and Redeem in the sheet
  // goes off with it.
  const live = picked ? (data?.items.find((item) => item.id === picked.id) ?? null) : null;

  const pull = async () => {
    setRefreshing(true);
    await Promise.all([refreshMe(), catalog.revalidate(), mine.revalidate()]);
    setRefreshing(false);
  };

  const choose = (item: RewardOut) => {
    setPicked(item);
    setFailure(null);
    setStage("confirm");
    setOpen(true);
  };

  const redeem = async () => {
    if (!picked || inFlight.current) return;
    inFlight.current = true;
    const current = intentFor(intent.current, fingerprintOf({ reward: picked.id }));
    intent.current = current;
    setRedeeming(true);
    setFailure(null);
    try {
      const answer = await api<RedeemResult>("/reward-requests", {
        method: "POST",
        body: { reward_id: picked.id },
        headers: { "Idempotency-Key": current.key },
      });
      intent.current = null;
      patch({ balance: answer.balance });
      if (data) setFresh({ for: data, balance: answer.balance, limits: answer.limits });
      haptic("success");
      setResult(answer);
      setStage("done");
    } catch (err) {
      intent.current = afterAttempt(current, err);
      haptic("error");
      setFailure(err);
    } finally {
      inFlight.current = false;
      setRedeeming(false);
      void refreshMe();
      void catalog.revalidate();
      void mine.revalidate();
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace(routes.home));
  const seeMine = () => router.navigate(routes.myRewards);
  const problem = failure ? say(t, redeemProblem(t, failure), null) : null;
  const requests = mine.data ?? [];

  return (
    <Page refreshing={refreshing} onRefresh={() => void pull()}>
      <Body>
        {stacked ? <ScreenHeader onBack={back} /> : <AppHeader />}
        <ScreenTitle title={t("rewards.title")} lead={t("rewards.lead")} />

        {!data && catalog.error ? (
          <ErrorState
            message={`${t("rewards.loadError")} ${explain(t, catalog.error)}`}
            retryLabel={t("common.retry")}
            onRetry={() => void catalog.reload()}
          />
        ) : !data || !limits ? (
          <RewardsSkeleton />
        ) : (
          <>
            <BalanceStrip balance={balance} />
            <LimitCard limits={limits} />
            {data.items.length ? (
              data.items.map((item) => <RewardCard key={item.id} item={item} onRedeem={choose} />)
            ) : (
              <EmptyState
                art={<Mascot pose="coin" size={96} />}
                title={t("rewards.emptyTitle")}
                lead={t("rewards.emptyLead")}
              />
            )}
          </>
        )}

        <View style={styles.section}>
          <T size={17} weight={900} heading style={{ flex: 1 }}>
            {t("rewards.mine")}
          </T>
          <TextLink title={t("common.seeAll")} align="flex-end" onPress={seeMine} />
        </View>
        {mine.loading && !mine.data ? (
          <Skeleton height={140} />
        ) : mine.error && !mine.data ? (
          <ErrorState message={t("rewards.mineError")} retryLabel={t("common.retry")} onRetry={() => void mine.reload()} />
        ) : requests.length ? (
          <Card style={styles.list}>
            {requests.map((request, index) => (
              <MyRequestRow key={request.id} request={request} now={now} last={index === requests.length - 1} />
            ))}
          </Card>
        ) : (
          <Card style={styles.empty}>
            <T size={13} color={colors.muted} align="center">
              {t("rewards.mineEmpty")}
            </T>
          </Card>
        )}
      </Body>

      <RedeemSheet
        visible={open}
        stage={stage}
        reward={picked}
        balance={balance}
        limits={limits}
        approval={data?.approval ?? true}
        canConfirm={!!live?.eligibility.ok}
        busy={redeeming}
        problem={problem}
        result={result}
        onConfirm={() => void redeem()}
        onClose={() => setOpen(false)}
        onMine={() => {
          setOpen(false);
          seeMine();
        }}
      />
    </Page>
  );
}

/** The crew's Rewards tab. */
export function Rewards() {
  return <RewardsView stacked={false} />;
}

/** The same catalogue pushed over the tabs: how a GM gets to it, from My rewards (MG-09). */
export function RewardsScreen() {
  return <RewardsView stacked />;
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.coinSubtle,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  limitHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  limitFoot: { flexDirection: "row", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  reward: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  rewardBody: { flex: 1, minWidth: 0, gap: 6 },
  rewardFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  reason: { flexDirection: "row", alignItems: "center", gap: 4 },
  confirmHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  done: { alignItems: "center", gap: 10, paddingTop: 6 },
  section: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: -8 },
  list: { paddingVertical: 0 },
  empty: { alignItems: "center", paddingVertical: 20 },
});
