import { LOCALES, type Locale, type RichPart } from "@crewstars/i18n";
import { type ReactNode, type Ref, useEffect, useState } from "react";
import {
  ActivityIndicator,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useAuth } from "@/lib/auth";
import { isOffline } from "@/lib/errors";
import { initials } from "@/lib/format";

import { Icon, type IconName } from "./Icon";
import {
  colors,
  controlHeight,
  fontFamily,
  minTouchTarget,
  radius,
  shadow,
  type Weight,
} from "./theme";
import { type HapticKind, Touchable } from "./Touchable";

/** Chrome (buttons, pills, labels in a fixed row) grows with the phone's text size up to this
 *  much, then stops, so the largest settings enlarge it without breaking it. Body text is
 *  never capped. */
export const CHROME_SCALE = 1.4;

/* ---------------------------------------------------------------- text */

export interface TProps extends TextProps {
  size?: number;
  weight?: Weight;
  color?: string;
  line?: number;
  align?: TextStyle["textAlign"];
  tabular?: boolean;
  upper?: boolean;
  /** Letter spacing in px (the prototype tightens its titles: -0.6 at 27, -1 at 36). */
  tracking?: number;
  heading?: boolean;
}

/** All text in the app: Nunito, with the right font file for each weight. */
export function T({
  size = 14,
  weight = 400,
  color = colors.foreground,
  line,
  align,
  tabular,
  upper,
  tracking,
  heading,
  style,
  ...rest
}: TProps) {
  return (
    <Text
      accessibilityRole={heading ? "header" : undefined}
      {...rest}
      style={[
        {
          fontFamily: fontFamily(weight),
          fontSize: size,
          lineHeight: line ?? Math.round(size * (size >= 24 ? 1.15 : 1.45)),
          color,
          letterSpacing: tracking ?? 0,
          textAlign: align,
          fontVariant: tabular ? ["tabular-nums"] : undefined,
          textTransform: upper ? "uppercase" : undefined,
        },
        style,
      ]}
    />
  );
}

/** A message with bold runs (`t.rich`), e.g. the coins used this month on Rewards. */
export function Rich({
  parts,
  boldColor = colors.foreground,
  ...props
}: TProps & { parts: RichPart[]; boldColor?: string }) {
  return (
    <T {...props}>
      {parts.map((part, index) =>
        part.bold ? (
          <T key={index} size={props.size} weight={800} color={boldColor}>
            {part.text}
          </T>
        ) : (
          part.text
        ),
      )}
    </T>
  );
}

/* ---------------------------------------------------------------- buttons */

/** primary: the red pill (red-action behind white words). soft: red-soft behind red-action
 *  words. ghost: an outline in the page's colour. */
export type ButtonVariant = "primary" | "soft" | "ghost";
/** md is the prototype's 50 tall pill; sm is drawn at 38 there and kept at 44 here, the
 *  smallest target a finger gets. */
export type ButtonSize = "md" | "sm";

