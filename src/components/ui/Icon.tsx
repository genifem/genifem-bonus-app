import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors } from "./theme";

/**
 * Stroke icons on a 24 grid with round caps, as the prototype draws them (its PATHS table).
 * `eyeOff` is the one it does not draw (it reuses the open eye for "hide password"), drawn
 * the same way. Icons are always decorative: whatever carries them also carries words or an
 * accessibilityLabel.
 */
const ICONS = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  chat: "M4 5h16v11H9l-5 4z",
  gift: "M3 9h18v4H3zM5 13v8h14v-8M12 9v12M12 9c-1.5-3-6-3.5-6-1s6 1 6 1zm0 0c1.5-3 6-3.5 6-1s-6 1-6 1z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4.5-6 8-6s7 2 8 6",
  bell: "M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2 2 0 0 0 4 0",
  back: "M15 18l-6-6 6-6",
  chev: "M9 6l6 6-6 6",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  star: "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z",
  trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4",
  // The leaderboard's first place.
  crown: "M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z",
  check: "M5 12.5l4.5 4.5L19 7",
  x: "M6 6l12 12M18 6L6 18",
  lock: "M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeOff:
    "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7c1.8 0 3.4-.5 4.8-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2",
  wheel: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4",
  award: "M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM8.5 14l-1.5 7 5-3 5 3-1.5-7",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5",
  send: "M21 3L10 14M21 3l-7 18-4-7-7-4z",
  approve: "M4 4h16v16H4zM8.5 12l2.5 2.5 4.5-5",
  globe:
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.6 3.8 6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-6-3.8-9S9.5 5.6 12 3z",
  // The value tags' glyphs.
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  users:
    "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16.5 11a2.5 2.5 0 1 0 0-5M18 14.6c2 .5 3.3 2.2 3.7 5.4",
  sparkle:
    "M10 3l1.8 4.7 4.7 1.8-4.7 1.8L10 16l-1.8-4.7L3.5 9.5l4.7-1.8zM18 14l.9 2.1 2.1.9-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z",
  arrowUp: "M12 19V5M5 12l7-7 7 7",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  wallet: "M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l12-4 2 4M16 13.5h.01",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5",
  // Three dots ("⋯"), as small rings the stroke fills in.
  more: "M6.2 12a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0zM13.2 12a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0zM20.2 12a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z",
  // The rewards' glyphs (the owner picks one per reward).
  calendar: "M4 5h16v16H4zM8 3v4M16 3v4M4 10h16",
  burger: "M4 11c0-3.5 3.6-6 8-6s8 2.5 8 6zM3 14h18M5 17h14v1a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z",
  cup: "M6 8h12l-1.5 13h-9zM5 8h14M12 8l2-5h3",
  shirt: "M8 3l-5 3 2 5 2-1v11h10V10l2 1 2-5-5-3a4 4 0 0 1-8 0z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  fries: "M6 10h12l-1.5 11h-9zM8 10L7 3M11 10V3M14 10l1-6M17 10l1.5-5",
} as const satisfies Record<string, string>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  color = colors.foreground,
  stroke = 2,
  filled = false,
}: {
  name: IconName;
  size?: number;
  color?: string;
  stroke?: number;
  /** Fill the shape as well as stroking it (a liked heart, the wordmark star). */
  filled?: boolean;
}) {
  // Hidden from assistive technology on the wrapper: react-native-svg would hand these props
  // straight to the DOM on web.
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d={ICONS[name]} />
      </Svg>
    </View>
  );
}
