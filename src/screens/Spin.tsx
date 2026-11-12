import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useReducedMotion,
  useSharedValue,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Coin } from "@/components/Coin";
import { Floaty, Mascot } from "@/components/Mascot";
import { Wheel, type WheelPrize } from "@/components/Wheel";
import {
  Alert,
  Body,
  Button,
  Card,
  CHROME_SCALE,
  colors,
  EmptyState,
  ErrorState,
  gutter,
  haptic,
  Icon,
  type IconName,
  Page,
  ProgressBar,
  radius,
  ScreenHeader,
  ScreenTitle,
  Sheet,
  Skeleton,
  T,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { explain } from "@/lib/errors";
import { formatCount } from "@/lib/format";
import { afterAttempt, fingerprintOf, type Intent, intentFor } from "@/lib/idempotency";
import { useMe, useMeRefreshOnFocus } from "@/lib/me";
import { useRoutes } from "@/lib/routes";
import {
  canLand,
  type PrizeAction,
  prizeLabel,
  prizeOutcome,
  type RuleId,
  ruleLines,
  SPIN_INTENT,
  spinButtonKey,
  spinProgress,
  type SpinResult,
  wheelChanged,
  type WheelOut,
} from "@/lib/spin";
import { useApi, useRefreshOnFocus } from "@/lib/useApi";
import { landingRotation, restingAngle, SPIN_EASING, SPIN_MS } from "@/lib/wheel";

const settle = Easing.bezier(...SPIN_EASING);

/** The wheel's largest size (the prototype's 300 plus its paper ring) and its smallest. */
const WHEEL_MAX = 316;
const WHEEL_MIN = 220;

/** "N spins ready" (`.spinpill`, on lilac). */
function SpinsPill({ count }: { count: number }) {
  const { t } = useAuth();
  const label = t("spin.ready", { count });
  return (
    <View accessible accessibilityLabel={label} accessibilityLiveRegion="polite" style={styles.pill}>
      <Icon name="wheel" size={14} color={colors.rewardInk} stroke={2.4} />
      <T size={13} weight={900} color={colors.rewardInk} tabular numberOfLines={1} maxFontSizeMultiplier={CHROME_SCALE}>
        {label}
      </T>
    </View>
  );
}

/** Each rule's tile colours and glyph (`.rulelist i`). */
const RULE_LOOK: Record<RuleId, { bg: string; fg: string; icon: IconName | null }> = {
  coins: { bg: colors.coinSubtle, fg: colors.coinInk, icon: null },
  badge: { bg: colors.rewardSubtle, fg: colors.rewardInk, icon: "award" },
  milestone: { bg: colors.accentSubtle, fg: colors.accentInk, icon: "calendar" },
  cap: { bg: colors.successSubtle, fg: colors.successInk, icon: "wheel" },
};

/**
 * CR-31: "How you earn spins", only the rules the owners have turned on, then the monthly
 * cap, and the progress toward the next spin from coins while there are spins left to earn.
 */
function RulesCard({ wheel }: { wheel: WheelOut }) {
  const { t, locale } = useAuth();
  const lines = ruleLines(wheel.rules, locale);
  const progress = spinProgress(wheel);
  const toGo = t("spin.toGo", { count: progress.toGo, amount: formatCount(progress.toGo, locale) });
  const earnedOf = t("spin.earnedOf", { earned: progress.earned, max: progress.max });
  return (
    <Card style={{ gap: 12 }}>
      <T size={15} weight={900} heading>
        {t("spin.howTitle")}
      </T>
      <View style={{ gap: 9 }}>
        {lines.map((line) => {
          const look = RULE_LOOK[line.id];
          return (
            <View key={line.id} style={styles.rule}>
              <View style={[styles.ruleIcon, { backgroundColor: look.bg }]}>
                {look.icon ? <Icon name={look.icon} size={16} color={look.fg} /> : <Coin size={16} />}
              </View>
              <T size={13} weight={700} style={{ flex: 1 }}>
                {t(line.key, line.values)}
              </T>
            </View>
          );
        })}
      </View>
      {progress.show ? (
        <View style={{ gap: 6 }}>
          <ProgressBar value={progress.fraction} color={colors.coin} />
          <T size={11} color={colors.muted} tabular>
            {`${toGo} · ${earnedOf}`}
          </T>
        </View>
      ) : progress.capped ? (
        progress.max > 0 ? (
          <T size={12} weight={800} color={colors.successInk}>
            {t("spin.capped", { count: progress.max })}
          </T>
        ) : null
      ) : (
        <T size={11} color={colors.muted} tabular>
          {earnedOf}
        </T>
      )}
    </Card>
  );
}

/**
 * CR-30: the result, with the mascot cheering. "You won [prize]!" and what happens next for
 * that kind of prize; for an item, the way to My rewards, and for the badge, to the profile.
 */
function ResultSheet({
  visible,
  result,
  onClose,
  onGo,
}: {
  visible: boolean;
  result: SpinResult | null;
  onClose: () => void;
  onGo: (action: NonNullable<PrizeAction>) => void;
}) {
  const { t, locale } = useAuth();
  if (!result) return null;
  const prize = prizeLabel(result.prize, locale);
  const outcome = prizeOutcome(result.prize, locale);
  const title = t("spin.wonTitle", { prize });
  const action = outcome.action;
  const actionTitle = action === "myRewards" ? t("rewards.seeMine") : action === "profile" ? t("spin.seeBadges") : null;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      label={title}
      closeLabel={t("common.close")}
      footer={
        <>
          <Button title={t("spin.awesome")} full onPress={onClose} />
          {action && actionTitle ? (
            <Button title={actionTitle} variant="soft" full onPress={() => onGo(action)} />
          ) : null}
        </>
      }
    >
      <View style={styles.won}>
        <Animated.View entering={ZoomIn.duration(320).reduceMotion(ReduceMotion.System)}>
          <Floaty>
            <Mascot pose="cheer" size={130} />
          </Floaty>
        </Animated.View>
        <T size={26} weight={900} align="center" tracking={-0.6} heading accessibilityLiveRegion="polite">
          {title}
        </T>
        <T size={14} color={colors.muted} align="center">
          {t(outcome.key, outcome.values)}
        </T>
      </View>
    </Sheet>
  );
}

