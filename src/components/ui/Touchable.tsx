import * as Haptics from "expo-haptics";
import { forwardRef } from "react";
import {
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { motion } from "./theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type HapticKind = "none" | "selection" | "light" | "success" | "warning" | "error";

/** A tap the hand can feel: a tick for choosing, a bump for a press, a pattern for an outcome.
 *  Nothing on the web, and never where the phone's own settings turn haptics off. */
export function haptic(kind: HapticKind): void {
  if (kind === "none" || Platform.OS === "web") return;
  if (kind === "selection") void Haptics.selectionAsync();
  else if (kind === "light") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  else
    void Haptics.notificationAsync(
      kind === "success"
        ? Haptics.NotificationFeedbackType.Success
        : kind === "warning"
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Error,
    );
}

export interface TouchableProps extends Omit<PressableProps, "style"> {
  /** How a press shows: the control fades a little (default), or also settles by 3%. */
  feedback?: "opacity" | "scale" | "none";
  haptic?: HapticKind;
  style?: StyleProp<ViewStyle>;
}

const ease = Easing.bezier(...motion.easing.standard);

/**
 * The only way the app makes something pressable. Every press answers under the finger - the
 * boards drew pressed states for everything, and before this most controls had none - and
 * the answer is the same everywhere: a short fade (or fade and settle for a solid button),
 * eased, and flat for anyone who asked their phone for reduced motion.
 */
export const Touchable = forwardRef<View, TouchableProps>(function Touchable(
  { feedback = "opacity", haptic: kind = "none", style, onPressIn, onPressOut, onPress, disabled, ...rest },
  ref,
) {
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => {
    if (feedback === "none") return {};
    const opacity = 1 - pressed.value * (feedback === "scale" ? 0.12 : 0.35);
    return feedback === "scale"
      ? { opacity, transform: [{ scale: 1 - pressed.value * 0.03 }] }
      : { opacity };
  });
  const to = (value: number) =>
    withTiming(value, { duration: motion.duration.fast, easing: ease, reduceMotion: ReduceMotion.System });

  return (
    <AnimatedPressable
      ref={ref}
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        pressed.value = to(1);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = to(0);
        onPressOut?.(event);
      }}
      onPress={(event) => {
        haptic(kind);
        onPress?.(event);
      }}
      style={[style, animated]}
    />
  );
});
