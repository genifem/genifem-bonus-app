import type { Locale } from "@crewstars/i18n";
import { useRouter } from "expo-router";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { Linking, StyleSheet, Switch, View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { BadgeGrid } from "@/components/BadgeGrid";
import { RoleChip, TierChip } from "@/components/Chips";
import { Coin } from "@/components/Coin";
import { PostCard, type PostOut } from "@/components/PostCard";
import {
  Avatar,
  Body,
  Card,
  colors,
  ErrorState,
  Icon,
  LanguageSwitch,
  minTouchTarget,
  Page,
  Segmented,
  Skeleton,
  T,
  TextLink,
  Touchable,
  useToast,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { earnedCount, type MyBadge } from "@/lib/badges";
import { explain } from "@/lib/errors";
import { formatCount } from "@/lib/format";
import { translatorFor } from "@/lib/i18n";
import { useMe, useMeRefreshOnFocus } from "@/lib/me";
import { useRoutes } from "@/lib/routes";
import { useApi, useRefreshOnFocus } from "@/lib/useApi";
import { useLikes } from "@/lib/useLikes";
import { useNow } from "@/lib/useNow";
import { usePush } from "@/lib/usePush";

type Direction = "received" | "sent";

function Stat({ value, label, coin = false }: { value: string; label: string; coin?: boolean }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={styles.stat}>
      <View style={styles.statValue}>
        {coin ? <Coin size={18} /> : null}
        <T size={20} weight={900} tabular numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </T>
      </View>
      <T size={11} color={colors.muted} align="center">
        {label}
      </T>
    </View>
  );
}

/** A row in a settings card (`.setrow`). */
function Row({ children, last = false }: { children: ReactNode; last?: boolean }) {
  return <View style={[styles.setRow, !last && styles.setRowLine]}>{children}</View>;
}

/**
 * CR-34's notifications on/off, for this person everywhere (`notifications_on`; the server
 * sends no pushes while it is off). The switch moves at once and goes back if the save fails.
 * Turning it on also sets this phone up (usePush): the app's own explanation if the phone has
 * not been asked yet, then the phone's question. A phone where they are blocked says so, with
 * the way to its settings, since only they can unblock them.
 */
function NotificationsSetting() {
  const { t, me, savePreferences } = useAuth();
  const { permission, enable } = usePush();
  const toast = useToast();
  const [draft, setDraft] = useState<boolean | null>(null);
  // Two quick taps send two saves; only the last one's answer moves the switch back.
  const sent = useRef(0);
  const on = draft ?? me?.notifications_on ?? false;

  const toggle = () => {
    const next = !on;
    const save = ++sent.current;
    setDraft(next);
    savePreferences({ notifications_on: next })
      .then(() => {
        if (save === sent.current) setDraft(null);
      })
      .catch(() => {
        if (save !== sent.current) return;
        setDraft(null);
        toast.show(t("profile.pushNotSaved"), { icon: "info" });
      });
    if (next) void enable();
  };

  return (
    <View style={[styles.setting, styles.setRowLine]}>
      <Touchable
        accessibilityRole="switch"
        accessibilityLabel={t("profile.push")}
        accessibilityHint={t("profile.pushLead")}
        aria-checked={on}
        haptic="selection"
        onPress={toggle}
        style={styles.switchRow}
      >
        <Icon name="bell" size={20} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T weight={700}>{t("profile.push")}</T>
          <T size={12} color={colors.muted}>
            {t("profile.pushLead")}
          </T>
        </View>
        {/* Drawn only: the whole row is the control, so the target is the row, not the knob. */}
        <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Switch
            value={on}
            trackColor={{ false: colors.controlBorder, true: colors.brandInk }}
            thumbColor={colors.raised}
            ios_backgroundColor={colors.controlBorder}
          />
        </View>
      </Touchable>
      {on && permission === "denied" ? (
        <View style={styles.pushHint}>
          <T size={12} color={colors.muted}>
            {t("profile.pushBlocked")}
          </T>
          <TextLink
            title={t("profile.openSettings")}
            role="button"
            align="flex-start"
            onPress={() => void Linking.openSettings()}
          />
        </View>
      ) : on && permission === "undetermined" ? (
        <View style={styles.pushHint}>
          <TextLink title={t("profile.pushAllow")} role="button" align="flex-start" onPress={() => void enable()} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * The profile (CR-32 to CR-34), in both tab groups: who this is (role, store, tier), coins
 * earned all time and this month and shout-outs given (`shoutouts_given` on the summary),
 * the badge grid (CR-33), their latest shout-outs received and sent, the way to the
 * leaderboard and the month's awards (CR-35, CR-36), to My rewards (CR-27; for a GM the only
 * way, MG-09) and to notifications, and settings: the language, notifications on or off, and
 * signing out.
 *
 * The language changes on screen at once (NF-02) and is then saved to the profile, so the
 * texts and the next phone this person signs in on use it too. A save that fails says so,
 * but leaves the switch where it is: it still holds on this phone.
 */
export function Profile() {
  const { t, me, locale, signOut, setLocale, savePreferences } = useAuth();
  const { summary, error, refresh: refreshMe } = useMe();
  const toast = useToast();
  const router = useRouter();
  const routes = useRoutes();
  const now = useNow();
  const [direction, setDirection] = useState<Direction>("received");
  const [refreshing, setRefreshing] = useState(false);
  const received = useApi<PostOut[]>("/me/shoutouts?direction=received&limit=4");
  const sent = useApi<PostOut[]>("/me/shoutouts?direction=sent&limit=4");
  const badges = useApi<MyBadge[]>("/me/badges");
  const likes = useLikes({ onSettled: () => void refreshMe() });
  const { forgetSettled } = likes;

  useMeRefreshOnFocus();
  useRefreshOnFocus(badges.revalidate);
  const { revalidate: revalidateReceived } = received;
  const { revalidate: revalidateSent } = sent;
  const revalidateLists = useCallback(async () => {
    await Promise.all([revalidateReceived(), revalidateSent()]);
    forgetSettled();
  }, [revalidateReceived, revalidateSent, forgetSettled]);
  useRefreshOnFocus(revalidateLists);

  const pull = async () => {
    setRefreshing(true);
    await Promise.all([refreshMe(), revalidateLists(), badges.revalidate()]);
    setRefreshing(false);
  };

  const chooseLanguage = (language: Locale) => {
    void setLocale(language);
    savePreferences({ language }).catch(() => {
      // In the language just chosen: `t` still speaks the one being left.
      toast.show(translatorFor(language)("profile.languageNotSaved"), { icon: "info" });
    });
  };

  const list = direction === "received" ? received : sent;
  const posts = list.data ?? [];
  const unread = summary?.unread_notifications ?? 0;
  const coinsLabel = (count: number) => t("profile.myRewardsCoins", { count, amount: formatCount(count, locale) });
  const place = me?.store
    ? t("header.store", { number: me.store.number, name: me.store.name })
    : (me?.area?.name ?? "");

  return (
    <Page refreshing={refreshing} onRefresh={() => void pull()}>
      <Body>
        <AppHeader />
        <View style={styles.who}>
          <Avatar name={me?.name ?? ""} seed={me?.id} size={76} />
          <T size={24} weight={900} align="center" heading>
            {me?.name}
          </T>
          <View style={styles.roleLine}>
            {me ? <RoleChip role={me.role} /> : null}
            {place ? (
              <T size={12} color={colors.muted}>
                {place}
              </T>
            ) : null}
          </View>
          {summary ? <TierChip tier={summary.tier} /> : null}
        </View>

        {summary ? (
          <Card padding={0} style={styles.stats}>
            <Stat coin value={formatCount(summary.lifetime, locale)} label={t("profile.lifetime")} />
            <View style={styles.statLine} />
            <Stat value={formatCount(summary.earned_this_month, locale)} label={t("profile.thisMonth")} />
            <View style={styles.statLine} />
            <Stat value={formatCount(summary.shoutouts_given, locale)} label={t("profile.given")} />
          </Card>
        ) : error ? (
          <ErrorState
            message={`${t("profile.loadError")} ${explain(t, error)}`}
            retryLabel={t("common.retry")}
            onRetry={() => void refreshMe()}
            error={error}
          />
        ) : (
          <Skeleton height={76} />
        )}

        <View style={styles.section}>
          <T size={17} weight={900} heading style={{ flex: 1 }}>
            {t("badges.title")}
          </T>
          {badges.data ? (
            <T size={12} weight={700} color={colors.muted} tabular>
              {t("badges.earnedCount", { count: earnedCount(badges.data) })}
            </T>
          ) : null}
        </View>
        {badges.data ? (
          <Card style={styles.badges}>
            {badges.data.length ? (
              <BadgeGrid badges={badges.data} now={now} />
            ) : (
              <T size={13} color={colors.muted} align="center">
                {t("badges.empty")}
              </T>
            )}
          </Card>
        ) : badges.error ? (
          <ErrorState
            message={`${t("badges.loadError")} ${explain(t, badges.error)}`}
            retryLabel={t("common.retry")}
            onRetry={() => void badges.reload()}
            error={badges.error}
            compact
          />
        ) : (
          <Skeleton height={220} />
        )}

        <T size={17} weight={900} heading style={{ marginBottom: -6 }}>
          {t("profile.shoutouts")}
        </T>
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
          <Skeleton height={132} />
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
          <Card style={{ alignItems: "center", paddingVertical: 20 }}>
            <T size={13} color={colors.muted} align="center">
              {direction === "sent" ? t("home.emptySent") : t("home.emptyReceived")}
            </T>
          </Card>
        )}

        <Card style={styles.rows}>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={t("profile.leaderboard")}
            onPress={() => router.push(routes.leaderboard)}
          >
            <Row>
              <Icon name="trophy" size={20} color={colors.brand} />
              <T weight={700} style={{ flex: 1 }}>
                {t("profile.leaderboard")}
              </T>
              <Icon name="chev" size={16} color={colors.muted} />
            </Row>
          </Touchable>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={
              summary ? `${t("profile.myRewards")}, ${coinsLabel(summary.balance)}` : t("profile.myRewards")
            }
            onPress={() => router.push(routes.myRewards)}
          >
            <Row>
              <Icon name="gift" size={20} color={colors.brand} />
              <T weight={700} style={{ flex: 1 }}>
                {t("profile.myRewards")}
              </T>
              {summary ? (
                <T size={12} weight={800} color={colors.coinInk} tabular>
                  {coinsLabel(summary.balance)}
                </T>
              ) : null}
              <Icon name="chev" size={16} color={colors.muted} />
            </Row>
          </Touchable>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={
              unread > 0 ? t("header.notificationsUnread", { count: unread }) : t("profile.notifications")
            }
            onPress={() => router.push(routes.notifications)}
          >
            <Row last>
              <Icon name="bell" size={20} color={colors.brand} />
              <T weight={700} style={{ flex: 1 }}>
                {t("profile.notifications")}
              </T>
              {unread > 0 ? (
                <T size={12} weight={800} color={colors.brandInk}>
                  {t("profile.unreadCount", { count: unread })}
                </T>
              ) : null}
              <Icon name="chev" size={16} color={colors.muted} />
            </Row>
          </Touchable>
        </Card>

        <T size={17} weight={900} heading style={{ marginBottom: -6 }}>
          {t("profile.settings")}
        </T>
        <Card style={styles.rows}>
          <Row>
            <Icon name="globe" size={20} />
            <T weight={700} style={{ flex: 1 }}>
              {t("common.language")}
            </T>
            <LanguageSwitch onChange={chooseLanguage} />
          </Row>
          <NotificationsSetting />
          <Touchable accessibilityRole="button" accessibilityLabel={t("common.signOut")} onPress={() => void signOut()}>
            <Row last>
              <Icon name="logout" size={20} color={colors.brandInk} />
              <T weight={800} color={colors.brandInk} style={{ flex: 1 }}>
                {t("common.signOut")}
              </T>
            </Row>
          </Touchable>
        </Card>
      </Body>
    </Page>
  );
}

const styles = StyleSheet.create({
  who: { alignItems: "center", gap: 8 },
  roleLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  stats: { flexDirection: "row" },
  stat: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 14, paddingHorizontal: 6 },
  statValue: { flexDirection: "row", alignItems: "center", gap: 5 },
  statLine: { width: 1, alignSelf: "stretch", backgroundColor: colors.border },
  section: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: -6 },
  badges: { paddingVertical: 16 },
  rows: { paddingVertical: 4 },
  setRow: { minHeight: minTouchTarget + 12, flexDirection: "row", alignItems: "center", gap: 10 },
  setRowLine: { borderBottomWidth: 1, borderBottomColor: colors.border },
  setting: { paddingBottom: 4 },
  switchRow: { minHeight: minTouchTarget + 12, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  pushHint: { paddingLeft: 30, marginTop: -4, gap: 0 },
});
