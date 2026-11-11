import type { BottomTabBarProps } from "expo-router/js-tabs";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { useAuth } from "@/lib/auth";

import { Icon, type IconName } from "./Icon";
import { IconButton, T } from "./primitives";
import { colors, gutter, maxWidth, minTouchTarget, motion, radius, shadow } from "./theme";
import { Touchable } from "./Touchable";

/** Android draws edge to edge, so the window no longer shrinks for the keyboard; the page
 *  makes room itself. iOS scroll views move focused fields into view on their own. */
const keyboardBehaviour = Platform.OS === "android" ? "padding" : undefined;

/**
 * A screen: the cream page, safe from the notch, one column that stops growing at 640 so a
 * tablet gets the phone layout centred. A `footer` is pinned under the scroll.
 *
 * A field that gets focus is kept above the keyboard, and a drag down the page puts the
 * keyboard away.
 */
export function Page({
  children,
  refreshing,
  onRefresh,
  footer,
  footerStyle,
  bottomInset = false,
  scrollToTopKey,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  footerStyle?: StyleProp<ViewStyle>;
  /** Pad for the home indicator; not needed above a tab bar, which does its own. */
  bottomInset?: boolean;
  /** When this changes the page goes back to the top (the next setup step opens at its start). */
  scrollToTopKey?: string | number;
}) {
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    if (scrollToTopKey !== undefined) scroll.current?.scrollTo({ y: 0, animated: false });
  }, [scrollToTopKey]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.page}>
      <KeyboardAvoidingView behavior={keyboardBehaviour} style={styles.page}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={[styles.column, !footer && bottomInset && { paddingBottom: insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={colors.brand}
                colors={[colors.brand]}
                progressBackgroundColor={colors.raised}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
        {footer ? (
          <View style={[styles.footer, { paddingBottom: Math.max(28, insets.bottom + 12) }, footerStyle]}>
            <View style={styles.footerInner}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** The padded body of a screen (`.m-scroll`): 18 at the sides, stacked with a gap. `fill`
 *  stretches it to the screen's height, so `<Spacer />` can push buttons to the bottom. */
export function Body({
  children,
  gap = 16,
  top = 18,
  fill = false,
  style,
}: {
  children: ReactNode;
  gap?: number;
  top?: number;
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ paddingHorizontal: gutter, paddingTop: top, paddingBottom: 28, gap }, fill && { flex: 1 }, style]}>
      {children}
    </View>
  );
}

/** Takes up the free height in a `fill` body. */
export function Spacer() {
  return <View style={{ flex: 1 }} />;
}

/** The back row (`BackBar`): a 44px back button and an optional label beside it. */
export function ScreenHeader({
  onBack,
  backLabel,
  label,
  right,
}: {
  onBack?: () => void;
  backLabel?: string;
  label?: string;
  right?: ReactNode;
}) {
  const { t } = useAuth();
  return (
    <View style={styles.header}>
      {onBack ? (
        <IconButton icon="back" label={backLabel ?? t("common.back")} onPress={onBack} style={styles.back} />
      ) : null}
      {label ? (
        <T size={15} weight={800} numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </T>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {right}
    </View>
  );
}

/** A screen's title (`.m-title`): 27, black, tightened, with an optional lead under it. */
export function ScreenTitle({ title, lead }: { title: string; lead?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <T size={27} weight={900} tracking={-0.6} heading maxFontSizeMultiplier={1.3}>
        {title}
      </T>
      {lead ? (
        <T size={13} color={colors.muted}>
          {lead}
        </T>
      ) : null}
    </View>
  );
}

const enter = Easing.bezier(...motion.easing.enter);
const exit = Easing.bezier(...motion.easing.exit);

/**
 * A bottom sheet: a real modal, so a screen reader stays inside it, the Android back button
 * closes it, and a tap on the scrim dismisses it.
 *
 * The scrim fades while the panel rises, and both go back the way they came before the modal
 * is removed. The body scrolls when it is taller than the screen allows, a field inside is
 * kept above the keyboard, and `footer` stays pinned under the body. With `title`, the sheet
 * draws its own header row with a close button.
 */
export function Sheet({
  visible,
  onClose,
  label,
  closeLabel,
  title,
  footer,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  label: string;
  closeLabel: string;
  title?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  // Opening mounts the modal at once; closing keeps it until the exit animation has run.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      progress.value = withTiming(1, {
        duration: motion.duration.sheet,
        easing: enter,
        reduceMotion: ReduceMotion.System,
      });
    } else {
      progress.value = withTiming(
        0,
        { duration: motion.duration.base, easing: exit, reduceMotion: ReduceMotion.System },
        (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        },
      );
    }
  }, [visible, progress]);

  const scrim = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panel = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * Math.min(height, 720) }],
  }));
  const bottom = Math.max(26, insets.bottom + 12);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.sheetRoot}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrim]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View accessibilityViewIsModal accessibilityLabel={label} style={[styles.sheet, panel]}>
          <View style={styles.handle} />
          {title ? (
            <View style={styles.sheetHeader}>
              <T size={18} weight={900} heading style={{ flex: 1 }}>
                {title}
              </T>
              <IconButton icon="x" label={closeLabel} onPress={onClose} />
            </View>
          ) : null}
          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={{ gap: 14, paddingBottom: footer ? 4 : bottom }}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {children}
          </ScrollView>
          {footer ? <View style={[styles.sheetFooter, { paddingBottom: bottom }]}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export interface TabItem {
  /** The route name in the tab layout. */
  name: string;
  label: string;
  icon: IconName;
  /** Drawn as the raised red Give button in the middle of the bar. */
  primary?: boolean;
  /** A count on the tab (pending approvals). Nothing shows at 0. */
  badge?: number;
  /** What a screen reader hears for the count ("3 waiting"). */
  badgeLabel?: string;
}

/**
 * The bottom bar (`.m-nav`): five places on paper, the current one in red-action, and Give as
 * a raised red button in the middle. 8px under it, or the device's own inset if that is
 * bigger, clears the home indicator. A tab ticks under the finger when it changes the page.
 */
export function TabBar({
  state,
  navigation,
  items,
  label,
}: BottomTabBarProps & { items: readonly TabItem[]; label: string }) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(8, insets.bottom) }]}>
      <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.barInner}>
        {items.map((item) => {
          const active = item.name === current;
          const color = active ? colors.brandInk : colors.muted;
          const count = item.badge ?? 0;
          return (
            <Touchable
              key={item.name}
              haptic={active ? "none" : "selection"}
              accessibilityRole="tab"
              aria-selected={active}
              accessibilityLabel={count > 0 && item.badgeLabel ? `${item.label}, ${item.badgeLabel}` : item.label}
              onPress={() => {
                const route = state.routes.find((candidate) => candidate.name === item.name);
                const event = navigation.emit({
                  type: "tabPress",
                  target: route?.key,
                  canPreventDefault: true,
                });
                if (!active && !event.defaultPrevented) navigation.navigate(item.name);
              }}
              style={styles.tab}
            >
              {item.primary ? (
                <View style={styles.give}>
                  <Icon name={item.icon} size={20} color={colors.brandFg} />
                </View>
              ) : (
                <Icon name={item.icon} size={22} color={color} />
              )}
              <T size={11} weight={800} color={color} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {item.label}
              </T>
              {count > 0 ? (
                <View style={styles.badge} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                  <T size={10} weight={900} color={colors.brandFg} tabular maxFontSizeMultiplier={1.2}>
                    {count > 99 ? "99+" : String(count)}
                  </T>
                </View>
              ) : null}
            </Touchable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  column: { width: "100%", maxWidth, alignSelf: "center", flexGrow: 1 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.raised,
    paddingTop: 16,
    paddingHorizontal: gutter,
  },
  footerInner: { width: "100%", maxWidth: maxWidth - gutter * 2, alignSelf: "center", gap: 10 },
  header: { minHeight: minTouchTarget, flexDirection: "row", alignItems: "center", gap: 4 },
  // The prototype pulls the back arrow out to the gutter's edge.
  back: { marginLeft: -10 },
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    width: "100%",
    maxWidth,
    alignSelf: "center",
    backgroundColor: colors.raised,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: 14,
    paddingHorizontal: 20,
    gap: 14,
    maxHeight: "92%",
    boxShadow: shadow.sheet,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetBody: { flexGrow: 0, flexShrink: 1 },
  sheetFooter: { paddingTop: 12, gap: 10 },
  handle: { width: 40, height: 5, borderRadius: radius.pill, backgroundColor: colors.handle, alignSelf: "center" },
  bar: {
    backgroundColor: colors.raised,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 9,
    paddingHorizontal: 6,
  },
  barInner: { flexDirection: "row", width: "100%", maxWidth, alignSelf: "center" },
  tab: { flex: 1, minHeight: 60, alignItems: "center", justifyContent: "center", gap: 3 },
  give: {
    width: 46,
    height: 40,
    borderRadius: radius.control,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: shadow.giveTab,
  },
  badge: {
    position: "absolute",
    top: 6,
    right: "50%",
    marginRight: -20,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brandInk,
    alignItems: "center",
    justifyContent: "center",
  },
});