function SpinSkeleton({ size }: { size: number }) {
  return (
    <>
      <View style={{ alignSelf: "center", marginTop: 12 }}>
        <Skeleton height={size} width={size} corner={size / 2} />
      </View>
      <Skeleton height={50} corner={radius.pill} />
      <Skeleton height={150} />
    </>
  );
}

/** The wheel a spin's answer was laid over, shown until the next fetch (`for`) replaces it. */
interface Fresh {
  for: WheelOut | null;
  wheel: WheelOut;
}

/**
 * Spin the wheel (CR-28 to CR-31), pushed from Home in both tab groups.
 *
 * The server picks the prize, stores it and pays it out before the app animates (C6): Spin
 * asks for the result first, then turns the wheel 5 × 360 + (360 − segment centre) over 3.5
 * seconds so it lands on `segment_index` (plan §8). If the owners changed the prizes since the
 * wheel loaded (`prizes_version`), it loads the wheel again first, so it never lands on the
 * wrong prize. With reduce motion on, there is no spin: the wheel rests on the prize and the
 * result shows at once.
 *
 * A spin is an intent with its own Idempotency-Key (plan D13): a retry after a dead
 * connection reuses it, so a spin that did land comes back as itself rather than using a
 * second one. With spins turned off (plan D19) the screen says so instead of the wheel.
 */
