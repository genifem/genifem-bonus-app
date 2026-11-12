/**
 * The single source of truth for colour, type, space and radius (plan §13).
 *
 * Plain TypeScript with no dependencies, because more than one consumer reads it:
 *   - the Expo app imports the objects directly (React Native cannot read CSS variables),
 *   - the owner portal (bonus-admin) generates its `tokens.css` from the same file,
 *   - `tokens.test.ts` asserts that every pairing in `textContrast` passes WCAG 2.2 AA.
 *
 * Only erasable TypeScript syntax here: a generator may run this file through Node's type
 * stripping, which rejects `enum`, `namespace` and parameter properties.
 *
 * Values come from the Crew Stars prototype, which copies the approved design's look: Nunito,
 * cream surfaces, red, butter and the star mascot.
 */

/** The raw palette. Components never reach in here; they ask for a semantic colour. */
export const crewStars = {
  cream: "#FFF8F1",
  cream2: "#FBF1E6",
  paper: "#FFFFFF",
  ink: "#1E1A2B",
  muted: "#6B6379",
  line: "#EFE4D7",
  /** Decorative red: icons, the mascot, badges and large fills. Never behind or as text. */
  red: "#E63946",
  /**
   * Every red that carries text (D17): the primary button behind white words, links, the
   * active tab label. White on #E63946 is only 4.17:1; on this it is 5.43:1.
   */
  redAction: "#C92A37",
  redSoft: "#FFE4E6",
  redFaint: "#F6AEB3",
  butter: "#FFF1C2",
  butter2: "#FFE59A",
  gold: "#F5B700",
  goldInk: "#8A5A00",
  mint: "#DDF5E8",
  mintInk: "#1D6E47",
  sky: "#DCEBFF",
  skyInk: "#1F5AA0",
  lilac: "#EEE6FF",
  lilacInk: "#5B37B8",
  peach: "#FFE7D6",
  peachInk: "#A04A12",
  amber: "#FFF0CC",
  amberInk: "#8A5A00",
} as const;

/**
 * What a component asks for. The naming is consistent on purpose:
 *   `x`         the colour itself, used as a fill
 *   `x-fg`      text drawn *on* that fill
 *   `x-ink`     the darkened form, for text drawn on a light background
 *   `x-subtle`  the tinted background, for pills and alerts
 */
export const light = {
  /** The page. Cards are paper on top of it. */
  background: crewStars.cream,
  /** Wells, segmented controls, quiet chips. */
  surface: crewStars.cream2,
  surfaceRaised: crewStars.paper,
  border: crewStars.line,
  /**
   * The edge every text field draws at rest. The prototype draws inputs with `line`, which is
   * 1.25:1 on white and leaves the field invisible on cream; a boundary that identifies a
   * control needs 3:1 (WCAG 1.4.11), so this warm grey keeps the look and clears the bar.
   */
  controlBorder: "#988776",
  foreground: crewStars.ink,
  muted: crewStars.muted,
  track: "#EDE3D7",

  /** Decorative red (icons, mascot, large fills). */
  brand: crewStars.red,
  /** Text-bearing red: buttons, links, the active tab (D17). */
  brandInk: crewStars.redAction,
  brandSubtle: crewStars.redSoft,
  brandFaint: crewStars.redFaint,
  brandFg: "#FFFFFF",

  coin: crewStars.gold,
  coinInk: crewStars.goldInk,
  coinSubtle: crewStars.butter,
  coinStrong: crewStars.butter2,

  success: "#3FBF8F",
  successInk: crewStars.mintInk,
  successSubtle: crewStars.mint,

  info: crewStars.skyInk,
  infoInk: crewStars.skyInk,
  infoSubtle: crewStars.sky,

  reward: crewStars.lilacInk,
  rewardInk: crewStars.lilacInk,
  rewardSubtle: crewStars.lilac,

  accentInk: crewStars.peachInk,
  accentSubtle: crewStars.peach,

  warningInk: crewStars.amberInk,
  warningSubtle: crewStars.amber,

  danger: crewStars.red,
  dangerInk: crewStars.redAction,
  dangerSubtle: crewStars.redSoft,

  /** The toast and other ink surfaces. */
  inverse: crewStars.ink,
  inverseFg: "#FFFFFF",
} as const;

export type SemanticColor = keyof typeof light;
export type ColorScheme = Record<SemanticColor, string>;

/** Light only for v1. The shape is here so a dark scheme needs no restructuring. */
export const schemes: Record<"light", ColorScheme> = { light };

