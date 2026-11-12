/**
 * Notification sentences are written on the phone from the type and params (plan D14), in
 * whichever language is on screen, so the list switches language with the rest (NF-02).
 */
import { createTranslator } from "@crewstars/i18n";

import { monthLabel, notificationIcon, type NotificationOut, notificationText } from "@/lib/notifications";

const en = createTranslator("en");
const es = createTranslator("es");

function note(type: string, params: Record<string, unknown> = {}, coins: number | null = null) {
  return { type: type as NotificationOut["type"], params, coins };
}

describe("shoutout_received", () => {
  const n = note("shoutout_received", { from_name: "Monica", tag: "guest" }, 25);

  it("names the sender and the tag in the language on screen", () => {
    expect(notificationText(en, n)).toBe("Monica recognized you for Guest Hero");
    expect(notificationText(es, n)).toBe("Monica te reconoció por Héroe del cliente");
  });

  it("shows an unknown tag id as it came rather than a catalog key", () => {
    expect(notificationText(en, note("shoutout_received", { from_name: "Grant", tag: "mystery" }))).toBe(
      "Grant recognized you for mystery",
    );
  });

  it("picks the tag's glyph", () => {
    expect(notificationIcon(n)).toBe("heart");
    expect(notificationIcon(note("shoutout_received", { tag: "rush" }))).toBe("bolt");
    expect(notificationIcon(note("shoutout_received", { tag: "?" }))).toBe("heart");
  });
});

describe("tier_reached", () => {
  const n = note("tier_reached", { tier_id: "silver", tier_name: "Silver", tier_name_es: "Plata" });

  it("uses the Spanish tier name in Spanish", () => {
    expect(notificationText(en, n)).toBe("You reached Silver!");
    expect(notificationText(es, n)).toBe("¡Llegaste a Plata!");
  });

  it("falls back to the English name when there is no Spanish one", () => {
    const bare = note("tier_reached", { tier_id: "gold", tier_name: "Gold", tier_name_es: null });
    expect(notificationText(es, bare)).toBe("¡Llegaste a Gold!");
  });
});

describe("the later phases' types", () => {
  it("writes badges with and without a bonus", () => {
    const badge = { badge_name: "Guest Hero", badge_name_es: "Héroe" };
    expect(notificationText(en, note("badge_earned", badge, 25))).toBe("New badge: Guest Hero (+25 coins)");
    expect(notificationText(en, note("badge_earned", badge, 1))).toBe("New badge: Guest Hero (+1 coin)");
    expect(notificationText(en, note("badge_earned", badge))).toBe("New badge: Guest Hero");
    expect(notificationText(es, note("badge_earned", badge, 25))).toBe("Nueva insignia: Héroe (+25 monedas)");
  });

  it("gives a spin's reason when it is one the app knows", () => {
    expect(notificationText(en, note("spin_earned", { reason: "coins" }))).toBe("You earned a spin for earning coins");
    expect(notificationText(es, note("spin_earned", { reason: "badge" }))).toBe("Ganaste un giro por una insignia nueva");
    expect(notificationText(en, note("spin_earned", { reason: "something_new" }))).toBe("You earned a spin!");
    expect(notificationText(en, note("spin_earned"))).toBe("You earned a spin!");
  });

  it("writes prizes, requests and decisions", () => {
    expect(notificationText(en, note("spin_result", { prize_label: "Free fries", prize_label_es: "Papas gratis" }))).toBe(
      "You won Free fries on the wheel",
    );
    expect(notificationText(es, note("spin_result", { prize_label: "Free fries", prize_label_es: "Papas gratis" }))).toBe(
      "Ganaste Papas gratis en la ruleta",
    );
    expect(notificationText(en, note("reward_requested", { from_name: "Jamal", reward_name: "Meal on us" }))).toBe(
      "Jamal asked to redeem Meal on us",
    );
    expect(notificationText(en, note("reward_approved", { reward_name: "Meal on us" }))).toBe(
      "Your Meal on us is ready to collect",
    );
    expect(notificationText(en, note("reward_declined", { reward_name: "Hoodie" }, 100))).toBe(
      "Your Hoodie request was declined. 100 coins are back in your balance",
    );
    expect(notificationText(es, note("reward_declined", { reward_name: "Sudadera" }, 1))).toBe(
      "Rechazaron tu solicitud de Sudadera. Se devolvió 1 moneda a tu saldo",
    );
    expect(notificationText(en, note("reward_declined", { reward_name: "Hoodie" }))).toBe(
      "Your Hoodie request was declined.",
    );
  });

  it("reads the rewards' notifications as the API sends them (MG-08, MG-06)", () => {
    // The redeem and the decision send the reward's names and the requester's first name;
    // a decline's refund comes as `coins`.
    const names = { reward_name: "Meal on us", reward_name_es: "Comida por nuestra cuenta" };
    const requested = note("reward_requested", { from_name: "Jamal", ...names });
    expect(notificationText(en, requested)).toBe("Jamal asked to redeem Meal on us");
    expect(notificationText(es, requested)).toBe("Jamal pidió canjear Comida por nuestra cuenta");
    expect(notificationText(es, note("reward_approved", names))).toBe("Ya puedes recoger tu Comida por nuestra cuenta");
    expect(notificationText(en, note("reward_declined", names, 100))).toBe(
      "Your Meal on us request was declined. 100 coins are back in your balance",
    );
    expect(notificationText(es, note("reward_declined", { ...names, reward_name_es: null }, 100))).toBe(
      "Rechazaron tu solicitud de Meal on us. Se devolvieron 100 monedas a tu saldo",
    );
    expect(notificationIcon(requested)).toBe("gift");
    expect(notificationIcon(note("reward_declined", names, 100))).toBe("info");
  });

  it("names the award's month in the language on screen", () => {
    const award = note("award_won", { award_name: "Guest Hero of the Month", award_name_es: null, month: "2026-10" }, 100);
    expect(notificationText(en, award)).toBe("You won Guest Hero of the Month for October!");
    expect(notificationText(es, award)).toBe("¡Ganaste Guest Hero of the Month de octubre!");
    expect(notificationIcon(award)).toBe("trophy");
  });
});

describe("a type this app has never heard of", () => {
  it("still says something, in either language", () => {
    expect(notificationText(en, note("streak_extended", { days: 3 }))).toBe("You have a new notification");
    expect(notificationText(es, note("streak_extended"))).toBe("Tienes una notificación nueva");
    expect(notificationIcon(note("streak_extended"))).toBe("bell");
  });

  it("never shows a placeholder when params are missing", () => {
    expect(notificationText(en, note("shoutout_received"))).not.toMatch(/[{}]/);
    expect(notificationText(en, note("tier_reached"))).not.toMatch(/[{}]/);
  });
});

describe("monthLabel", () => {
  it("names a YYYY-MM month and leaves anything else as it came", () => {
    expect(monthLabel("2026-01", "en")).toBe("January");
    expect(monthLabel("2026-12", "es")).toBe("diciembre");
    expect(monthLabel("autumn", "en")).toBe("autumn");
  });
});