export function Spin() {
  const { t, locale } = useAuth();
  const { patch, refresh: refreshMe } = useMe();
  const router = useRouter();
  const routes = useRoutes();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const wheel = useApi<WheelOut>("/spin");
  useRefreshOnFocus(wheel.revalidate);
  useMeRefreshOnFocus();

  const rotation = useSharedValue(0);
  const [fresh, setFresh] = useState<Fresh | null>(null);
  const [busy, setBusy] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const intent = useRef<Intent | null>(null);
  // Blocks a second tap in the same frame, before `busy` has re-rendered the button.
  const inFlight = useRef(false);

  // Leaving mid-spin stops the wheel; the prize is already theirs on the server.
  useEffect(() => () => cancelAnimation(rotation), [rotation]);

  const data = wheel.data;
  const shown = fresh && fresh.for === data ? fresh.wheel : data;
  const { revalidate } = wheel;

  const landed = () => {
    setSpinning(false);
    setOpen(true);
    haptic("success");
    void revalidate();
  };

  const spin = async () => {
    if (!shown || inFlight.current || spinning) return;
    inFlight.current = true;
    const current = intentFor(intent.current, fingerprintOf({ action: SPIN_INTENT }));
    intent.current = current;
    setBusy(true);
    setFailure(null);
    try {
      const answer = await api<SpinResult>("/spins", {
        method: "POST",
        headers: { "Idempotency-Key": current.key },
      });
      intent.current = null;
      // Drawn on a prize list this screen hasn't got: load the wheel it was drawn on first.
      const face = wheelChanged(shown, answer) ? await api<WheelOut>("/spin").catch(() => null) : shown;
      setFresh({ for: data, wheel: { ...(face ?? shown), spins_available: answer.spins_available } });
      patch({ spins_available: answer.spins_available });
      setResult(answer);
      const target = face && canLand(face, answer) ? landingRotation(rotation.get(), answer.segment_index, face.prizes.length) : null;
      if (target === null) {
        // A wheel that can't show this prize: the result, without landing on the wrong one.
        landed();
      } else if (reduceMotion) {
        rotation.set(restingAngle(target));
        landed();
      } else {
        const rest = restingAngle(target);
        setSpinning(true);
        rotation.set(
          withTiming(target, { duration: SPIN_MS, easing: settle, reduceMotion: ReduceMotion.System }, (finished) => {
            if (!finished) return;
            rotation.set(rest);
            scheduleOnRN(landed);
          }),
        );
      }
    } catch (err) {
      intent.current = afterAttempt(current, err);
      haptic("error");
      setFailure(err);
      // Out of spins, or switched off since: the wheel's numbers have moved on.
      void revalidate();
    } finally {
      inFlight.current = false;
      setBusy(false);
      void refreshMe();
    }
  };

  const pull = async () => {
    setRefreshing(true);
    await Promise.all([refreshMe(), revalidate()]);
    setRefreshing(false);
  };

  const go = (action: NonNullable<PrizeAction>) => {
    setOpen(false);
    if (action === "myRewards") router.push(routes.myRewards);
    else router.navigate(routes.profile);
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace(routes.home));
  const size = Math.round(Math.min(WHEEL_MAX, Math.max(WHEEL_MIN, width - gutter * 2 - 8)));
  const ready = shown?.spins_available ?? 0;
  const prizes: WheelPrize[] = shown ? shown.prizes.map((prize) => ({ id: prize.id, label: prizeLabel(prize, locale) })) : [];
  const still = spinning || busy;

  return (
    <Page refreshing={refreshing} onRefresh={still ? undefined : () => void pull()} bottomInset>
      <Body>
        <ScreenHeader onBack={back} />
        <View style={styles.titleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ScreenTitle title={t("spin.title")} lead={t("spin.lead")} />
          </View>
          {shown?.enabled ? <SpinsPill count={ready} /> : null}
        </View>

        {!shown && wheel.error ? (
          <ErrorState
            message={`${t("spin.loadError")} ${explain(t, wheel.error)}`}
            retryLabel={t("common.retry")}
            onRetry={() => void wheel.reload()}
            error={wheel.error}
          />
        ) : !shown ? (
          <SpinSkeleton size={size} />
        ) : !shown.enabled ? (
          <EmptyState art={<Mascot pose="wave" size={96} />} title={t("spin.offTitle")} lead={t("spin.offLead")} />
        ) : (
          <>
            <Wheel
              prizes={prizes}
              rotation={rotation}
              size={size}
              label={t("spin.wheelA11y", { count: prizes.length, prizes: prizes.map((prize) => prize.label).join(", ") })}
            />
            <Button
              title={t(spinButtonKey({ spinning, ready }))}
              full
              haptic="light"
              busy={busy}
              disabled={ready < 1 || spinning || prizes.length === 0}
              onPress={() => void spin()}
              style={{ marginTop: 8 }}
            />
            {failure ? <Alert>{explain(t, failure)}</Alert> : null}
            <RulesCard wheel={shown} />
          </>
        )}
      </Body>

      <ResultSheet visible={open} result={result} onClose={() => setOpen(false)} onGo={go} />
    </Page>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "flex-start", flexWrap: "wrap", gap: 10 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.rewardSubtle,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  rule: { flexDirection: "row", alignItems: "center", gap: 10 },
  ruleIcon: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  won: { alignItems: "center", gap: 10, paddingTop: 6 },
});