const HEIGHT: Record<ButtonSize, number> = { md: controlHeight.button, sm: minTouchTarget };
const LABEL: Record<ButtonSize, number> = { md: 15, sm: 13 };

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  busy = false,
  icon,
  iconRight,
  full = false,
  accessibilityLabel,
  haptic,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Shows a spinner and blocks presses; the label stays so the width does not jump. */
  busy?: boolean;
  /** An icon before the words. */
  icon?: IconName;
  /** An icon after the words ("Continue ›"). */
  iconRight?: IconName;
  full?: boolean;
  accessibilityLabel?: string;
  haptic?: HapticKind;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || busy;
  // Busy is working, not off: it keeps its colours. A disabled control is exempt from the
  // contrast rule, which is why the prototype's faint red is allowed here and nowhere else.
  const muted = disabled && !busy;
  const palette: { bg: string; fg: string; border: string; lift?: string } = {
    primary: {
      bg: muted ? colors.brandFaint : colors.brandInk,
      fg: colors.brandFg,
      border: "transparent",
      lift: muted ? undefined : shadow.button,
    },
    soft: {
      bg: colors.brandSubtle,
      fg: muted ? colors.softDisabledFg : colors.brandInk,
      border: "transparent",
    },
    ghost: { bg: "transparent", fg: colors.muted, border: colors.border },
  }[variant];
  return (
    <Touchable
      feedback="scale"
      haptic={haptic}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      aria-disabled={off}
      aria-busy={busy}
      disabled={off}
      onPress={onPress}
      style={[
        styles.button,
        {
          minHeight: HEIGHT[size],
          paddingHorizontal: size === "sm" ? 14 : 20,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          alignSelf: full ? "stretch" : "auto",
          boxShadow: palette.lift,
        },
        style,
      ]}
    >
      {/* The spinner sits over the words rather than beside them, so the width stays. */}
      <View style={[styles.buttonContent, busy && styles.hidden]}>
        {icon ? <Icon name={icon} size={size === "sm" ? 16 : 18} color={palette.fg} stroke={2.6} /> : null}
        <T
          size={LABEL[size]}
          weight={900}
          color={palette.fg}
          numberOfLines={2}
          align="center"
          maxFontSizeMultiplier={CHROME_SCALE}
          style={{ flexShrink: 1 }}
        >
          {title}
        </T>
        {iconRight ? <Icon name={iconRight} size={18} color={palette.fg} stroke={2.6} /> : null}
      </View>
      {busy ? <ActivityIndicator color={palette.fg} style={StyleSheet.absoluteFill} /> : null}
    </Touchable>
  );
}

/** A round, borderless 44px target with one icon. The label is required: it is all a screen
 *  reader hears. */
export function IconButton({
  icon,
  label,
  onPress,
  color = colors.foreground,
  size = 22,
  style,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.iconButton, style]}
    >
      <Icon name={icon} size={size} color={color} stroke={2.4} />
    </Touchable>
  );
}

/** Words that act, in red-action (never the decorative red), 44 tall. */
export function TextLink({
  title,
  onPress,
  size = 13,
  disabled = false,
  align = "center",
  role = "link",
}: {
  title: string;
  onPress: () => void;
  size?: number;
  disabled?: boolean;
  align?: "center" | "flex-start" | "flex-end";
  role?: "link" | "button";
}) {
  return (
    <Touchable
      accessibilityRole={role}
      accessibilityLabel={title}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={[styles.textLink, { alignSelf: align }]}
    >
      <T
        size={size}
        weight={800}
        color={disabled ? colors.muted : colors.brandInk}
        maxFontSizeMultiplier={CHROME_SCALE}
      >
        {title}
      </T>
    </Touchable>
  );
}

/* ---------------------------------------------------------------- status */

export type PillStatus = "pending" | "approved" | "declined" | "info";

/** A state as a small pill (`.status` in the prototype): always a word, never colour alone.
 *  It never grows past its row, and a long Spanish state wraps inside it rather than being
 *  cut short (NF-02). */
export function StatusPill({ status, label, icon }: { status: PillStatus; label: string; icon?: IconName }) {
  const look: Record<PillStatus, { bg: string; fg: string }> = {
    pending: { bg: colors.warningSubtle, fg: colors.warningInk },
    approved: { bg: colors.successSubtle, fg: colors.successInk },
    declined: { bg: colors.surface, fg: colors.muted },
    info: { bg: colors.infoSubtle, fg: colors.infoInk },
  };
  const { bg, fg } = look[status];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={12} color={fg} stroke={2.4} /> : null}
      <T size={11} weight={800} color={fg} maxFontSizeMultiplier={1.3} style={{ flexShrink: 1 }}>
        {label}
      </T>
    </View>
  );
}

