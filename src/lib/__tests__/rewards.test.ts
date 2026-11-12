/**
 * Rewards in words and numbers (CR-24 to CR-27): the server decides whether a reward can be
 * redeemed (plan D6); the app says why not, in the language on screen, and draws the limit
 * card and the confirm sheet's "after this" line.
 */
import { createTranslator } from "@crewstars/i18n";

import { ApiError } from "@/lib/apiError";
import { explain, redeemProblem, say } from "@/lib/errors";
import {
  afterRedeem,
  approverKey,
  decisionKey,
  ELIGIBILITY_CODES,
  type Eligibility,
  eligibilityReason,
  isEligibilityCode,
  limitView,
  nextStepKey,
  pendingLeadKey,
  reasonText,
  rewardDescription,
  rewardIcon,
  rewardName,
  statusKey,
  statusTone,
} from "@/lib/rewards";

const en = createTranslator("en");
const es = createTranslator("es");

function refused(code: Eligibility["code"], params: Record<string, unknown> = {}): Eligibility {
  return { ok: false, code, params };
}

describe("why Redeem is off (CR-25), in the spec's words", () => {
  it("names the tier a reward unlocks at, in Spanish when the owner gave one", () => {
    const gold = refused("locked_tier", { tier_id: "gold", tier_name: "Gold", tier_name_es: "Oro" });
    expect(reasonText(en, gold)).toBe("Unlocks at Gold");
    expect(reasonText(es, gold)).toBe("Se desbloquea en Oro");
    expect(eligibilityReason(gold, "en")?.locked).toBe(true);
  });

  it("names the badge, falling back to English when there is no Spanish name", () => {
    const badge = refused("locked_badge", { badge_id: "d90", badge_name: "90 Days Strong", badge_name_es: null });
    expect(reasonText(en, badge)).toBe("Unlocks with the 90 Days Strong badge");
    expect(reasonText(es, badge)).toBe("Se desbloquea con la insignia 90 Days Strong");
    expect(eligibilityReason(badge, "es")?.locked).toBe(true);
  });

  it("counts the per-reward limit: once, or N times", () => {
    expect(reasonText(en, refused("reward_limit", { limit: 1 }))).toBe("You've had this once this month");
    expect(reasonText(en, refused("reward_limit", { limit: 4 }))).toBe("You've had this 4 times this month");
    expect(reasonText(es, refused("reward_limit", { limit: 2 }))).toBe("Ya lo canjeaste 2 veces este mes");
  });

  it("says when the month's rewards are all used (acceptance test 9)", () => {
    expect(reasonText(en, refused("monthly_rewards_used", { max: 3 }))).toBe("All 3 rewards used this month");
    expect(reasonText(es, refused("monthly_rewards_used", { max: 3 }))).toBe("Ya usaste los 3 premios de este mes");
  });

  it("names the monthly coin cap (acceptance test 8)", () => {
    expect(reasonText(en, refused("monthly_coin_cap", { max: 500 }))).toBe("Over your 500-coin monthly limit");
    expect(reasonText(en, refused("monthly_coin_cap", { max: 1500 }))).toBe("Over your 1,500-coin monthly limit");
    expect(reasonText(es, refused("monthly_coin_cap", { max: 500 }))).toBe("Supera tu límite mensual de 500 monedas");
  });

  it("counts the coins still to earn (acceptance test 5)", () => {
    expect(reasonText(en, refused("coins_short", { short: 75 }))).toBe("75 more coins to go");
    expect(reasonText(en, refused("coins_short", { short: 1 }))).toBe("1 more coin to go");
    expect(reasonText(es, refused("coins_short", { short: 75 }))).toBe("Te faltan 75 monedas");
    expect(eligibilityReason(refused("coins_short", { short: 75 }), "en")?.locked).toBe(false);
  });

  it("says the store's budget is used up (acceptance test 10)", () => {
    expect(reasonText(en, refused("store_budget_used"))).toBe("Store reward budget is used up this month");
    expect(reasonText(es, refused("store_budget_used"))).toBe("El presupuesto de premios de tu tienda se agotó este mes");
  });

  it("says nothing when the reward can be redeemed", () => {
    expect(reasonText(en, { ok: true, code: null, params: {} })).toBeNull();
  });

  it("still says something true for a code it doesn't know or a number that is missing", () => {
    const unknown = { ok: false, code: "new_rule" as Eligibility["code"], params: {} };
    expect(reasonText(en, unknown)).toBe("Not available right now");
    expect(reasonText(en, refused("coins_short", {}))).toBe("Not available right now");
    expect(reasonText(en, refused("locked_tier", {}))).toBe("Not available right now");
    expect(eligibilityReason(refused("locked_tier", {}), "en")?.locked).toBe(true);
  });

  it("has words in both languages for every code the API sends", () => {
    for (const code of ELIGIBILITY_CODES) {
      expect(en.has(`rewards.reasons.${code}`)).toBe(true);
      expect(es.has(`rewards.reasons.${code}`)).toBe(true);
      expect(isEligibilityCode(code)).toBe(true);
    }
    expect(isEligibilityCode("coins_short ")).toBe(false);
  });
});

