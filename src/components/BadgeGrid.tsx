import { StyleSheet, View } from "react-native";

import { CHROME_SCALE, colors, Icon, ProgressBar, T } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { badgeIcon, type BadgeIconName, badgeName, badgeProgress, howToEarn, type MyBadge } from "@/lib/badges";
import { momentDate } from "@/lib/time";

/** Each glyph's pair (the prototype's BADGE_STYLE), from the token pairs that are all checked
 *  at 4.5:1 or better, so no screen names a hex of its own. */
const BADGE_LOOK: Partial<Record<BadgeIconName, { fg: string; bg: string }>> = {
  heart: { fg: colors.brandInk, bg: colors.brandSubtle },
  users: { fg: colors.successInk, bg: colors.successSubtle },
  bolt: { fg: colors.coinInk, bg: colors.coinSubtle },
  sparkle: { fg: colors.infoInk, bg: colors.infoSubtle },
  send: { fg: colors.rewardInk, bg: colors.rewardSubtle },
  calendar: { fg: colors.accentInk, bg: colors.accentSubtle },
  star: { fg: colors.coinInk, bg: colors.coinSubtle },
};
const DEFAULT_LOOK = { fg: colors.coinInk, bg: colors.coinSubtle };

/** One square: the glyph in colour when earned, else a padlock on a dashed grey disc with how
 *  to earn it and how far along they are. One element to a screen reader. */
function BadgeCell({ badge, now }: { badge: MyBadge; now: number }) {
  const { t, locale } = useAuth();
  const name = badgeName(badge, locale);
  const icon = badgeIcon(badge.icon);
  const look = BADGE_LOOK[icon] ?? DEFAULT_LOOK;
  const progress = badgeProgress(badge);

  if (badge.earned) {
    const date = badge.earned_at ? momentDate(badge.earned_at, locale, now) : null;
    return (
      <View
        accessible
        accessibilityLabel={date ? t("badges.earnedA11y", { badge: name, date }) : name}
        style={styles.cell}
      >
        <View style={[styles.disc, { backgroundColor: look.bg }]}>
          <Icon name={icon} size={26} color={look.fg} />
        </View>
        <T size={12} weight={800} align="center" line={15} maxFontSizeMultiplier={CHROME_SCALE}>
          {name}
        </T>
        {date ? (
          <T size={10.5} color={colors.muted} align="center" line={13} maxFontSizeMultiplier={CHROME_SCALE}>
            {t("badges.earnedOn", { date })}
          </T>
        ) : null}
      </View>
    );
  }

  const how = howToEarn(t, badge);
  const values = progress ? { value: progress.value, count: progress.target } : null;
  const label = [t("badges.lockedA11y", { badge: name, how }), values ? t("badges.progressA11y", values) : null]
    .filter(Boolean)
    .join(" ");
  return (
    <View accessible accessibilityLabel={label} style={styles.cell}>
      <View style={[styles.disc, styles.locked]}>
        <Icon name="lock" size={20} color={colors.muted} />
      </View>
      <T size={12} weight={800} color={colors.muted} align="center" line={15} maxFontSizeMultiplier={CHROME_SCALE}>
        {name}
      </T>
      <T size={10.5} color={colors.muted} align="center" line={13} maxFontSizeMultiplier={CHROME_SCALE}>
        {how}
      </T>
      {progress && values ? (
        <View style={styles.progress}>
          <ProgressBar value={progress.fraction} color={colors.coin} height={5} />
          <T size={10.5} weight={700} color={colors.muted} align="center" tabular maxFontSizeMultiplier={CHROME_SCALE}>
            {t("badges.progress", values)}
          </T>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The badge grid (CR-33, `.badges`): three to a row, in the owners' order. Earned badges in
 * colour with the day they were earned; locked ones greyed out with how to earn them and
 * progress so far. Lucky Star is only in the list once it has been won (the API leaves it
 * out until then).
 */
export function BadgeGrid({ badges, now }: { badges: readonly MyBadge[]; now: number }) {
  return (
    <View style={styles.grid}>
      {badges.map((badge) => (
        <View key={badge.id} style={styles.slot}>
          <BadgeCell badge={badge} now={now} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 16, marginHorizontal: -4 },
  slot: { width: "33.333%", paddingHorizontal: 4 },
  cell: { alignItems: "center", gap: 6 },
  disc: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  locked: {
    backgroundColor: colors.well,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.dashed,
  },
  progress: { alignSelf: "stretch", gap: 4, paddingHorizontal: 6 },
});
