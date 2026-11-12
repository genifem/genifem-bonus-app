import type { Schemas } from "@crewstars/api-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { ReduceMotion, ZoomIn } from "react-native-reanimated";

import { AppHeader } from "@/components/AppHeader";
import { RoleChip, TAG_LOOK } from "@/components/Chips";
import { Coin } from "@/components/Coin";
import { Floaty, Mascot } from "@/components/Mascot";
import { RecipientSheet } from "@/components/RecipientSheet";
import {
  Alert,
  Avatar,
  Body,
  Button,
  CHROME_SCALE,
  colors,
  controlHeight,
  ErrorState,
  haptic,
  Icon,
  minTouchTarget,
  Page,
  radius,
  Rich,
  ScreenTitle,
  Sheet,
  Skeleton,
  T,
  TextArea,
  Touchable,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { explain, type Problem, say, sendProblem } from "@/lib/errors";
import { dayMonth } from "@/lib/format";
import { afterAttempt, fingerprintOf, type Intent, intentFor } from "@/lib/idempotency";
import { useMe, useMeRefreshOnFocus } from "@/lib/me";
import {
  amountOptions,
  canSend,
  charCount,
  clampMessage,
  cleanMessage,
  findPerson,
  kudosUsedUp,
  orderedTags,
  selectedAmount,
  TAG_ICONS,
  type TagId,
} from "@/lib/recognition";
import { useRoutes } from "@/lib/routes";
import { useApi, useRefreshOnFocus } from "@/lib/useApi";

type GiveContext = Schemas["GiveContextOut"];
type ShoutoutResult = Schemas["ShoutoutResult"];
type PartyOut = Schemas["PartyOut"];

interface Sent {
  name: string;
  coins: number;
  left: number;
}

/** CR-19: what is left to give, and that it is the company's, not the person's own coins. */
function KudosBanner({ left, allowance, resetsOn }: { left: number; allowance: number; resetsOn: string }) {
  const { t, locale } = useAuth();
  return (
    <View style={styles.banner}>
      <View style={styles.bannerIcon}>
        <Icon name="wallet" size={18} color={colors.rewardInk} />
      </View>
      <Rich
        size={13}
        line={18}
        style={{ flex: 1 }}
        parts={t.rich("give.kudosBanner", { left, allowance, date: dayMonth(resetsOn, locale) })}
      />
    </View>
  );
}

/** The chosen teammate as a field: tap it to open the picker. */
function RecipientField({ person, onPress }: { person: PartyOut | null; onPress: () => void }) {
  const { t } = useAuth();
  return (
    <View style={{ gap: 7 }}>
      <T size={13} weight={800} maxFontSizeMultiplier={CHROME_SCALE}>
        {t("give.to")}
      </T>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={person ? t("give.toA11y", { name: person.name }) : t("give.to")}
        onPress={onPress}
        style={styles.recipient}
      >
        {person ? (
          <>
            <Avatar name={person.name} seed={person.id} size={34} />
            <T size={15} weight={800} numberOfLines={1} style={{ flexShrink: 1 }}>
              {person.name}
            </T>
            {person.role !== "crew" ? <RoleChip role={person.role} /> : null}
            <View style={{ flex: 1 }} />
            <T size={13} weight={800} color={colors.brandInk}>
              {t("give.toChange")}
            </T>
          </>
        ) : (
          <>
            <T size={15} weight={700} color={colors.muted} style={{ flex: 1 }}>
              {t("give.to")}
            </T>
            <Icon name="chev" size={18} color={colors.muted} />
          </>
        )}
      </Touchable>
    </View>
  );
}

function TagPicker({ tags, value, onChange }: { tags: TagId[]; value: TagId | null; onChange: (tag: TagId) => void }) {
  const { t } = useAuth();
  return (
    <View style={{ gap: 7 }}>
      <T size={13} weight={800} maxFontSizeMultiplier={CHROME_SCALE}>
        {t("give.tag")}
      </T>
      <View accessibilityRole="radiogroup" accessibilityLabel={t("give.tag")} style={styles.tags}>
        {tags.map((tag) => {
          const look = TAG_LOOK[tag];
          const on = tag === value;
          return (
            <Touchable
              key={tag}
              haptic="selection"
              accessibilityRole="radio"
              accessibilityLabel={t(`tags.${tag}`)}
              aria-checked={on}
              onPress={() => onChange(tag)}
              style={[styles.tag, { backgroundColor: look.bg, borderColor: on ? look.fg : "transparent" }]}
            >
              <Icon name={TAG_ICONS[tag]} size={14} color={look.fg} stroke={2.4} />
              <T size={12} weight={800} color={look.fg} maxFontSizeMultiplier={CHROME_SCALE}>
                {t(`tags.${tag}`)}
              </T>
            </Touchable>
          );
        })}
      </View>
    </View>
  );
}

/** CR-21: the role's three amounts. Anything over the kudos left is drawn disabled and can
 *  never be chosen, so the server never sees it (acceptance test 2). */
function AmountPicker({
  amounts,
  left,
  value,
  onChange,
}: {
  amounts: readonly number[];
  left: number;
  value: number | null;
  onChange: (amount: number) => void;
}) {
  const { t } = useAuth();
  return (
    <View style={{ gap: 7 }}>
      <T size={13} weight={800} maxFontSizeMultiplier={CHROME_SCALE}>
        {t("give.amount")}
      </T>
      <View accessibilityRole="radiogroup" accessibilityLabel={t("give.amount")} style={styles.amounts}>
        {amountOptions(amounts, left).map((option) => {
          const on = option.value === value;
          return (
            <Touchable
              key={option.value}
              haptic="selection"
              accessibilityRole="radio"
              accessibilityLabel={t("common.coins", { count: option.value })}
              aria-checked={on}
              aria-disabled={!option.enabled}
              disabled={!option.enabled}
              onPress={() => onChange(option.value)}
              style={[styles.amount, on && styles.amountOn, !option.enabled && styles.amountOff]}
            >
              <Coin size={18} />
              <T size={15} weight={900} tabular maxFontSizeMultiplier={CHROME_SCALE}>
                {String(option.value)}
              </T>
            </Touchable>
          );
        })}
      </View>
    </View>
  );
}

/** "Shout-out sent!" (CR-22), with the mascot cheering. Its pop-in and float both sit still
 *  for anyone who asked their phone for reduced motion. */
function SentSheet({
  visible,
  sent,
  onWall,
  onAnother,
}: {
  visible: boolean;
  sent: Sent | null;
  onWall: () => void;
  onAnother: () => void;
}) {
  const { t } = useAuth();
  return (
    <Sheet
      visible={visible}
      onClose={onAnother}
      label={t("give.sentTitle")}
      closeLabel={t("common.close")}
      footer={
        <>
          <Button title={t("give.seeWall")} full onPress={onWall} />
          <Button title={t("give.another")} variant="soft" full onPress={onAnother} />
        </>
      }
    >
      <View style={styles.sent}>
        {visible ? (
          <Animated.View entering={ZoomIn.duration(320).reduceMotion(ReduceMotion.System)}>
            <Floaty>
              <Mascot pose="cheer" size={130} />
            </Floaty>
          </Animated.View>
        ) : (
          <Mascot pose="cheer" size={130} />
        )}
        <T size={24} weight={900} align="center" heading>
          {t("give.sentTitle")}
        </T>
        {sent ? (
          <Rich
            size={14}
            color={colors.muted}
            align="center"
            parts={t.rich("give.sentLead", { name: sent.name, coins: sent.coins, left: sent.left })}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

function GiveSkeleton() {
  return (
    <>
      <Skeleton height={64} corner={16} />
      <Skeleton height={controlHeight.input + 24} corner={radius.control} />
      <Skeleton height={96} corner={radius.control} />
      <Skeleton height={120} corner={radius.control} />
    </>
  );
}

/**
 * Give a shout-out (CR-19 to CR-23), in both tab groups: who, which value, a message, and how
 * many kudos coins. `/give/context` says who this person may recognize, which tags and which
 * amounts are theirs; the screen never works any of that out from the role.
 *
 * Each tap on Send is one intent with its own Idempotency-Key (plan D13); retrying the same
 * draft after a dead connection reuses it, so the coins can never go twice. `?to=<id>` opens
 * it with someone already chosen (CR-20, MG-02); a new `at` with it chooses them again, even
 * when the form has moved on to someone else since the last time.
 */
export function Give() {
  const { t, me } = useAuth();
  const { summary, patch, refresh: refreshMe } = useMe();
  const router = useRouter();
  const routes = useRoutes();
  const params = useLocalSearchParams<{ to?: string; at?: string }>();
  const context = useApi<GiveContext>("/give/context");
  useRefreshOnFocus(context.revalidate);
  useMeRefreshOnFocus();

  const [to, setTo] = useState<string | null>(null);
  const [tag, setTag] = useState<TagId | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [picking, setPicking] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [sentOpen, setSentOpen] = useState(false);
  const intent = useRef<Intent | null>(null);
  // Blocks a second tap in the same frame, before `sending` has re-rendered the button.
  const inFlight = useRef(false);

  const data = context.data;
  const groups = data?.groups ?? [];

  // CR-20: arrive with someone chosen, once the list says they may be recognized.
  const [prefilled, setPrefilled] = useState<string | null>(null);
  const asked = params.to ? `${params.to}@${params.at ?? ""}` : null;
  if (asked && params.to && asked !== prefilled && data && findPerson(groups, params.to)) {
    setPrefilled(asked);
    setTo(params.to);
  }

  // The summary is patched the moment a send answers, so it is the freshest kudos count.
  const kudos = summary?.kudos ?? data?.kudos ?? null;
  const left = kudos?.left ?? 0;
  const amounts = data?.amounts ?? [];
  const tags = orderedTags(data?.tags ?? []);
  const max = data?.message_max ?? 140;
  const recipient = findPerson(groups, to);
  const draft = {
    to: recipient?.id ?? null,
    tag: tag && tags.includes(tag) ? tag : null,
    amount: selectedAmount(amount, amounts, left),
    message,
  };
  const ready = canSend(draft, sending);
  const usedUp = kudos ? kudosUsedUp(amounts, left) : false;

  const edit = <V,>(set: (value: V) => void) => (value: V) => {
    set(value);
    setProblem(null);
  };

  const send = async () => {
    if (!ready || inFlight.current || !draft.to || !draft.tag || draft.amount === null) return;
    inFlight.current = true;
    const body = { to_id: draft.to, tag: draft.tag, coins: draft.amount, message: cleanMessage(message) };
    const current = intentFor(
      intent.current,
      fingerprintOf({ to: body.to_id, tag: body.tag, coins: body.coins, message: body.message }),
    );
    intent.current = current;
    setSending(true);
    setProblem(null);
    try {
      const result = await api<ShoutoutResult>("/shoutouts", {
        method: "POST",
        body,
        headers: { "Idempotency-Key": current.key },
      });
      intent.current = null;
      patch({ kudos: result.kudos });
      haptic("success");
      setSent({ name: result.post.recipient.first_name, coins: result.post.coins, left: result.kudos.left });
      setSentOpen(true);
      setTo(null);
      setTag(null);
      setAmount(null);
      setMessage("");
    } catch (err) {
      intent.current = afterAttempt(current, err);
      haptic("error");
      setProblem(sendProblem(t, err));
      // The server knows better than the form did: forget the choice it refused, and fetch
      // what is allowed now.
      if (err instanceof ApiError) {
        if (err.code === "not_in_scope" || err.code === "recipient_not_found") setTo(null);
        if (err.code === "tag_not_allowed") setTag(null);
        if (err.code === "amount_not_allowed" || err.code === "kudos_insufficient") setAmount(null);
      }
    } finally {
      inFlight.current = false;
      setSending(false);
      void refreshMe();
      void context.revalidate();
    }
  };

  const problemText = problem ? say(t, problem, null) : null;

  return (
    <Page>
      <Body>
        <AppHeader />
        <ScreenTitle title={t("give.title")} lead={t("give.lead")} />

        {!data && context.error ? (
          <ErrorState
            message={`${t("give.loadError")} ${explain(t, context.error)}`}
            retryLabel={t("common.retry")}
            onRetry={() => void context.reload()}
          />
        ) : !data ? (
          <GiveSkeleton />
        ) : (
          <>
            {kudos ? <KudosBanner left={left} allowance={kudos.allowance} resetsOn={kudos.resets_on} /> : null}
            <RecipientField person={recipient} onPress={() => setPicking(true)} />
            <TagPicker tags={tags} value={draft.tag} onChange={edit(setTag)} />
            <TextArea
              label={t("give.message")}
              placeholder={t("give.messagePlaceholder")}
              value={message}
              onChangeText={(text) => edit(setMessage)(clampMessage(text, max))}
              counter={`${charCount(message)} / ${max}`}
              counterLabel={t("give.counterA11y", { count: charCount(message), max })}
            />
            <AmountPicker amounts={amounts} left={left} value={draft.amount} onChange={edit(setAmount)} />
            {usedUp && kudos ? (
              <T size={12} color={colors.muted}>
                {t("give.usedUp", { date: dayMonth(kudos.resets_on, t.locale) })}
              </T>
            ) : null}
            {problemText ? <Alert>{problemText}</Alert> : null}
            <Button
              title={t("give.send")}
              iconRight="send"
              full
              disabled={!ready}
              busy={sending}
              onPress={() => void send()}
            />
          </>
        )}
      </Body>

      <RecipientSheet
        visible={picking}
        groups={groups}
        selectedId={recipient?.id ?? null}
        myStoreId={me?.store?.id ?? null}
        onClose={() => setPicking(false)}
        onPick={(person) => {
          edit(setTo)(person.id);
          setPicking(false);
        }}
      />
      <SentSheet
        visible={sentOpen}
        sent={sent}
        onAnother={() => setSentOpen(false)}
        onWall={() => {
          setSentOpen(false);
          router.navigate(routes.wall);
        }}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.rewardSubtle,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  recipient: {
    minHeight: controlHeight.input,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderColor: colors.controlBorder,
    backgroundColor: colors.raised,
  },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    minHeight: minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: radius.chip,
    borderWidth: 1.5,
  },
  amounts: { flexDirection: "row", gap: 10 },
  amount: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.raised,
  },
  amountOn: { backgroundColor: colors.coinSubtle, borderColor: colors.coin },
  amountOff: { opacity: 0.4 },
  sent: { alignItems: "center", gap: 10, paddingTop: 6 },
});
