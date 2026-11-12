/**
 * Spin the wheel's words and numbers (CR-12, CR-28 to CR-31): what each prize means next, the
 * progress to the next spin, the rules that are on, and the Home tile's status.
 */
import { createTranslator } from "@crewstars/i18n";

import {
  canLand,
  prizeLabel,
  prizeOutcome,
  type PrizeOut,
  ruleLines,
  spinButtonKey,
  spinProgress,
  spinTile,
  type SpinRules,
  wheelChanged,
} from "@/lib/spin";

const en = createTranslator("en");
const es = createTranslator("es");

const RULES: SpinRules = { every_coins: 200, on_badge: true, on_milestone: true, max_per_month: 2 };

function prize(kind: string, amount = 0): Pick<PrizeOut, "kind" | "amount"> {
  return { kind: kind as PrizeOut["kind"], amount };
}

function say(t: typeof en, message: { key: string; values?: Record<string, string | number> }): string {
  return t(message.key, message.values);
}

describe("what a prize means next (CR-30)", () => {
  it("says coins are in the balance", () => {
    expect(say(en, prizeOutcome(prize("coins", 25), "en"))).toBe("25 coins are now in your balance.");
    expect(say(en, prizeOutcome(prize("coins", 1), "en"))).toBe("1 coin is now in your balance.");
    expect(say(es, prizeOutcome(prize("coins", 25), "es"))).toBe("Ya tienes 25 monedas más en tu saldo.");
    expect(prizeOutcome(prize("coins", 25), "en").action).toBeNull();
  });

  it("says extra kudos are this month's to give", () => {
    expect(say(en, prizeOutcome(prize("kudos", 10), "en"))).toBe("You have 10 extra kudos to give this month.");
    expect(say(es, prizeOutcome(prize("kudos", 10), "es"))).toBe("Tienes 10 kudos extra para dar este mes.");
  });

  it("sends a free item to My rewards, ready to collect", () => {
    const outcome = prizeOutcome(prize("item"), "en");
    expect(say(en, outcome)).toBe("It's waiting in My rewards, ready to collect at your store.");
    expect(outcome.action).toBe("myRewards");
  });

  it("puts the Lucky Star badge on the profile", () => {
    const outcome = prizeOutcome(prize("badge"), "en");
    expect(say(en, outcome)).toBe("Your new badge is on your profile.");
    expect(outcome.action).toBe("profile");
  });

  it("still calls a kind it doesn't know a win", () => {
    const outcome = prizeOutcome(prize("mystery", 5), "en");
    expect(say(en, outcome)).toBe("It's all yours!");
    expect(outcome.action).toBeNull();
  });

  it("names the prize in the language on screen, English when there is no Spanish", () => {
    expect(prizeLabel({ label: "Free fries", label_es: "Papas gratis" }, "es")).toBe("Papas gratis");
    expect(prizeLabel({ label: "Free fries", label_es: null }, "es")).toBe("Free fries");
    expect(prizeLabel({ label: "Free fries", label_es: "Papas gratis" }, "en")).toBe("Free fries");
    expect(en("spin.wonTitle", { prize: "Free fries" })).toBe("You won Free fries!");
    expect(es("spin.wonTitle", { prize: "Papas gratis" })).toBe("¡Ganaste Papas gratis!");
  });
});

describe("landing on the server's result", () => {
  const wheel = { prizes_version: 3, prizes: new Array(8).fill(null) };

  it("animates only on the prize list the result was drawn on", () => {
    expect(canLand(wheel, { prizes_version: 3, segment_index: 7 })).toBe(true);
    expect(canLand(wheel, { prizes_version: 4, segment_index: 2 })).toBe(false);
    expect(canLand(wheel, { prizes_version: 3, segment_index: 8 })).toBe(false);
    expect(canLand(null, { prizes_version: 3, segment_index: 0 })).toBe(false);
  });

  it("reloads the wheel first when the owners changed the prizes", () => {
    expect(wheelChanged(wheel, { prizes_version: 4 })).toBe(true);
    expect(wheelChanged(wheel, { prizes_version: 3 })).toBe(false);
  });
});

