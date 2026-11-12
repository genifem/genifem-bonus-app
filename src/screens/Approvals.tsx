import type { Translator } from "@crewstars/i18n";
import { memo, useCallback, useReducer, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { CoinPill } from "@/components/Coin";
import { Mascot } from "@/components/Mascot";
import {
  Avatar,
  Body,
  Button,
  Card,
  colors,
  EmptyState,
  ErrorState,
  haptic,
  Page,
  ScreenTitle,
  Sheet,
  Skeleton,
  StatusPill,
  T,
  useToast,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import {
  alreadySettled,
  type Decision,
  initialApprovals,
  type Queues,
  reduceApprovals,
  type RequestRow,
} from "@/lib/approvals";
import { useAuth } from "@/lib/auth";
import { explain } from "@/lib/errors";
import { firstName, formatCount } from "@/lib/format";
import { useMe, useMeRefreshOnFocus } from "@/lib/me";
import { decisionKey, rewardName, statusTone } from "@/lib/rewards";
import { timeAgo } from "@/lib/time";
import { useApi, useRefreshOnFocus } from "@/lib/useApi";
import { useNow } from "@/lib/useNow";

/** What a row costs, or that it was a spin prize. */
function costText(t: Translator, row: RequestRow): string {
  return row.source === "spin" ? t("rewards.wonOnWheel") : t("common.coins", { count: row.cost });
}

/** MG-05: one request waiting for the GM: who, what, how long ago, the cost, and the two
 *  answers. Decline asks first; Approve doesn't. */
const PendingCard = memo(function PendingCard({
  row,
  now,
  onApprove,
  onDecline,
}: {
  row: RequestRow;
  now: number;
  onApprove: (row: RequestRow) => void;
  onDecline: (row: RequestRow) => void;
}) {
  const { t, locale } = useAuth();
  const reward = rewardName(row, locale);
  const who = { name: row.person.name, reward };
  const label = [t("approvals.requestA11y", who), costText(t, row), timeAgo(t, row.created_at, now, true)].join(". ");
  return (
    <Card style={{ gap: 12 }}>
      <View accessible accessibilityLabel={label} style={styles.row}>
        <Avatar name={row.person.name} seed={row.person.id} size={40} />
        <View style={styles.words}>
          <T size={14} weight={800} numberOfLines={1}>
            {row.person.name}
          </T>
          <T size={12} color={colors.muted}>
            {`${reward} · ${timeAgo(t, row.created_at, now)}`}
          </T>
        </View>
        <CoinPill amount={formatCount(row.cost, locale)} label={t("common.coins", { count: row.cost })} />
      </View>
      <View style={styles.actions}>
        <Button
          title={t("approvals.decline")}
          accessibilityLabel={t("approvals.declineA11y", who)}
          variant="ghost"
          size="sm"
          icon="x"
          onPress={() => onDecline(row)}
          style={{ flex: 1 }}
        />
        <Button
          title={t("approvals.approve")}
          accessibilityLabel={t("approvals.approveA11y", who)}
          size="sm"
          icon="check"
          haptic="success"
          onPress={() => onApprove(row)}
          style={{ flex: 2 }}
        />
      </View>
    </Card>
  );
});

/** Plan G5: an approved reward waiting to be handed over, and the button that says it was. */
const ReadyRow = memo(function ReadyRow({
  row,
  now,
  last,
  onCollect,
}: {
  row: RequestRow;
  now: number;
  last: boolean;
  onCollect: (row: RequestRow) => void;
}) {
  const { t, locale } = useAuth();
  const reward = rewardName(row, locale);
  const when = row.decided_at ?? row.created_at;
  return (
    <View style={[styles.listRow, !last && styles.line]}>
      <View
        accessible
        accessibilityLabel={[
          t("approvals.requestA11y", { name: row.person.name, reward }),
          costText(t, row),
          timeAgo(t, when, now, true),
        ].join(". ")}
        style={[styles.row, { flex: 1, minWidth: 0 }]}
      >
        <Avatar name={row.person.name} seed={row.person.id} size={34} />
        <View style={styles.words}>
          <T size={14} weight={800} numberOfLines={1}>
            {row.person.name}
          </T>
          <T size={12} color={colors.muted}>
            {`${reward} · ${costText(t, row)}`}
          </T>
        </View>
      </View>
      <Button
        title={t("approvals.collect")}
        accessibilityLabel={t("approvals.collectA11y", { reward, name: row.person.name })}
        variant="soft"
        size="sm"
        onPress={() => onCollect(row)}
      />
    </View>
  );
});

/** MG-07: one of the last five decisions, Approved or Declined. */
function RecentRow({ row, last }: { row: RequestRow; last: boolean }) {
  const { t, locale } = useAuth();
  const reward = rewardName(row, locale);
  const decision = t(decisionKey(row.status));
  return (
    <View
      accessible
      accessibilityLabel={[t("approvals.requestA11y", { name: row.person.name, reward }), costText(t, row), decision].join(
        ". ",
      )}
      style={[styles.listRow, !last && styles.line]}
    >
      <View style={styles.words}>
        <T size={14} weight={800} numberOfLines={1}>
          {row.person.name}
        </T>
        <T size={12} color={colors.muted}>
          {`${reward} · ${costText(t, row)}`}
        </T>
      </View>
      <StatusPill status={statusTone(row.status)} label={decision} />
    </View>
  );
}

/** Decline asks first (MG-06): what happens to the coins, the limits, and that the person is
 *  told. The last request stays drawn while the sheet slides away. */
function DeclineSheet({
  row,
  onClose,
  onConfirm,
}: {
  row: RequestRow | null;
  onClose: () => void;
  onConfirm: (row: RequestRow) => void;
}) {
  const { t, locale } = useAuth();
  const [shown, setShown] = useState(row);
  if (row && row !== shown) setShown(row);
  return (
    <Sheet
      visible={!!row}
      onClose={onClose}
      label={t("approvals.declineTitle")}
      closeLabel={t("common.close")}
      title={t("approvals.declineTitle")}
      footer={
        <>
          <Button
            title={t("approvals.decline")}
            full
            haptic="warning"
            onPress={() => {
              if (shown) onConfirm(shown);
            }}
          />
          <Button title={t("common.cancel")} variant="ghost" full onPress={onClose} />
        </>
      }
    >
      {shown ? (
        <T size={14} color={colors.muted}>
          {t("approvals.declineLead", {
            name: firstName(shown.person.name),
            reward: rewardName(shown, locale),
            count: shown.cost,
          })}
        </T>
      ) : null}
    </Sheet>
  );
}

function ApprovalsSkeleton() {
  return (
    <>
      <Skeleton height={132} />
      <Skeleton height={132} />
      <Skeleton height={120} />
    </>
  );
}

/**
 * Approvals (MG-05 to MG-07): the store's requests waiting for the GM, oldest first, the
 * approved ones still to be handed over, and the last five decisions. Every action is
 * optimistic (approvals.ts): the row goes at once, and comes back with the reason if the
 * server says no. Each one refreshes the summary, which carries the tab's badge (D12).
 */
export function Approvals() {
  const { t } = useAuth();
  const { refresh: refreshMe } = useMe();
  const toast = useToast();
  const now = useNow();
  const requests = useApi<Queues>("/manager/requests");
  const [state, dispatch] = useReducer(reduceApprovals, initialApprovals);
  const [seen, setSeen] = useState<Queues | null>(null);
  const [declining, setDeclining] = useState<RequestRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Actions still on their way: the lists are fetched again once none are, so an answer from
  // before one of them can't put its row back.
  const busy = useRef(0);
  useRefreshOnFocus(requests.revalidate);
  useMeRefreshOnFocus();

  // Every answer from the server replaces the lists, keeping rows mid-action off them.
  if (requests.data && requests.data !== seen) {
    setSeen(requests.data);
    dispatch({ type: "loaded", queues: requests.data });
  }

  const { revalidate } = requests;
  const act = useCallback(
    async (row: RequestRow, decision: Decision) => {
      busy.current += 1;
      dispatch({ type: "start", id: row.id, decision });
      const name = firstName(row.person.name);
      try {
        const answer = await api<RequestRow>(`/reward-requests/${encodeURIComponent(row.id)}/${decision}`, {
          method: "POST",
        });
        dispatch({ type: "done", id: row.id, row: answer });
        if (decision === "approve") toast.show(t("approvals.approved", { name }));
        else if (decision === "decline") toast.show(t("approvals.declined", { count: row.cost, name }));
        else toast.show(t("approvals.collected", { reward: rewardName(row, t.locale), name }));
      } catch (err) {
        dispatch(
          err instanceof ApiError && alreadySettled(err.code) ? { type: "gone", id: row.id } : { type: "failed", id: row.id },
        );
        haptic("error");
        toast.show(explain(t, err), { icon: "info" });
      } finally {
        busy.current -= 1;
        void refreshMe();
        if (busy.current === 0) void revalidate();
      }
    },
    [t, toast, refreshMe, revalidate],
  );

  const approve = useCallback((row: RequestRow) => void act(row, "approve"), [act]);
  const collect = useCallback((row: RequestRow) => void act(row, "collect"), [act]);
  const askDecline = useCallback((row: RequestRow) => setDeclining(row), []);

  const pull = async () => {
    setRefreshing(true);
    await Promise.all([refreshMe(), revalidate()]);
    setRefreshing(false);
  };

  const queues = state.queues;

  return (
    <Page refreshing={refreshing} onRefresh={() => void pull()}>
      <Body>
        <AppHeader />
        <ScreenTitle title={t("approvals.title")} lead={t("approvals.lead")} />

        {!queues && requests.error ? (
          <ErrorState
            message={`${t("approvals.loadError")} ${explain(t, requests.error)}`}
            retryLabel={t("common.retry")}
            onRetry={() => void requests.reload()}
          />
        ) : !queues ? (
          <ApprovalsSkeleton />
        ) : (
          <>
            {queues.pending.length ? (
              queues.pending.map((row) => (
                <PendingCard key={row.id} row={row} now={now} onApprove={approve} onDecline={askDecline} />
              ))
            ) : (
              <EmptyState
                art={<Mascot pose="cheer" size={110} />}
                title={t("approvals.emptyTitle")}
                lead={t("approvals.emptyLead")}
              />
            )}

            {queues.ready.length ? (
              <>
                <View style={styles.section}>
                  <T size={17} weight={900} heading>
                    {t("approvals.ready")}
                  </T>
                  <T size={12} color={colors.muted}>
                    {t("approvals.readyLead")}
                  </T>
                </View>
                <Card style={styles.list}>
                  {queues.ready.map((row, index) => (
                    <ReadyRow
                      key={row.id}
                      row={row}
                      now={now}
                      last={index === queues.ready.length - 1}
                      onCollect={collect}
                    />
                  ))}
                </Card>
              </>
            ) : null}

            {queues.recent.length ? (
              <>
                <T size={17} weight={900} heading style={{ marginBottom: -8 }}>
                  {t("approvals.recent")}
                </T>
                <Card style={styles.list}>
                  {queues.recent.map((row, index) => (
                    <RecentRow key={row.id} row={row} last={index === queues.recent.length - 1} />
                  ))}
                </Card>
              </>
            ) : null}
          </>
        )}
      </Body>

      <DeclineSheet
        row={declining}
        onClose={() => setDeclining(null)}
        onConfirm={(row) => {
          setDeclining(null);
          void act(row, "decline");
        }}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  words: { flex: 1, minWidth: 0, gap: 1 },
  actions: { flexDirection: "row", gap: 10 },
  section: { gap: 2, marginBottom: -6 },
  list: { paddingVertical: 4 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, minHeight: 56 },
  line: { borderBottomWidth: 1, borderBottomColor: colors.border },
});