/** A thin bar (`.bar` in the prototype): progress to the next tier, giving coins left. */
export function ProgressBar({
  value,
  color = colors.coin,
  track = colors.surface,
  height = 9,
  label,
}: {
  value: number;
  color?: string;
  track?: string;
  height?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View
      accessible={!!label}
      accessibilityRole={label ? "progressbar" : undefined}
      accessibilityLabel={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(clamped * 100) : undefined}
      style={{ height, borderRadius: radius.pill, backgroundColor: track, overflow: "hidden" }}
    >
      <View style={{ width: `${clamped * 100}%`, height: "100%", borderRadius: radius.pill, backgroundColor: color }} />
    </View>
  );
}

/* ---------------------------------------------------------------- people */

function hash(seed: string): number {
  let value = 0;
  for (const char of seed) value = (value * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(value);
}

/** Initials on a soft disc, the same colour for the same person on every screen. */
export function Avatar({ name, seed, size = 40 }: { name: string; seed?: string; size?: number }) {
  const fill = colors.avatars[hash(seed ?? name) % colors.avatars.length]!;
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: fill }]}
    >
      <T size={Math.round(size * 0.36)} weight={900}>
        {initials(name)}
      </T>
    </View>
  );
}

/* ---------------------------------------------------------------- surfaces */

/** A paper card as the prototype draws it: 1px line border, radius 18, 14 padding. */
export function Card({
  children,
  padding = 14,
  radius: corner = radius.card,
  style,
}: {
  children: ReactNode;
  padding?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, { padding, borderRadius: corner }, style]}>{children}</View>;
}

export function Alert({
  children,
  kind = "error",
}: {
  children: string;
  kind?: "error" | "info" | "success" | "warning";
}) {
  const look = {
    error: { bg: colors.dangerSubtle, fg: colors.dangerInk },
    info: { bg: colors.infoSubtle, fg: colors.infoInk },
    success: { bg: colors.successSubtle, fg: colors.successInk },
    warning: { bg: colors.warningSubtle, fg: colors.warningInk },
  }[kind];
  return (
    <View
      accessibilityRole={kind === "error" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.alert, { backgroundColor: look.bg }]}
    >
      <T size={13} weight={700} color={look.fg} style={{ flexShrink: 1 }}>
        {children}
      </T>
    </View>
  );
}

/** A screen that could not load: why, in words (read out as it appears), and a way to try
 *  again. One component, so every screen says it the same way. Given the `error`, no
 *  connection is said calmly instead (OfflineState): nothing is wrong, the phone is offline.
 *  `compact` is for a screen's second and later sections, so one dead spot shows one card. */
export function ErrorState({
  message,
  retryLabel,
  onRetry,
  error,
  compact = false,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
  error?: unknown;
  compact?: boolean;
}) {
  if (isOffline(error)) return <OfflineState onRetry={onRetry} compact={compact} />;
  return (
    <>
      <Alert>{message}</Alert>
      <Button title={retryLabel} variant="soft" onPress={onRetry} />
    </>
  );
}

/**
 * No connection (opening the app in a dead spot, say): information, not an alarm. The session
 * is kept and nothing is lost; Retry fetches again once the phone is back online. `compact` is
 * one line with the retry beside it, under a section that already said so in full.
 */
