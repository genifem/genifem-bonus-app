import {
  controlHeight,
  crewStars,
  light,
  minTouchTarget,
  motion,
  radiusPx,
  scrim,
  shadow,
  typePx,
} from "@crewstars/shared";

export { controlHeight, crewStars, minTouchTarget, motion, shadow, typePx };

/**
 * Colour, type and shape for the app, re-exported from the shared tokens
 * (packages/shared/src/tokens.ts), the same file the owner portal generates its CSS from.
 * Components restyle through these names only; no screen names a hex of its own.
 */
export const colors = {
  background: light.background,
  surface: light.surface,
  raised: light.surfaceRaised,
  border: light.border,
  /** Every text field's edge at rest: 3:1 against paper and cream. */
  controlBorder: light.controlBorder,
  track: light.track,
  foreground: light.foreground,
  muted: light.muted,
  /** Decorative red: icons, the mascot, the Give tab, large fills. Never carries text. */
  brand: light.brand,
  /** Text-bearing red: primary buttons (behind white), links, the active tab label (D17). */
  brandInk: light.brandInk,
  brandSubtle: light.brandSubtle,
  brandFaint: light.brandFaint,
  brandFg: light.brandFg,
  coin: light.coin,
  coinInk: light.coinInk,
  coinSubtle: light.coinSubtle,
  coinStrong: light.coinStrong,
  success: light.success,
  successInk: light.successInk,
  successSubtle: light.successSubtle,
  infoInk: light.infoInk,
  infoSubtle: light.infoSubtle,
  rewardInk: light.rewardInk,
  rewardSubtle: light.rewardSubtle,
  accentInk: light.accentInk,
  accentSubtle: light.accentSubtle,
  warningInk: light.warningInk,
  warningSubtle: light.warningSubtle,
  danger: light.danger,
  dangerInk: light.dangerInk,
  dangerSubtle: light.dangerSubtle,
  inverse: light.inverse,
  inverseFg: light.inverseFg,
  scrim,
  /** The dashed edge of a placeholder (the operator logo, an empty state). */
  dashed: "#D9CBBB",
  /** The sheet's grab handle. */
  handle: "#E8DED2",
  /** Segmented-control and language-switch wells. */
  well: "#F4ECE2",
  /** The soft wash under a focused field or the current OTP cell. */
  focusWash: "rgba(230,57,70,0.12)",
  /** Words on a disabled soft button: decorative, since a disabled control is exempt. */
  softDisabledFg: "#E9A0A6",
  /** Initials discs: all light enough for ink text. */
  avatars: [crewStars.butter2, crewStars.mint, crewStars.sky, crewStars.lilac, crewStars.peach],
} as const;

/** Radii from the prototype: chip 12, input 14, card 18, tile 20, hero 22, sheet 28. */
export const radius = {
  chip: radiusPx.chip,
  control: radiusPx.control,
  card: radiusPx.card,
  tile: radiusPx.tile,
  hero: radiusPx.hero,
  sheet: radiusPx.sheet,
  pill: radiusPx.pill,
} as const;

/** The phone's side padding (prototype `.m-scroll`), and the widest the column grows. */
export const gutter = 18;
export const maxWidth = 640;

export type Weight = 400 | 600 | 700 | 800 | 900;

/** Nunito in the five weights the prototype loads. React Native picks a custom font's weight
 *  by family name, not by fontWeight, so each weight is its own family. */
export const fonts = {
  400: "Nunito_400Regular",
  600: "Nunito_600SemiBold",
  700: "Nunito_700Bold",
  800: "Nunito_800ExtraBold",
  900: "Nunito_900Black",
} as const satisfies Record<Weight, string>;

export function fontFamily(weight: Weight): string {
  return fonts[weight];
}