describe("a refused redeem says the same as the card would", () => {
  const fail = (status: number, code: string, details?: unknown) => new ApiError(status, code, code, details);

  it("turns an eligibility refusal into the card's reason, with its numbers", () => {
    expect(say(en, redeemProblem(en, fail(409, "coins_short", { short: 30 })), null)).toBe("30 more coins to go");
    expect(say(es, redeemProblem(es, fail(403, "locked_tier", { tier_name: "Gold", tier_name_es: "Oro" })), null)).toBe(
      "Se desbloquea en Oro",
    );
    expect(say(en, redeemProblem(en, fail(409, "monthly_rewards_used", { max: 3 })), null)).toBe(
      "All 3 rewards used this month",
    );
  });

  it("explains the redeem's other codes, and falls back for anything else", () => {
    for (const code of ["redeem_conflict", "reward_not_found", "idempotency_key_reused"]) {
      expect(en.has(`errors.${code}`)).toBe(true);
      expect(explain(es, fail(409, code))).not.toBe(explain(en, fail(409, code)));
    }
    expect(say(en, redeemProblem(en, fail(404, "reward_not_found")), null)).toBe("That reward isn't available anymore.");
    expect(say(en, redeemProblem(en, fail(0, "network")), null)).toBe(
      "You're offline. Check your connection and try again.",
    );
    expect(say(en, redeemProblem(en, fail(500, "http_500")), null)).toBe("Something went wrong. Try again.");
    expect(say(en, redeemProblem(en, new Error("boom")), null)).toBe("Something went wrong. Try again.");
  });
});

describe("the monthly limit card (CR-24)", () => {
  const limits = (coins: number, maxCoins: number, rewards = 0, maxRewards = 3) => ({
    coins_redeemed: coins,
    max_coins: maxCoins,
    rewards_redeemed: rewards,
    max_rewards: maxRewards,
  });

  it("fills the bar with the coins used of the cap", () => {
    expect(limitView(limits(0, 500)).coinsFraction).toBe(0);
    expect(limitView(limits(450, 500)).coinsFraction).toBeCloseTo(0.9);
    expect(limitView(limits(500, 500)).coinsFraction).toBe(1);
  });

  it("never draws past full, or below empty", () => {
    // An owner can lower the cap below what someone has already redeemed this month.
    expect(limitView(limits(600, 500)).coinsFraction).toBe(1);
    expect(limitView(limits(-5, 500)).coinsFraction).toBe(0);
    expect(limitView(limits(-5, 500)).coinsUsed).toBe(0);
  });

  it("draws a cap of 0 as full: there is nothing left to spend", () => {
    expect(limitView(limits(0, 0)).coinsFraction).toBe(1);
  });

  it("passes the reward count through", () => {
    expect(limitView(limits(100, 500, 2, 3))).toMatchObject({ coinsUsed: 100, coinsMax: 500, rewardsUsed: 2, rewardsMax: 3 });
  });
});

