import { View } from "react-native";

import { colors, Icon } from "@/components/ui";
import { rewardIcon, type RewardIconName } from "@/lib/rewards";

/** Each reward glyph's tile (the prototype's REWARD_ICONS), from the soft token fills. */
const TILE: Record<RewardIconName, string> = {
  burger: colors.accentSubtle,
  cup: colors.infoSubtle,
  calendar: colors.successSubtle,
  gift: colors.rewardSubtle,
  shirt: colors.infoSubtle,
  sun: colors.coinSubtle,
  fries: colors.brandSubtle,
  star: colors.coinSubtle,
};

/** A reward's glyph on its tile (`.reward .thumb`). Decorative: its name is beside it. */
export function RewardThumb({ icon, size = 64 }: { icon: string; size?: number }) {
  const glyph = rewardIcon(icon);
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size / 4),
        backgroundColor: TILE[glyph],
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={glyph} size={Math.round(size * 0.47)} stroke={1.8} />
    </View>
  );
}