/**
 * Every pairing the product actually draws, as [text, background]. `tokens.test.ts` walks
 * this list and fails under 4.5:1 (NF-11), so a palette edit cannot quietly break AA.
 */
export const textContrast: ReadonlyArray<readonly [SemanticColor, SemanticColor]> = [
  ["foreground", "background"],
  ["foreground", "surface"],
  ["foreground", "surfaceRaised"],
  ["foreground", "coinSubtle"],
  ["muted", "background"],
  ["muted", "surface"],
  ["muted", "surfaceRaised"],
  ["muted", "coinSubtle"],
  ["brandInk", "background"],
  ["brandInk", "surface"],
  ["brandInk", "surfaceRaised"],
  ["brandInk", "brandSubtle"],
  ["brandInk", "coinSubtle"],
  ["brandInk", "warningSubtle"],
  ["muted", "brandSubtle"],
  ["coinInk", "surfaceRaised"],
  ["brandFg", "brandInk"],
  ["coinInk", "coinSubtle"],
  ["coinInk", "background"],
  ["successInk", "successSubtle"],
  ["successInk", "background"],
  ["infoInk", "infoSubtle"],
  ["infoInk", "surfaceRaised"],
  ["rewardInk", "rewardSubtle"],
  ["accentInk", "accentSubtle"],
  ["warningInk", "warningSubtle"],
  ["dangerInk", "dangerSubtle"],
  ["dangerInk", "background"],
  ["inverseFg", "inverse"],
];

/**
 * Boundaries that carry meaning (the edge of an input, a focused field) need 3:1 against what
 * they sit on (WCAG 1.4.11). `border` is decorative and deliberately not in this list.
 */
export const uiContrast: ReadonlyArray<readonly [SemanticColor, SemanticColor]> = [
  ["controlBorder", "surfaceRaised"],
  ["controlBorder", "background"],
  ["controlBorder", "surface"],
  // The focus ring and a focused field's edge.
  ["brandInk", "surfaceRaised"],
  ["brandInk", "background"],
  ["brand", "background"],
  ["brand", "surfaceRaised"],
];

/** Radii from the prototype, in px: chip 12, input 14, card 18, tile 20, hero 22, sheet 28. */
export const radiusPx = {
  chip: 12,
  control: 14,
  card: 18,
  tile: 20,
  hero: 22,
  sheet: 28,
  pill: 999,
} as const;

/** The same scale in rem, for the web. */
export const radius = {
  chip: "0.75rem",
  control: "0.875rem",
  card: "1.125rem",
  tile: "1.25rem",
  hero: "1.375rem",
  sheet: "1.75rem",
  full: "9999px",
} as const;

/** The type scale in px, from the prototype (11 tiny, 12 small, 13 caption, 14 body ...). */
export const typePx = {
  tiny: 11,
  small: 12,
  caption: 13,
  body: 14,
  base: 15,
  input: 16,
  section: 17,
  lead: 18,
  title: 27,
  hero: 36,
} as const;

/** Nunito, the only face. The web names the family; React Native names a file per weight. */
export const fontFamily = {
  web: '"Nunito", "Avenir Next", "Segoe UI", system-ui, sans-serif',
} as const;

/** Steps in px, for React Native. */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/** The smallest target a finger gets. */
export const minTouchTarget = 44;

/** Control heights from the prototype: buttons are 50 tall pills, inputs 52. */
export const controlHeight = {
  button: 50,
  buttonSmall: 38,
  input: 52,
  otpCell: 58,
} as const;

/**
 * Motion. Short enough that nothing waits on it. Anything with reduced motion switched on
 * gets none of it.
 */
export const motion = {
  duration: { fast: 120, base: 200, slow: 280, sheet: 320, toast: 2400 },
  easing: {
    standard: [0.2, 0, 0, 1],
    enter: [0, 0, 0.2, 1],
    exit: [0.4, 0, 1, 1],
  },
} as const;

/** Elevation, as rgba() so React Native's boxShadow reads the same strings as CSS. */
export const shadow = {
  button: "0 8px 18px rgba(230,57,70,0.22)",
  giveTab: "0 6px 14px rgba(230,57,70,0.3)",
  segment: "0 2px 5px rgba(30,26,43,0.07)",
  sheet: "0 -8px 32px rgba(30,26,43,0.12)",
  focus: "0 0 0 4px rgba(230,57,70,0.12)",
} as const;

/** Scrims behind sheets and dialogs. */
export const scrim = "rgba(30,26,43,0.45)";
