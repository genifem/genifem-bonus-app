import { memo } from "react";
import { StyleSheet, View } from "react-native";

import { RewardThumb } from "@/components/RewardThumb";
import { colors, StatusPill, T } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { approverKey, type MyRequest, rewardName, statusKey, statusTone } from "@/lib/rewards";
import { timeAgo } from "@/lib/time";

/**
 * One of the person's own requests (CR-27): the reward, when they asked, what it cost (or
 * "won on the wheel" for a spin prize), and where it stands: Waiting for approval, Ready to
 * collect, Declined, coins returned. One still waiting says who decides it, the GM or the
 * owners, as the server routed it (MG-09). One element to a screen reader. The status sits
 * under the words rather than beside them, so the longer Spanish ones are never cut short.
 */
export const MyRequestRow = memo(function MyRequestRow({
  request,
  now,
  last,
}: {
  request: MyRequest;
  /** The clock, from useNow, so a list shares one tick. */
  now: number;
  last: boolean;
}) {
  const { t, locale } = useAuth();
  const name = rewardName(request, locale);
  const what = request.source === "spin" ? t("rewards.wonOnWheel") : t("common.coins", { count: request.cost });
  const status = t(statusKey(request));
  const decides = request.status === "pending" ? t(approverKey(request.approver)) : null;
  const label = [name, status, decides, what, timeAgo(t, request.created_at, now, true)].filter(Boolean).join(". ");
  return (
    <View accessible accessibilityLabel={label} style={[styles.row, !last && styles.line]}>
      <RewardThumb icon={request.icon} size={40} />
      <View style={styles.words}>
        <T size={14} weight={800}>
          {name}
        </T>
        <T size={11} color={colors.muted}>
          {`${timeAgo(t, request.created_at, now)} · ${what}`}
        </T>
        <View style={styles.status}>
          <StatusPill status={statusTone(request.status)} label={status} />
          {decides ? (
            <T size={11} color={colors.muted}>
              {decides}
            </T>
          ) : null}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12 },
  line: { borderBottomWidth: 1, borderBottomColor: colors.border },
  words: { flex: 1, minWidth: 0, gap: 3 },
  status: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 8, rowGap: 2 },
});
