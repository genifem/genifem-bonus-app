import { StyleSheet, View } from "react-native";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";

import { colors, fonts } from "@/components/ui";
import { fitLabel, HUB, lineY, segmentCentre, segmentPath, VIEW } from "@/lib/wheel";

/**
 * The segments' fills, in order round the wheel (the prototype's PRIZE_COLORS). Ten of them,
 * so a wheel of up to ten prizes never repeats one, and all light enough for ink labels.
 */
export const PRIZE_COLORS = [
  "#FFD873",
  "#FFFFFF",
  "#FFB4A0",
  "#FFC94D",
  "#CFC6FF",
  "#FBF1E6",
  "#A8E6CC",
  "#FFE4E6",
  "#BFE0FF",
  "#FFE7D6",
] as const;

/** The paper ring round the wheel (the prototype's 8px `box-shadow` ring). */
const RING = 8;
/** How far the pointer reaches above the wheel. */
const POINTER_LIFT = 12;
/** The hub's star, in the coin's yellow. */
const HUB_STAR = "M150 137l3.9 8 8.8 1.3-6.4 6.2 1.5 8.8-7.8-4.1-7.8 4.1 1.5-8.8-6.4-6.2 8.8-1.3z";
const HUB_GOLD = "#FFC928";

export interface WheelPrize {
  id: string;
  /** In the language on screen. */
  label: string;
}

/**
 * The prize wheel (CR-28), drawn as the prototype draws it: the owner's 3 to 10 prizes in
 * order, clockwise from 12 o'clock, each in its own colour with its label near the rim, an
 * ink hub with the star, and the red pointer fixed at the top.
 *
 * It turns by `rotation` (degrees), which the Spin screen animates on the UI thread to the
 * segment the server chose. To a screen reader it is one image that names every prize.
 */
export function Wheel({
  prizes,
  rotation,
  size,
  label,
}: {
  prizes: readonly WheelPrize[];
  rotation: SharedValue<number>;
  size: number;
  label: string;
}) {
  const turned = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));
  const count = prizes.length;
  const inner = size - RING * 2;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.frame, { width: size, height: size, marginTop: POINTER_LIFT }]}
    >
      <View style={[styles.rim, { width: size, height: size, borderRadius: size / 2 }]}>
        <Animated.View style={[{ width: inner, height: inner }, turned]}>
          <Svg width={inner} height={inner} viewBox={`0 0 ${VIEW} ${VIEW}`}>
            <Circle cx={HUB} cy={HUB} r={148} fill={colors.raised} />
            {prizes.map((prize, index) => {
              const fitted = fitLabel(prize.label, count);
              return (
                <G key={prize.id}>
                  <Path
                    d={segmentPath(index, count)}
                    fill={PRIZE_COLORS[index % PRIZE_COLORS.length]}
                    stroke={colors.raised}
                    strokeWidth={2}
                  />
                  <G rotation={segmentCentre(index, count)} originX={HUB} originY={HUB}>
                    {fitted.lines.map((line, row) => (
                      <SvgText
                        key={row}
                        x={HUB}
                        y={lineY(row, fitted.fontSize)}
                        textAnchor="middle"
                        fontFamily={fonts[900]}
                        fontSize={fitted.fontSize}
                        fill={colors.foreground}
                      >
                        {line}
                      </SvgText>
                    ))}
                  </G>
                </G>
              );
            })}
            <Circle cx={HUB} cy={HUB} r={26} fill={colors.foreground} />
            <Path d={HUB_STAR} fill={HUB_GOLD} />
          </Svg>
        </Animated.View>
      </View>
      <View style={[styles.pointer, { left: (size - 34) / 2 }]}>
        <Svg width={34} height={40} viewBox="0 0 34 40">
          <Path
            d="M5 3h24a3 3 0 0 1 2.4 4.7L19.4 35a3 3 0 0 1-4.8 0L2.6 7.7A3 3 0 0 1 5 3z"
            fill={colors.brand}
            stroke={colors.raised}
            strokeWidth={1.5}
          />
          <Circle cx={17} cy={12} r={4} fill={colors.raised} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: "center" },
  rim: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.raised,
    boxShadow: "0 18px 40px rgba(30,26,43,0.18)",
  },
  pointer: { position: "absolute", top: -POINTER_LIFT },
});
