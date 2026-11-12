/**
 * The balance card's way to the next tier (CR-11): "N to go" and the bar between this tier's
 * threshold and the next one's. Default tiers: Bronze 0, Silver 250, Gold 600, Platinum 1,200.
 */
import { tierName, tierProgress } from "@/lib/tiers";

const bronze = { min: 0 };
const silver = { min: 250 };
const gold = { min: 600 };

function next(min: number, lifetime: number) {
  return { min, coins_to_go: min - lifetime };
}

describe("tierProgress", () => {
  it("starts empty at the bottom of a tier", () => {
    expect(tierProgress({ lifetime: 0, tier: bronze, next_tier: next(250, 0) })).toEqual({
      fraction: 0,
      toGo: 250,
      target: 250,
    });
  });

  it("measures from this tier's threshold, not from zero", () => {
    // 425 is halfway from Silver (250) to Gold (600).
    const progress = tierProgress({ lifetime: 425, tier: silver, next_tier: next(600, 425) });
    expect(progress.fraction).toBeCloseTo(0.5);
    expect(progress.toGo).toBe(175);
    expect(progress.target).toBe(600);
  });

  it("says the coins to go the API counted", () => {
    expect(tierProgress({ lifetime: 175, tier: bronze, next_tier: { min: 250, coins_to_go: 75 } }).toGo).toBe(75);
  });

  it("is full with nothing to go at the top tier", () => {
    expect(tierProgress({ lifetime: 1500, tier: { min: 1200 }, next_tier: null })).toEqual({
      fraction: 1,
      toGo: null,
      target: null,
    });
  });

  it("stays between 0 and 1 when thresholds were just edited out of order", () => {
    // An owner raised Silver above this person's lifetime: they are back in Bronze (AT 17).
    expect(tierProgress({ lifetime: 300, tier: bronze, next_tier: next(400, 300) }).fraction).toBeCloseTo(0.75);
    // Next tier at or under the current one: no division by zero, no NaN.
    const flat = tierProgress({ lifetime: 600, tier: gold, next_tier: { min: 600, coins_to_go: 0 } });
    expect(flat.fraction).toBe(1);
    const odd = tierProgress({ lifetime: 100, tier: gold, next_tier: { min: 600, coins_to_go: 500 } });
    expect(odd.fraction).toBe(0);
    expect(tierProgress({ lifetime: 900, tier: silver, next_tier: { min: 600, coins_to_go: -300 } })).toEqual({
      fraction: 1,
      toGo: 0,
      target: 600,
    });
  });
});

describe("tierName", () => {
  it("uses the Spanish name in Spanish when the owner gave one", () => {
    expect(tierName({ name: "Silver", name_es: "Plata" }, "es")).toBe("Plata");
    expect(tierName({ name: "Silver", name_es: "Plata" }, "en")).toBe("Silver");
  });

  it("falls back to English without one (G8)", () => {
    expect(tierName({ name: "Diamond", name_es: null }, "es")).toBe("Diamond");
    expect(tierName({ name: "Diamond", name_es: "" }, "es")).toBe("Diamond");
    expect(tierName({ name: "Diamond" }, "es")).toBe("Diamond");
  });
});
