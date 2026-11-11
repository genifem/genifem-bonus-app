import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "./Icon";
import { T } from "./primitives";
import { colors, maxWidth, motion, radius } from "./theme";

interface ToastOptions {
  /** The glyph before the words; a tick by default, as in the prototype. */
  icon?: IconName | null;
  /** How long it stays, in ms. */
  duration?: number;
}

interface ToastValue {
  /** Show a short confirmation over the bottom of the screen. A new one replaces the last. */
  show: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

interface Current {
  id: number;
  message: string;
  icon: IconName | null;
}

/** Room for the tab bar under it (`.toast` sits 92 above the phone's bottom edge). */
const ABOVE_TAB_BAR = 92;

/**
 * The prototype's toast: an ink pill with a tick, gone after 2.4 s. It is a polite live
 * region, so a screen reader reads it without moving focus: Android through the live region,
 * the web through role="status", and iOS (which has no live regions) through an explicit
 * announcement.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<Current | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const show = useCallback((message: string, options?: ToastOptions) => {
    seq.current += 1;
    setCurrent({ id: seq.current, message, icon: options?.icon === undefined ? "check" : options.icon });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCurrent(null), options?.duration ?? motion.duration.toast);
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(message);
  }, []);

  const value = useMemo<ToastValue>(() => ({ show }), [show]);

  return (
    <ToastContext value={value}>
      {children}
      <View pointerEvents="none" style={[styles.layer, { bottom: insets.bottom + ABOVE_TAB_BAR }]}>
        {current ? (
          <Animated.View
            key={current.id}
            entering={FadeIn.duration(motion.duration.base).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.duration(motion.duration.base).reduceMotion(ReduceMotion.System)}
            role="status"
            aria-live="polite"
            accessibilityLiveRegion="polite"
            accessible
            accessibilityLabel={current.message}
            style={styles.toast}
          >
            {current.icon ? <Icon name={current.icon} size={16} color={colors.inverseFg} stroke={2.6} /> : null}
            <T size={13} weight={800} color={colors.inverseFg} numberOfLines={2} style={{ flexShrink: 1 }}>
              {current.message}
            </T>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext>
  );
}

export function useToast(): ToastValue {
  const value = use(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}

const styles = StyleSheet.create({
  layer: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: {
    maxWidth: Math.min(maxWidth, 520),
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.inverse,
  },
});
