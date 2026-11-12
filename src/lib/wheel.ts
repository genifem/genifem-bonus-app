/**
 * The wheel's geometry (CR-28, CR-29; plan §8 "Wheel"), drawn as the prototype draws it: a
 * 300 box, the centre at 150, segments of radius 140. Segment i covers [i·s, (i+1)·s) degrees
 * clockwise from 12 o'clock, where s = 360 / n, and the pointer sits at 12 o'clock.
 *
 * The server picks the prize and says which segment it is (`segment_index`); the app only
 * turns the wheel so that segment's centre ends under the pointer. Nothing here chooses.
 */

/** Whole turns before it settles (plan §8: 5 × 360 + (360 − segment centre)). */
export const TURNS = 5;
/** About 3.5 seconds (CR-29). */
export const SPIN_MS = 3500;
/** The prototype's cubic-bezier(.15,.75,.15,1): off quickly, then a long slow settle. */
export const SPIN_EASING = [0.15, 0.75, 0.15, 1] as const;

/** The drawing's box, centre and segment radius. */
export const VIEW = 300;
export const HUB = 150;
export const RADIUS = 140;

function mod(value: number, by: number): number {
  return ((value % by) + by) % by;
}

/** How many degrees one segment spans. */
export function segmentAngle(count: number): number {
  return count > 0 ? 360 / count : 360;
}

/** Where a segment's centre is, in degrees clockwise from 12 o'clock. */
export function segmentCentre(index: number, count: number): number {
  const span = segmentAngle(count);
  return index * span + span / 2;
}

/** A segment the wheel on screen actually has. */
export function isSegment(index: number, count: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < count;
}

/**
 * The rotation to animate to from `current` (where the wheel rests now, in degrees): back to
 * the last whole turn, five more, then (360 − centre) so the segment's centre comes round to
 * the pointer. Always forward, and always at least four full turns, wherever it rested.
 */
export function landingRotation(current: number, index: number, count: number, turns = TURNS): number {
  const base = current - mod(current, 360);
  return base + 360 * turns + (360 - segmentCentre(index, count));
}

/** The same angle within one turn: where the wheel rests once the animation is over, so the
 *  number never grows spin after spin. */
export function restingAngle(rotation: number): number {
  return mod(rotation, 360);
}

/** The segment under the pointer when the wheel is turned by `rotation` degrees. */
export function segmentAt(rotation: number, count: number): number {
  if (count <= 0) return -1;
  // The pointer stays at 12 o'clock while the wheel turns clockwise, so in the wheel's own
  // frame the pointer has moved back by the rotation.
  const under = mod(-rotation, 360);
  return Math.min(count - 1, Math.floor(under / segmentAngle(count)));
}

/** A point on the circle of `radius`, `degrees` clockwise from 12 o'clock. */
function point(degrees: number, radius: number): [number, number] {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [HUB + radius * Math.cos(radians), HUB + radius * Math.sin(radians)];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The SVG path of segment `index`: from the centre, out, along the arc and back. */
export function segmentPath(index: number, count: number, radius = RADIUS): string {
  if (count <= 1) {
    // A whole circle as two half arcs (an arc can't start and end at the same point).
    return `M${HUB} ${HUB - radius}A${radius} ${radius} 0 1 1 ${HUB} ${HUB + radius}A${radius} ${radius} 0 1 1 ${HUB} ${HUB - radius}Z`;
  }
  const span = segmentAngle(count);
  const [x1, y1] = point(index * span, radius);
  const [x2, y2] = point((index + 1) * span, radius);
  const large = span > 180 ? 1 : 0;
  return `M${HUB} ${HUB}L${round(x1)} ${round(y1)}A${radius} ${radius} 0 ${large} 1 ${round(x2)} ${round(y2)}Z`;
}

/* ---------------------------------------------------------------- labels */

/** The first line's baseline, measured in from the centre (y = 48 in the prototype). */
const FIRST_LINE = HUB - 48;
const LINE_GAP = 3;
/** Nunito Black's average glyph, as a share of the font size: a fair estimate, not a measure. */
const GLYPH_EM = 0.58;
/** Room kept clear at each side of a line, inside the segment's edges. */
const SIDE_PAD = 4;
const MAX_LINES = 3;
const MIN_FONT = 8;

/** The prototype's sizes: 13, or 11 on a crowded wheel. */
export function baseFontSize(count: number): number {
  return count > 8 ? 11 : 13;
}

/** How far glyphs rise above their baseline, as a share of the font size. */
const ASCENT_EM = 0.75;

/**
 * How wide a line with its baseline at `distance` from the centre can be: the segment's width
 * at the baseline (where the wedge is narrowest), and never past the rim at the glyphs' tops
 * (`ascent` above it, where the circle is narrowest).
 */
export function lineWidth(distance: number, count: number, ascent = 0): number {
  const half = (segmentAngle(count) / 2) * (Math.PI / 180);
  const wedge = half >= Math.PI / 2 ? Number.POSITIVE_INFINITY : 2 * distance * Math.tan(half);
  const top = Math.min(RADIUS, distance + ascent);
  const rim = 2 * Math.sqrt(Math.max(0, RADIUS * RADIUS - top * top));
  return Math.max(0, Math.min(wedge, rim) - 2 * SIDE_PAD);
}

/** Words into lines of at most `maxChars`; a word longer than that keeps a line to itself. */
export function wrapWords(label: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const word of label.trim().split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + 1 + word.length <= maxChars) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** Where line `line` of a label sits, as the y of its baseline in the 300 box (before the
 *  segment's rotation): the first at 48, then down toward the hub. */
export function lineY(line: number, fontSize: number): number {
  return HUB - FIRST_LINE + line * (fontSize + LINE_GAP);
}

export interface FittedLabel {
  lines: string[];
  fontSize: number;
}

function fits(lines: string[], size: number, count: number): boolean {
  return lines.every(
    (line, index) =>
      line.length * GLYPH_EM * size <= lineWidth(FIRST_LINE - index * (size + LINE_GAP), count, size * ASCENT_EM),
  );
}

/**
 * A prize's label laid out for its segment: wrapped to what fits across it near the rim (at
 * most three lines), at the prototype's size or smaller until every line fits at its own
 * depth. Owner-typed labels run to 40 characters, and Spanish ones run long ("Insignia
 * Estrella de la suerte"), so the prototype's "split past 11 characters" isn't enough.
 */
export function fitLabel(label: string, count: number): FittedLabel {
  const base = baseFontSize(count);
  let maxChars = Math.max(4, Math.floor(lineWidth(FIRST_LINE, count, base * ASCENT_EM) / (GLYPH_EM * base)));
  let lines = wrapWords(label, maxChars);
  while (lines.length > MAX_LINES) {
    maxChars += 1;
    lines = wrapWords(label, maxChars);
  }
  for (let size = base; size > MIN_FONT; size--) {
    if (fits(lines, size, count)) return { lines, fontSize: size };
  }
  return { lines, fontSize: MIN_FONT };
}
