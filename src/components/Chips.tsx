import type { Schemas } from "@crewstars/api-client";
import { StyleSheet, View } from "react-native";

import { CHROME_SCALE, colors, Icon, radius, T } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { isTagId, TAG_ICONS, type TagId } from "@/lib/recognition";
import { tierName } from "@/lib/tiers";

type Role = Schemas["PartyOut"]["role"];

/** Each value tag's pair (the prototype's TAGS), from the token pairs that are all checked at
 *  4.5:1 or better, so no screen names a hex of its own. */
export const TAG_LOOK: Record<TagId, { fg: string; bg: string }> = {
  guest: { fg: colors.brandInk, bg: colors.brandSubtle },
  rush: { fg: colors.coinInk, bg: colors.coinSubtle },
  team: { fg: colors.successInk, bg: colors.successSubtle },
  clean: { fg: colors.infoInk, bg: colors.infoSubtle },
  above: { fg: colors.rewardInk, bg: colors.rewardSubtle },
  lead: { fg: colors.accentInk, bg: colors.accentSubtle },
};

/** Role chips (plan §13): owner ink, director lilac, supervisor sky, GM peach, shift mint,
 *  crew neutral. */
const ROLE_LOOK: Record<Role, { fg: string; bg: string }> = {
  owner: { fg: colors.inverseFg, bg: colors.inverse },
  director: { fg: colors.rewardInk, bg: colors.rewardSubtle },
  supervisor: { fg: colors.infoInk, bg: colors.infoSubtle },
  gm: { fg: colors.accentInk, bg: colors.accentSubtle },
  shift: { fg: colors.successInk, bg: colors.successSubtle },
  crew: { fg: colors.muted, bg: colors.surface },
};

/** A shout-out's value tag (`.chip`): its glyph and name on its own colour. A long name
 *  ("A todo ritmo en hora pico") wraps inside the chip rather than running out of it (NF-02). */
export function TagChip({ tag }: { tag: string }) {
  const { t } = useAuth();
  const known = isTagId(tag);
  const look = known ? TAG_LOOK[tag] : { fg: colors.muted, bg: colors.surface };
  return (
    <View style={[styles.chip, { backgroundColor: look.bg }]}>
      {known ? <Icon name={TAG_ICONS[tag]} size={12} color={look.fg} stroke={2.4} /> : null}
      <T size={11} weight={800} color={look.fg} maxFontSizeMultiplier={CHROME_SCALE} style={styles.words}>
        {known ? t(`tags.${tag}`) : tag}
      </T>
    </View>
  );
}

/** A monthly award on a trophy post, in place of the tag. Its name carries the month
 *  ("Héroe del cliente de noviembre"), so it wraps too. */
export function AwardChip({ name }: { name: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: colors.raised }]}>
      <Icon name="trophy" size={12} color={colors.coinInk} stroke={2.4} />
      <T size={11} weight={800} color={colors.coinInk} maxFontSizeMultiplier={CHROME_SCALE} style={styles.words}>
        {name}
      </T>
    </View>
  );
}

/** Someone's role, small and in capitals (`.rolechip`): "GM", "Shift Manager". */
export function RoleChip({ role }: { role: Role }) {
  const { t } = useAuth();
  const look = ROLE_LOOK[role];
  return (
    <View style={[styles.role, { backgroundColor: look.bg }]}>
      <T size={10.5} weight={900} color={look.fg} upper tracking={0.4} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {t(`roles.${role}.short`)}
      </T>
    </View>
  );
}

/** The person's tier (`.tierchip`): the award glyph in the tier's own colour, and its name. */
export function TierChip({ tier }: { tier: { name: string; name_es?: string | null; color: string } }) {
  const { t, locale } = useAuth();
  return (
    <View style={styles.tier}>
      <Icon name="award" size={14} color={tier.color} filled stroke={1.5} />
      <T size={12} weight={800} maxFontSizeMultiplier={CHROME_SCALE} style={styles.words}>
        {t("tiers.chip", { tier: tierName(tier, locale) })}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  role: { alignSelf: "center", borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6 },
  words: { flexShrink: 1 },
  tier: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingLeft: 7,
    paddingRight: 10,
  },
});
