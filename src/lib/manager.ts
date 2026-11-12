/**
 * The numbers on the GM's Home (MG-01, MG-02) that the app draws rather than reads: how full
 * the kudos bar is, and how much of a long "needs some love" list to show at once.
 */

/** MG-01's bar: kudos left out of all there were to give this month (the role's allowance and
 *  any extra won on the wheel), 0 to 1. */
export function kudosFraction(kudos: { left: number; allowance: number; bonus?: number | null }): number {
  const total = Math.max(0, kudos.allowance) + Math.max(0, kudos.bonus ?? 0);
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, kudos.left / total));
}

/** At the start of a month nobody has been recognized yet, and a big store has dozens of crew:
 *  Home shows the first few and a way to see the rest. */
export const LOVE_PREVIEW = 5;

export function preview<T>(items: readonly T[], expanded: boolean, max = LOVE_PREVIEW): { shown: T[]; hidden: number } {
  if (expanded || items.length <= max) return { shown: [...items], hidden: 0 };
  return { shown: items.slice(0, max), hidden: items.length - max };
}
