import { type StyleProp, StyleSheet, type ViewStyle } from "react-native";

import { colors, Icon, radius, T, Touchable } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { spinTile, type WheelOut } from "@/lib/spin";

/**
 * The Spin tile on Home (CR-12, `.tile` on lilac): "N spins ready", or the most useful status
 * when there are none (coins to the next spin, all this month's spins earned). It opens Spin.
 * The screen hides it while the owners have spins turned off (plan D19).
 *
 * `ready` is the summary's count when it has one: the Spin screen patches it the moment a
 * spin is used, ahead of the wheel's own refetch.
 */
export function SpinTile({
  wheel,
  ready,
  onPress,
  style,
}: {
  wheel: WheelOut;
  ready?: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { t, locale } = useAuth();
  const text = spinTile({ ...wheel, spins_available: ready ?? wheel.spins_available }, locale);
  const title = t(text.title.key, text.title.values);
  const lead = t(text.lead.key, text.lead.values);
  return (
    <Touchable
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={t("home.spinTileA11y", { title, lead })}
      onPress={onPress}
      style={[styles.tile, style]}
    >
      <Icon name="wheel" size={26} color={colors.rewardInk} />
      <T size={15} weight={900} line={18}>
        {title}
      </T>
      <T size={12} color={colors.rewardInk} line={16}>
        {lead}
      </T>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.rewardSubtle,
    borderRadius: radius.card,
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 6,
    minHeight: 104,
  },
});
