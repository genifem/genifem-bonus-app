import { type ReactNode, useEffect, useId } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

export type MascotPose = "coin" | "wave" | "cheer" | "happy";

const STAR =
  "100,22 123.5,67.6 174.2,75.9 138,112.4 145.8,163.1 100,140 54.2,163.1 62,112.4 25.8,75.9 76.5,67.6";

/**
 * The prototype draws a little past its 200 box (the wave lines, the cheer sparkles) with
 * overflow visible, which react-native-svg cannot do on Android. So the canvas is widened by
 * this much on every side and pulled back with negative margins: the layout box stays `size`
 * and nothing is clipped.
 */
const BLEED = 10;

/**
 * The star mascot, ported shape for shape from the prototype: coin (holding a coin), wave,
 * cheer (mouth open, sparkles) and happy. Always decorative; the words next to it say what
 * it means.
 */
export function Mascot({ pose = "coin", size = 140 }: { pose?: MascotPose; size?: number }) {
  // One set of gradient ids per drawing, so two mascots on a screen never share a fill.
  const id = `m${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const cheer = pose === "cheer";
  const wave = pose === "wave";
  const coin = pose === "coin";
  const rotation = wave ? -9 : cheer ? 5 : 0;
  const scale = size / 200;
  const drawn = size + 2 * BLEED * scale;

  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Svg
        width={drawn}
        height={drawn}
        viewBox={`${-BLEED} ${-BLEED} ${200 + 2 * BLEED} ${200 + 2 * BLEED}`}
        style={{ margin: -BLEED * scale }}
      >
        <Defs>
          <LinearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFEA7A" />
            <Stop offset="0.55" stopColor="#FFCB2E" />
            <Stop offset="1" stopColor="#F6A812" />
          </LinearGradient>
          <RadialGradient id={`${id}h`} cx="0.35" cy="0.3" r="0.6">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={`${id}c`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFF0A8" />
            <Stop offset="1" stopColor="#F2A21E" />
          </LinearGradient>
        </Defs>

        <Ellipse cx={100} cy={193} rx={44} ry={5} fill="#1E1A2B" opacity={0.1} />

        {cheer ? (
          <G>
            <Path d="M28 30q0 10 10 10q-10 0-10 10q0-10-10-10q10 0 10-10z" fill="#E63946" />
            <Path d="M176 18q0 8 8 8q-8 0-8 8q0-8-8-8q8 0 8-8z" fill="#8C7BFF" />
            <Path d="M186 136q0 9 9 9q-9 0-9 9q0-9-9-9q9 0 9-9z" fill="#F5B700" />
          </G>
        ) : null}
        {wave ? (
          <G fill="none" stroke="#E63946" strokeWidth={4} strokeLinecap="round">
            <Path d="M182 52q9 7 6 18" />
            <Path d="M192 44q13 10 9 27" />
          </G>
        ) : null}

        <G rotation={rotation} originX={100} originY={110}>
          <Path d="M90 144L86 171M110 144L114 171" stroke="#1E1A2B" strokeWidth={5} strokeLinecap="round" />
          <Rect x={70} y={167} width={28} height={16} rx={8} fill="#E63946" />
          <Rect x={70} y={179} width={28} height={5} rx={2.5} fill="#FFFFFF" />
          <Rect x={102} y={167} width={28} height={16} rx={8} fill="#E63946" />
          <Rect x={102} y={179} width={28} height={5} rx={2.5} fill="#FFFFFF" />
          <Circle cx={79} cy={173} r={1.8} fill="#FFFFFF" />
          <Circle cx={121} cy={173} r={1.8} fill="#FFFFFF" />

          <Polygon
            points={STAR}
            fill={`url(#${id}b)`}
            stroke={`url(#${id}b)`}
            strokeWidth={22}
            strokeLinejoin="round"
          />
          <Polygon points={STAR} fill={`url(#${id}h)`} stroke="none" />

          <Ellipse cx={88} cy={94} rx={5.5} ry={7.5} fill="#1E1A2B" />
          <Ellipse cx={112} cy={94} rx={5.5} ry={7.5} fill="#1E1A2B" />
          <Circle cx={90} cy={91} r={2.2} fill="#FFFFFF" />
          <Circle cx={114} cy={91} r={2.2} fill="#FFFFFF" />
          <Ellipse cx={76} cy={107} rx={7} ry={4} fill="#FF6B6B" opacity={0.45} />
          <Ellipse cx={124} cy={107} rx={7} ry={4} fill="#FF6B6B" opacity={0.45} />

          {cheer ? (
            <G>
              <Path d="M89 104q11 19 22 0z" fill="#1E1A2B" />
              <Path d="M94 112q6 6 12 0q-6-3-12 0z" fill="#E63946" />
            </G>
          ) : (
            <Path d="M91 106q9 9 18 0" fill="none" stroke="#1E1A2B" strokeWidth={3.5} strokeLinecap="round" />
          )}

          {coin ? (
            <G>
              <Circle cx={141} cy={127} r={8} fill="#FFCB2E" />
              <Circle cx={150} cy={138} r={22} fill={`url(#${id}c)`} stroke="#E3961A" strokeWidth={3} />
              <Circle cx={150} cy={138} r={15} fill="none" stroke="#FFF3CC" strokeWidth={2} />
              <Path
                d="M150 130l2.1 5.1 5.5.4-4.2 3.6 1.3 5.4-4.7-2.9-4.7 2.9 1.3-5.4-4.2-3.6 5.5-.4z"
                fill="#B26A00"
              />
              <Circle cx={133} cy={142} r={7} fill="#FFCB2E" />
            </G>
          ) : null}
        </G>
      </Svg>
    </View>
  );
}

const float = Easing.inOut(Easing.ease);

/** The prototype's `.floaty`: a slow 8px bob, 3.4 s a cycle. Still for anyone who asked their
 *  phone for reduced motion. */
export function Floaty({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    y.value = withRepeat(
      withSequence(withTiming(-8, { duration: 1700, easing: float }), withTiming(0, { duration: 1700, easing: float })),
      -1,
    );
  }, [reduce, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