export function OfflineState({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  const { t } = useAuth();
  if (compact) {
    return (
      <View accessibilityLiveRegion="polite" style={[styles.card, styles.offlineRow]}>
        <Icon name="offline" size={18} color={colors.infoInk} />
        <T size={13} weight={700} color={colors.infoInk} style={{ flex: 1 }}>
          {t("offline.title")}
        </T>
        <TextLink title={t("common.retry")} role="button" onPress={onRetry} />
      </View>
    );
  }
  return (
    <View accessibilityLiveRegion="polite" style={[styles.card, styles.empty]}>
      <View style={styles.offlineIcon}>
        <Icon name="offline" size={22} color={colors.infoInk} />
      </View>
      <T size={16} weight={900} align="center" heading>
        {t("offline.title")}
      </T>
      <T size={13} color={colors.muted} align="center">
        {t("offline.lead")}
      </T>
      <Button title={t("common.retry")} variant="soft" size="sm" onPress={onRetry} style={{ marginTop: 4 }} />
    </View>
  );
}

/** Never a bare "no results": what this is, and what happens next (`.card.empty`), usually
 *  with the mascot above it. */
export function EmptyState({
  title,
  lead,
  art,
  action,
}: {
  title: string;
  lead?: string;
  art?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <View style={[styles.card, styles.empty]}>
      {art}
      <T size={18} weight={900} align="center" heading>
        {title}
      </T>
      {lead ? (
        <T size={13} color={colors.muted} align="center">
          {lead}
        </T>
      ) : null}
      {action}
    </View>
  );
}

/** A block in the shape of what is loading: skeletons, not spinners. */
export function Skeleton({
  height,
  width = "100%",
  corner = radius.card,
}: {
  height: number;
  width?: number | `${number}%`;
  corner?: number;
}) {
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    pulse.value = withRepeat(withTiming(0.55, { duration: 900, reduceMotion: ReduceMotion.System }), -1, true);
  }, [pulse, reduce]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ height, width, borderRadius: corner, backgroundColor: colors.surface }, animated]}
    />
  );
}

/* ---------------------------------------------------------------- inputs */

interface FieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  hint?: string;
  /** Tabular digits, for IDs and codes. */
  numeric?: boolean;
  invalid?: boolean;
  /** Why the value is wrong: shown in the hint's place, and read out when it appears. */
  error?: string;
  /** Something inside the field's right edge: the show / hide password button. */
  accessory?: ReactNode;
  /** The input itself, to move focus to it (EID, then password). */
  ref?: Ref<TextInput>;
}

/**
 * The prototype's 52px input: label above, hint below, radius 14. At rest it draws the 3:1
 * control edge; focus turns the edge red and adds the soft red ring, and a wrong value stays
 * red while focused rather than being hidden by the focus colour.
 */
export function Field({
  label,
  hint,
  numeric,
  invalid,
  error,
  accessory,
  ref,
  onFocus,
  onBlur,
  ...input
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const wrong = invalid || !!error;
  const edge = wrong || focused ? colors.brand : colors.controlBorder;
  return (
    <View style={{ gap: 7 }}>
      <T size={13} weight={800} maxFontSizeMultiplier={CHROME_SCALE}>
        {label}
      </T>
      <View style={[styles.field, { borderColor: edge, boxShadow: focused ? shadow.focus : undefined }]}>
        <TextInput
          {...input}
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={hint}
          aria-invalid={wrong}
          placeholderTextColor={colors.muted}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          maxFontSizeMultiplier={CHROME_SCALE}
          style={[styles.input, numeric && { fontVariant: ["tabular-nums"] }]}
        />
        {accessory}
      </View>
      {error ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.fieldError}>
          <Icon name="info" size={16} color={colors.dangerInk} />
          <T size={13} weight={700} color={colors.dangerInk} style={{ flexShrink: 1 }}>
            {error}
          </T>
        </View>
      ) : hint ? (
        <T size={12} color={colors.muted}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

/**
 * A multi-line field (`textarea.input`): the prototype's 96px box, label above, and a counter
 * under the right edge ("12 / 140") when `counter` is given. `counterLabel` is what a screen
 * reader hears for it ("12 of 140 characters").
 */
export function TextArea({
  label,
  counter,
  counterLabel,
  ref,
  onFocus,
  onBlur,
  ...input
}: Omit<TextInputProps, "style" | "multiline"> & {
  label: string;
  counter?: string;
  counterLabel?: string;
  ref?: Ref<TextInput>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <T size={13} weight={800} maxFontSizeMultiplier={CHROME_SCALE}>
        {label}
      </T>
      <TextInput
        {...input}
        ref={ref}
        multiline
        textAlignVertical="top"
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        maxFontSizeMultiplier={CHROME_SCALE}
        style={[
          styles.textArea,
          { borderColor: focused ? colors.brand : colors.controlBorder, boxShadow: focused ? shadow.focus : undefined },
        ]}
      />
      {counter ? (
        <T
          size={11}
          color={colors.muted}
          align="right"
          tabular
          accessibilityLabel={counterLabel}
          accessibilityLiveRegion="polite"
        >
          {counter}
        </T>
      ) : null}
    </View>
  );
}

/**
 * Two or three ways to see one list (`.seg`): Everyone / For you, Received / Sent. A tab list
 * to a screen reader, the current one raised on paper.
 */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
  label: string;
}) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Touchable
            key={option.value}
            haptic={active ? "none" : "selection"}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            aria-selected={active}
            // 38 drawn, 44 touched.
            hitSlop={{ top: 3, bottom: 3 }}
            onPress={() => {
              if (!active) onChange(option.value);
            }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <T
              size={13}
              weight={800}
              color={active ? colors.foreground : colors.muted}
              numberOfLines={1}
              maxFontSizeMultiplier={CHROME_SCALE}
            >
              {option.label}
            </T>
          </Touchable>
        );
      })}
    </View>
  );
}

