import type { Schemas } from "@crewstars/api-client";

type TierOut = Schemas["TierOut"];
type NextTierOut = Schemas["NextTierOut"];

/** A tier as the API names it: the owner may give it a Spanish name, and English stands in
 *  when there is none (plan G8). */
export function tierName(tier: { name: string; name_es?: string | null }, locale: string): string {
  return locale === "es" && tier.name_es ? tier.name_es : tier.name;
}

export interface TierProgress {
  /** How far from this tier's threshold to the next one, 0 to 1 (1 at the top tier). */
  fraction: number;
  /** Coins still to earn for the next tier, or null at the top. */
  toGo: number | null;
  /** The next tier's threshold, or null at the top. */
  target: number | null;
}

/**
 * The bar on the balance card (CR-11): lifetime coins between the current tier's threshold
 * and the next one's. Tiers come from lifetime coins, so spending never moves it back.
 *
 * The API already says how many coins are left (`coins_to_go`), and that stays the number
 * shown; the bar is only drawn from the thresholds. Thresholds an owner has just edited can
 * arrive out of order, so nothing here divides by zero or leaves 0..1.
 */
export function tierProgress(summary: {
  lifetime: number;
  tier: Pick<TierOut, "min">;
  next_tier: Pick<NextTierOut, "min" | "coins_to_go"> | null;
}): TierProgress {
  const { lifetime, tier, next_tier: next } = summary;
  if (!next) return { fraction: 1, toGo: null, target: null };
  const toGo = Math.max(0, next.coins_to_go ?? next.min - lifetime);
  const span = next.min - tier.min;
  const fraction = span > 0 ? (lifetime - tier.min) / span : toGo === 0 ? 1 : 0;
  return { fraction: Math.min(1, Math.max(0, fraction)), toGo, target: next.min };
}
