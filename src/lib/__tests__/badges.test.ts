/** The badge grid (CR-33) and the profile's "shout-outs given" (CR-32). */
import { createTranslator } from "@crewstars/i18n";

import {
  badgeIcon,
  badgeName,
  badgeProgress,
  earnedCount,
  howToEarn,
  type MyBadge,
  shoutoutsGiven,
} from "@/lib/badges";

const en = createTranslator("en");
const es = createTranslator("es");

function badge(changes: Partial<MyBadge>): MyBadge {
  return {
    id: "guest",
    name: "Guest Hero",
    name_es: "Héroe del cliente",
    icon: "heart",
    rule: "tag",
    tag: "guest",
    count: 3,
    bonus: 25,
    gives_spin: true,
    earned: false,
    earned_at: null,
    progress: 0,
    ...changes,
  };
}

describe("how to earn a badge", () => {
  it("words each rule", () => {
    expect(howToEarn(en, badge({}))).toBe("Get 3 Guest Hero shout-outs");
    expect(howToEarn(en, badge({ count: 1 }))).toBe("Get 1 Guest Hero shout-out");
    expect(howToEarn(en, badge({ rule: "given", tag: null, count: 8 }))).toBe("Give 8 shout-outs");
    expect(howToEarn(en, badge({ rule: "days", tag: null, count: 90 }))).toBe("Reach 90 days on the team");
    expect(howToEarn(en, badge({ rule: "spin", tag: null, count: 1 }))).toBe("Win it on the wheel");
  });

  it("in Spanish, with the tag's Spanish name", () => {
    expect(howToEarn(es, badge({}))).toBe("Recibe 3 reconocimientos de Héroe del cliente");
    expect(howToEarn(es, badge({ rule: "days", tag: null, count: 90 }))).toBe("Cumple 90 días en el equipo");
  });

  it("still says something for a rule or tag this app doesn't know", () => {
    expect(howToEarn(en, badge({ rule: "streak" as MyBadge["rule"] }))).toBe("Keep shining to earn it");
    expect(howToEarn(en, badge({ tag: null }))).toBe("Keep shining to earn it");
    expect(howToEarn(en, badge({ tag: "mystery" as MyBadge["tag"] }))).toBe("Get 3 mystery shout-outs");
  });
});

describe("progress on a locked badge", () => {
  it("counts toward the rule's number", () => {
    expect(badgeProgress(badge({ progress: 2 }))).toEqual({ value: 2, target: 3, fraction: 2 / 3 });
    expect(en("badges.progress", { value: 2, count: 3 })).toBe("2 of 3");
  });

  it("stops at full, and never goes below empty", () => {
    expect(badgeProgress(badge({ progress: 5 }))).toEqual({ value: 3, target: 3, fraction: 1 });
    expect(badgeProgress(badge({ progress: -1 }))).toEqual({ value: 0, target: 3, fraction: 0 });
  });

  it("has none once earned, for Lucky Star, or with no hire date for a milestone", () => {
    expect(badgeProgress(badge({ earned: true, progress: 3 }))).toBeNull();
    expect(badgeProgress(badge({ rule: "spin", progress: null }))).toBeNull();
    expect(badgeProgress(badge({ rule: "days", progress: null, count: 90 }))).toBeNull();
  });

  it("never divides by a zero count", () => {
    expect(badgeProgress(badge({ count: 0, progress: 0 }))).toEqual({ value: 0, target: 1, fraction: 0 });
  });
});

describe("the grid's names and glyphs", () => {
  it("uses the Spanish name when there is one", () => {
    expect(badgeName(badge({}), "es")).toBe("Héroe del cliente");
    expect(badgeName(badge({ name_es: null }), "es")).toBe("Guest Hero");
    expect(badgeName(badge({}), "en")).toBe("Guest Hero");
  });

  it("draws the owner's glyph, or a star for one it doesn't have", () => {
    expect(badgeIcon("calendar")).toBe("calendar");
    expect(badgeIcon("unicorn")).toBe("star");
    expect(badgeIcon("constructor")).toBe("star");
  });

  it("counts the earned ones", () => {
    expect(earnedCount([badge({ earned: true }), badge({}), badge({ earned: true })])).toBe(2);
  });
});

describe("shout-outs given (CR-32)", () => {
  it("is the 'give N shout-outs' badge's progress, all time", () => {
    const badges = [badge({}), badge({ id: "giver", rule: "given", tag: null, count: 8, progress: 11, earned: true })];
    expect(shoutoutsGiven(badges)).toBe(11);
  });

  it("is unknown without such a badge", () => {
    expect(shoutoutsGiven([badge({})])).toBeNull();
    expect(shoutoutsGiven([])).toBeNull();
  });
});