/** English / Español, both visible, one tap (`.langseg`). Remembered on this device, and it
 *  beats the profile's language, which beats the phone's. `onChange` replaces the plain
 *  switch, for a screen that also saves the choice somewhere (the profile). */
export function LanguageSwitch({ onChange }: { onChange?: (locale: Locale) => void } = {}) {
  const { t, locale, setLocale } = useAuth();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t("common.language")} style={styles.switch}>
      {LOCALES.map((code: Locale) => {
        const active = code === locale;
        return (
          <Touchable
            key={code}
            haptic="selection"
            accessibilityRole="radio"
            accessibilityLabel={t(`common.languages.${code}`)}
            aria-checked={active}
            accessibilityLanguage={code}
            // 36 drawn, 44 touched.
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={() => {
              if (code === locale) return;
              if (onChange) onChange(code);
              else void setLocale(code);
            }}
            style={[styles.switchButton, active && { backgroundColor: colors.brandInk }]}
          >
            <T size={12} weight={800} color={active ? colors.brandFg : colors.muted} maxFontSizeMultiplier={1.3}>
              {t(`common.languages.${code}`)}
            </T>
          </Touchable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  button: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  buttonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  hidden: { opacity: 0 },
  iconButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: minTouchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  textLink: { minHeight: minTouchTarget, justifyContent: "center", paddingHorizontal: 6 },
  pill: {
    minHeight: 22,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  card: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.border },
  alert: { borderRadius: radius.control, padding: 14 },
  empty: {
    alignItems: "center",
    gap: 8,
    borderRadius: radius.card,
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  offlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.card,
    paddingLeft: 14,
    paddingRight: 6,
  },
  offlineIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.infoSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    height: controlHeight.input,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: radius.control,
    borderWidth: 1.5,
    backgroundColor: colors.raised,
  },
  fieldError: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  input: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    paddingRight: 10,
    fontFamily: fontFamily(700),
    fontSize: 16,
    color: colors.foreground,
  },
  textArea: {
    minHeight: 96,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: radius.control,
    borderWidth: 1.5,
    backgroundColor: colors.raised,
    fontFamily: fontFamily(600),
    fontSize: 15,
    lineHeight: 21,
    color: colors.foreground,
  },
  segmented: {
    flexDirection: "row",
    padding: 3,
    borderRadius: radius.chip,
    backgroundColor: colors.well,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: { backgroundColor: colors.raised, boxShadow: shadow.segment },
  switch: {
    flexDirection: "row",
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.well,
  },
  switchButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
