import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Mascot } from "@/components/Mascot";
import { MyRequestRow } from "@/components/MyRequestRow";
import {
  Body,
  Button,
  Card,
  colors,
  EmptyState,
  ErrorState,
  Page,
  Rich,
  ScreenHeader,
  ScreenTitle,
  Skeleton,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { explain } from "@/lib/errors";
import { formatCount } from "@/lib/format";
import { useMe, useMeRefreshOnFocus } from "@/lib/me";
import type { MyRequest } from "@/lib/rewards";
import { useRoutes } from "@/lib/routes";
import { useApi, useRefreshOnFocus } from "@/lib/useApi";
import { useNow } from "@/lib/useNow";

/** The most requests the list shows: a busy year, at three a month. */
const LIMIT = 50;

/**
 * My rewards (CR-27), pushed from the Rewards tab and from Profile, and the way a GM redeems
 * (MG-09): every request, newest first, with where it stands (Waiting for approval, Ready to
 * collect, Declined, coins returned...) and spin prizes marked "won on the wheel". Coming back
 * to it, or pulling down, fetches the list again, so a decision shows as soon as it's made.
 */
export function MyRewards() {
  const { t, locale } = useAuth();
  const { summary, refresh: refreshMe } = useMe();
  const router = useRouter();
  const routes = useRoutes();
  const now = useNow();
  const list = useApi<MyRequest[]>(`/me/reward-requests?limit=${LIMIT}`);
  const [refreshing, setRefreshing] = useState(false);
  useRefreshOnFocus(list.revalidate);
  useMeRefreshOnFocus();

  const pull = async () => {
    setRefreshing(true);
    await Promise.all([refreshMe(), list.revalidate()]);
    setRefreshing(false);
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace(routes.home));
  const browse = () => router.navigate(routes.rewards);
  const requests = list.data ?? [];

  return (
    <Page refreshing={refreshing} onRefresh={() => void pull()} bottomInset>
      <Body>
        <ScreenHeader onBack={back} />
        <ScreenTitle title={t("myRewards.title")} lead={t("myRewards.lead")} />

        {summary ? (
          <View style={styles.balance}>
            <Rich
              size={14}
              style={{ flex: 1 }}
              parts={t.rich("myRewards.balance", {
                count: summary.balance,
                amount: formatCount(summary.balance, locale),
              })}
            />
            <Button title={t("myRewards.browse")} size="sm" variant="soft" onPress={browse} />
          </View>
        ) : null}

        {list.loading && !list.data ? (
          <Skeleton height={240} />
        ) : list.error && !list.data ? (
          <ErrorState
            message={`${t("myRewards.loadError")} ${explain(t, list.error)}`}
            retryLabel={t("common.retry")}
            onRetry={() => void list.reload()}
            error={list.error}
          />
        ) : requests.length ? (
          <Card style={styles.list}>
            {requests.map((request, index) => (
              <MyRequestRow key={request.id} request={request} now={now} last={index === requests.length - 1} />
            ))}
          </Card>
        ) : (
          <EmptyState
            art={<Mascot pose="happy" size={96} />}
            title={t("myRewards.emptyTitle")}
            lead={t("myRewards.emptyLead")}
            action={<Button title={t("myRewards.browse")} variant="soft" onPress={browse} style={{ marginTop: 6 }} />}
          />
        )}
      </Body>
    </Page>
  );
}

const styles = StyleSheet.create({
  balance: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    backgroundColor: colors.coinSubtle,
    borderRadius: 16,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,
  },
  list: { paddingVertical: 0 },
});
