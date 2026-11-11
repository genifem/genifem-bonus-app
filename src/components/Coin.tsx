import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { colors, radius, T } from "@/components/ui";

/** The gold coin, as the prototype draws it. Decorative: the amount beside it carries the
 *  meaning. */
export function Coin({ size = 16 }: { size?: number }) {
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={11.5} fill="#F0A800" />
        <Circle cx={12} cy={12} r={9} fill="#FFC928" />
        <Circle cx={12} cy={12} r={9} fill="none" stroke="#FFE27A" strokeWidth={1} />
        <Path
          d="M12 6.8l1.55 3.15 3.45.5-2.5 2.45.6 3.45-3.1-1.65-3.1 1.65.6-3.45-2.5-2.45 3.45-.5z"
          fill="#B36F00"
        />
      </Svg>
    </View>
  );
}

/**
 * A coin amount on butter (`.coinpill`): "+15", "1,240", "60 to go". The words are gold-ink
 * on butter (5.25:1). `label` is what a screen reader hears instead, since "+15" alone does
 * not say coins.
 */
export function CoinPill({
  amount,
  label,
  plus = false,
  suffix,
}: {
  amount: number | string;
  label: string;
  plus?: boolean;
  suffix?: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 4,
        backgroundColor: colors.coinSubtle,
        borderRadius: radius.pill,
        paddingVertical: 3,
        paddingLeft: 4,
        paddingRight: 9,
      }}
    >
      {plus ? (
        <T size={13} weight={900} color={colors.coinInk}>
          +
        </T>
      ) : null}
      <Coin size={15} />
      <T size={13} weight={900} color={colors.coinInk} tabular numberOfLines={1}>
        {suffix ? `${amount} ${suffix}` : String(amount)}
      </T>
    </View>
  );
}