describe("after redeeming (CR-26)", () => {
  it("takes the cost off the balance and adds one to the month's rewards", () => {
    expect(afterRedeem(175, { rewards_redeemed: 1, max_rewards: 3 }, 100)).toEqual({
      balance: 75,
      rewardsUsed: 2,
      rewardsMax: 3,
    });
  });

  it("never shows a balance below zero", () => {
    expect(afterRedeem(30, { rewards_redeemed: 0, max_rewards: 3 }, 40).balance).toBe(0);
  });
});

describe("a request's status (CR-27)", () => {
  const words = (status: Parameters<typeof statusKey>[0]["status"], cost = 100) => [
    en(statusKey({ status, cost })),
    es(statusKey({ status, cost })),
  ];

  it("uses the spec's words in both languages", () => {
    expect(words("pending")).toEqual(["Waiting for approval", "Esperando aprobación"]);
    expect(words("approved")).toEqual(["Ready to collect", "Listo para recoger"]);
    expect(words("declined")).toEqual(["Declined, coins returned", "Rechazado, monedas devueltas"]);
    expect(words("cancelled")).toEqual(["Cancelled", "Cancelado"]);
    expect(words("collected")).toEqual(["Collected", "Recogido"]);
  });

  it("doesn't promise coins back for a free prize", () => {
    expect(words("declined", 0)).toEqual(["Declined", "Rechazado"]);
  });

  it("says something for a status this app has never heard of", () => {
    expect(en(statusKey({ status: "lost" as never, cost: 10 }))).toBe("Updated");
  });

  it("colours waiting amber, ready mint, collected sky, and the rest grey", () => {
    expect(statusTone("pending")).toBe("pending");
    expect(statusTone("approved")).toBe("approved");
    expect(statusTone("collected")).toBe("info");
    expect(statusTone("declined")).toBe("declined");
    expect(statusTone("cancelled")).toBe("declined");
  });

  it("calls a recent decision Approved or Declined (MG-07), a collected one Approved", () => {
    expect(en(decisionKey("approved"))).toBe("Approved");
    expect(en(decisionKey("collected"))).toBe("Approved");
    expect(en(decisionKey("declined"))).toBe("Declined");
    expect(es(decisionKey("declined"))).toBe("Rechazado");
  });
});

describe("what happens next, from the server's own fields", () => {
  it("says on the confirm sheet whether it waits for approval (the catalogue's `approval`)", () => {
    expect(en(nextStepKey(true))).toBe(
      "It needs approval first. Your coins are held until then, and they come back if it's declined.",
    );
    expect(en(nextStepKey(false))).toBe("No approval needed: it's ready to collect as soon as you redeem it.");
    expect(es(nextStepKey(false))).toBe("No necesita aprobación: podrás recogerlo en cuanto lo canjees.");
  });

  it("names who decides from the request's `approver` (MG-09)", () => {
    expect([en(approverKey("gm")), en(approverKey("owner"))]).toEqual(["Your manager decides", "The owners decide"]);
    expect([es(approverKey("gm")), es(approverKey("owner"))]).toEqual(["Lo decide tu gerente", "Lo deciden los dueños"]);
    expect(en(pendingLeadKey("gm"))).toBe("Your manager has it now. We'll let you know when it's ready to collect.");
    expect(en(pendingLeadKey("owner"))).toBe("The owners have it now. We'll let you know when it's ready to collect.");
  });
});

describe("names and glyphs", () => {
  const reward = { name: "Meal on us", name_es: "Comida por nuestra cuenta", description: "Lunch", description_es: null };

  it("uses the owner's Spanish when there is one (plan G8)", () => {
    expect(rewardName(reward, "es")).toBe("Comida por nuestra cuenta");
    expect(rewardName(reward, "en")).toBe("Meal on us");
    expect(rewardName({ name: "Hoodie", name_es: "" }, "es")).toBe("Hoodie");
    expect(rewardDescription(reward, "es")).toBe("Lunch");
  });

  it("draws the prototype's glyphs, and a gift for any other", () => {
    expect(rewardIcon("burger")).toBe("burger");
    expect(rewardIcon("sun")).toBe("sun");
    expect(rewardIcon("rocket")).toBe("gift");
    expect(rewardIcon("toString")).toBe("gift");
  });
});
