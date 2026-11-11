/**
 * Tenant brand colours are arbitrary, so text drawn on them must be picked for contrast
 * (WCAG 2.2 AA, NF-11).
 */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parse(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** White or near-black, whichever reads better on `background`. */
export function readableOn(background: string): "#FFFFFF" | "#111827" {
  return contrastRatio(background, "#FFFFFF") >= contrastRatio(background, "#111827")
    ? "#FFFFFF"
    : "#111827";
}

/** Accepts #RGB as well as #RRGGBB: a CSS minifier rewrites #FFFFFF to #fff, so any colour
 *  read back out of the browser can arrive in the short form. */
function parse(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a hex colour: ${hex}`);
  const digits = m[1]!;
  const full = digits.length === 3 ? digits.replace(/./g, (d) => d + d) : digits;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function format(rgb: [number, number, number]): string {
  return `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** Moves `hex` a fraction of the way toward `toward`, in sRGB. Keeps the hue recognisable. */
function mix(hex: string, toward: string, amount: number): string {
  const a = parse(hex);
  const b = parse(toward);
  return format([
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ]);
}

/** A light wash of `hex` toward white: `amount` 0.9 turns brand-600 into a brand-50. */
export function tint(hex: string, amount: number): string {
  return mix(hex, "#FFFFFF", amount);
}

/**
 * A version of an operator's brand colour that is safe to use as *text*.
 *
 * An operator's brand is whatever they give us, and the same colour behaves differently on
 * different surfaces: #DA291C reaches 4.87:1 on white but only 4.42:1 on `--surface`, so a
 * brand-coloured link inside a grey card fails AA while the identical link on the page
 * background passes. Rather than police that per component, we derive one colour that clears
 * `target` against *every* background it will be drawn on, and text always uses that.
 *
 * The brand itself is untouched — it stays exact wherever it is a fill, which is where an
 * operator actually recognises it.
 *
 * Returns the brand unchanged when it already passes.
 */
export function brandInk(brand: string, backgrounds: string[], target = 4.5): string {
  if (backgrounds.length === 0) throw new Error("brandInk needs at least one background");
  const passes = (c: string) => backgrounds.every((bg) => contrastRatio(c, bg) >= target);
  if (passes(brand)) return format(parse(brand));

  // Darken against light backgrounds, lighten against dark ones. With a mix of both there may
  // be no answer, and the loop simply runs out and returns the endpoint.
  const mean = backgrounds.reduce((sum, bg) => sum + relativeLuminance(bg), 0) / backgrounds.length;
  const toward = mean > 0.18 ? "#000000" : "#FFFFFF";

  for (let amount = 0.02; amount <= 1; amount += 0.02) {
    const candidate = mix(brand, toward, amount);
    if (passes(candidate)) return candidate;
  }
  return toward;
}