describe("progress to the next spin (CR-31)", () => {
  it("is coins toward the next spin, with the leftover carried over", () => {
    const progress = spinProgress({ progress: 150, spins_earned: 1, rules: RULES });
    expect(progress).toEqual({ show: true, fraction: 0.75, toGo: 50, earned: 1, max: 2, capped: false });
  });

  it("starts empty", () => {
    expect(spinProgress({ progress: 0, spins_earned: 0, rules: RULES })).toMatchObject({ fraction: 0, toGo: 200 });
  });

  it("is hidden once this month's spins are all earned", () => {
    const progress = spinProgress({ progress: 120, spins_earned: 2, rules: RULES });
    expect(progress.show).toBe(false);
    expect(progress.capped).toBe(true);
  });

  it("is hidden when coins don't earn spins", () => {
    const progress = spinProgress({ progress: 0, spins_earned: 0, rules: { ...RULES, every_coins: 0 } });
    expect(progress).toMatchObject({ show: false, fraction: 0, toGo: 0 });
  });

  it("stays full with one coin to go when an owner lowered the step below the progress", () => {
    const progress = spinProgress({ progress: 150, spins_earned: 0, rules: { ...RULES, every_coins: 100 } });
    expect(progress).toMatchObject({ fraction: 1, toGo: 1 });
  });

  it("is capped at once with a cap of zero, and with a cap lowered under what was earned", () => {
    expect(spinProgress({ progress: 10, spins_earned: 0, rules: { ...RULES, max_per_month: 0 } }).capped).toBe(true);
    expect(spinProgress({ progress: 10, spins_earned: 3, rules: RULES }).capped).toBe(true);
  });
});

describe("how you earn spins (CR-31)", () => {
  it("lists only the rules that are on, then the cap", () => {
    expect(ruleLines(RULES, "en").map((line) => line.id)).toEqual(["coins", "badge", "milestone", "cap"]);
    expect(ruleLines({ ...RULES, every_coins: 0, on_milestone: false }, "en").map((line) => line.id)).toEqual([
      "badge",
      "cap",
    ]);
    expect(ruleLines({ every_coins: 0, on_badge: false, on_milestone: false, max_per_month: 2 }, "en")).toHaveLength(1);
  });

  it("words each rule in both languages", () => {
    const words = (t: typeof en, rules: SpinRules) => ruleLines(rules, t.locale).map((line) => say(t, line));
    expect(words(en, { ...RULES, every_coins: 1200 })).toEqual([
      "Every 1,200 coins you earn",
      "New badges that give a spin",
      "Milestones, like days on the team",
      "Up to 2 spins a month",
    ]);
    expect(words(es, RULES)).toEqual([
      "Cada 200 monedas que ganes",
      "Insignias nuevas que dan un giro",
      "Hitos, como tus días en el equipo",
      "Hasta 2 giros al mes",
    ]);
    expect(words(en, { every_coins: 0, on_badge: false, on_milestone: false, max_per_month: 1 })).toEqual([
      "Up to 1 spin a month",
    ]);
    expect(words(en, { every_coins: 0, on_badge: false, on_milestone: false, max_per_month: 0 })).toEqual([
      "No spins to earn this month",
    ]);
  });
});

describe("the Home tile (CR-12)", () => {
  const base = { spins_available: 0, spins_earned: 0, progress: 0, rules: RULES };
  const tile = (wheel: typeof base, t = en) => {
    const text = spinTile(wheel, t.locale);
    return [say(t, text.title), say(t, text.lead)];
  };

  it("says how many spins are ready", () => {
    expect(tile({ ...base, spins_available: 2 })).toEqual(["2 spins ready", "Tap to spin and win"]);
    expect(tile({ ...base, spins_available: 1 }, es)).toEqual(["1 giro listo", "Toca para girar y ganar"]);
  });

  it("otherwise shows the coins to the next spin", () => {
    expect(tile({ ...base, progress: 150 })).toEqual(["Spin the wheel", "50 coins to your next spin"]);
    expect(tile({ ...base, progress: 199 })).toEqual(["Spin the wheel", "1 coin to your next spin"]);
    expect(tile({ ...base, progress: 150 }, es)).toEqual(["Girar la ruleta", "Te faltan 50 monedas para tu próximo giro"]);
  });

  it("or that this month's spins are all earned", () => {
    expect(tile({ ...base, spins_earned: 2 })).toEqual(["Spin the wheel", "All 2 spins earned this month"]);
  });

  it("or how else spins come when coins don't earn them", () => {
    const noCoins = { ...base, rules: { ...RULES, every_coins: 0 } };
    expect(tile(noCoins)[1]).toBe("Earn spins with new badges");
    expect(tile({ ...noCoins, rules: { ...noCoins.rules, on_badge: false } })[1]).toBe("Earn spins at team milestones");
    expect(tile({ ...noCoins, rules: { ...noCoins.rules, on_badge: false, on_milestone: false } })[1]).toBe(
      "No way to earn spins right now",
    );
    expect(tile({ ...base, rules: { ...RULES, max_per_month: 0 } })[1]).toBe("No spins to earn this month");
  });
});

describe("the Spin button", () => {
  it("says what a tap will do", () => {
    expect(en(spinButtonKey({ spinning: false, ready: 1 }))).toBe("Spin the wheel");
    expect(en(spinButtonKey({ spinning: false, ready: 0 }))).toBe("No spins right now");
    expect(en(spinButtonKey({ spinning: true, ready: 0 }))).toBe("Spinning…");
  });
});
