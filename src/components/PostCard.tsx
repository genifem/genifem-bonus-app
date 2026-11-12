import type { Schemas } from "@crewstars/api-client";
import { memo } from "react";
import { StyleSheet, View } from "react-native";

import { AwardChip, TagChip } from "@/components/Chips";
import { CoinPill } from "@/components/Coin";
import { Avatar, Card, CHROME_SCALE, colors, Icon, IconButton, minTouchTarget, T, Touchable } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { isTagId } from "@/lib/recognition";
import { timeAgo } from "@/lib/time";

export type PostOut = Schemas["PostOut"];

/**
 * One shout-out (CR-17, `.card.post`): who got it, who it is from (with their role when they
 * are not crew), the coins, the tag, the message, how long ago, and the heart. A monthly award
 * (CR-18) is drawn on butter with a trophy in place of the tag.
 *
 * The words are one element to a screen reader ("Maria recognized Ana for Guest Hero..."),
 * and the heart and the ⋯ menu are buttons of their own beside them.
 */
export const PostCard = memo(function PostCard({
  post,
  meId,
  now,
  liked,
  likes,
  onLike,
  onMore,
}: {
  post: PostOut;
  meId: string | undefined;
  /** The clock, from useNow, so a list shares one tick. */
  now: number;
  /** What the heart shows (optimistic, from useLikes), as plain values so the card only
   *  draws again when they change. */
  liked: boolean;
  likes: number;
  onLike: (post: PostOut) => void;
  /** Present only when this person may hide the post (`can_hide`, plan G3). */
  onMore?: (post: PostOut) => void;
}) {
  const { t } = useAuth();
  const { sender, recipient } = post;
  const award = post.is_award;
  const awardName = post.award_name ?? "";
  const recipientName = recipient.id === meId ? t("post.you") : recipient.name;
  const tagName = isTagId(post.tag) ? t(`tags.${post.tag}`) : post.tag;

  let from: string;
  if (award) from = t("post.awardWinner", { award: awardName });
  else if (!sender) from = t("post.fromCrewStars");
  else if (sender.id === meId) from = t("post.fromYou");
  else if (sender.role === "crew") from = t("post.from", { name: sender.name });
  else from = t("post.fromRole", { name: sender.name, role: t(`roles.${sender.role}.short`) });

  // Full names here, not "You": "Maria recognized You" reads oddly, and "reconoció a Tú"
  // is wrong in Spanish.
  const summary = [
    award
      ? t("post.summaryAward", { recipient: recipient.name, award: awardName })
      : t("post.summary", { sender: sender?.name ?? t("common.appName"), recipient: recipient.name, tag: tagName }),
    t("common.plusCoins", { count: post.coins }),
    post.message ? `“${post.message}”` : null,
    timeAgo(t, post.created_at, now, true),
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <Card style={[styles.card, award && styles.award]}>
      <View accessible accessibilityLabel={summary} style={styles.body}>
        <View style={styles.top}>
          <Avatar name={recipient.name} seed={recipient.id} size={38} />
          <View style={styles.names}>
            <T size={14} weight={800} numberOfLines={1}>
              {recipientName}
            </T>
            <T size={11} color={colors.muted} numberOfLines={2}>
              {from}
            </T>
          </View>
          <CoinPill amount={post.coins} plus label={t("common.plusCoins", { count: post.coins })} />
        </View>
        {award ? <AwardChip name={awardName} /> : <TagChip tag={post.tag} />}
        {post.message ? <T size={14}>{`“${post.message}”`}</T> : null}
      </View>
      <View style={styles.meta}>
        <T size={11} color={colors.muted} style={{ flex: 1 }} importantForAccessibility="no" accessibilityElementsHidden>
          {timeAgo(t, post.created_at, now)}
        </T>
        {onMore ? (
          <IconButton icon="more" label={t("post.more")} color={colors.muted} size={20} onPress={() => onMore(post)} />
        ) : null}
        <Touchable
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={t("post.like", { count: likes })}
          aria-pressed={liked}
          onPress={() => onLike(post)}
          style={styles.like}
        >
          <Icon
            name="heart"
            size={18}
            color={liked ? colors.brand : colors.muted}
            filled={liked}
            stroke={liked ? 2 : 2.2}
          />
          <T
            size={12}
            weight={800}
            tabular
            color={liked ? colors.brandInk : colors.muted}
            maxFontSizeMultiplier={CHROME_SCALE}
          >
            {String(likes)}
          </T>
        </Touchable>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { gap: 4 },
  award: { backgroundColor: colors.coinSubtle, borderColor: colors.coinStrong },
  body: { gap: 9 },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  names: { flex: 1, minWidth: 0 },
  meta: { flexDirection: "row", alignItems: "center", marginBottom: -8, marginRight: -6 },
  like: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 6,
  },
});
