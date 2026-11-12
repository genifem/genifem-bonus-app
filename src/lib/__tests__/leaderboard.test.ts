/** The leaderboard (CR-35), this month's awards (CR-36) and an award on the Wall. */
import { createTranslator } from "@crewstars/i18n";

import {
  type AwardCategory,
  type AwardPerson,
  awardStanding,
  awardTitle,
  awardValue,
  type Leaderboard,
  type LeaderRow,
  onBoard,
  ownTotal,
  standingPerson,
} from "@/lib/leaderboard";

const en = createTranslator("en");
const es = createTranslator("es");

function row(rank: number, me = false): LeaderRow {
  return { rank, id: `p${rank}`, name: `Person ${rank}`, initials: "P", role: "crew", earned: 100 - rank, me };
}

function board(top: LeaderRow[], earned: number, rank: number | null = null): Pick<Leaderboard, "top" | "me"> {
  return { top, me: { earned, rank } };
}

describe("the person's own standing (CR-35)", () => {
  it("is highlighted in the top 5, so no separate total", () => {
    expect(ownTotal(board([row(1), row(2, true)], 98, 2), "crew")).toBeNull();
  });

  it("is only their own total outside it, never a rank", () => {
    expect(ownTotal(board([row(1), row(2), row(3), row(4), row(5)], 12), "crew")).toBe(12);
    expect(ownTotal(board([row(1)], 0), "shift")).toBe(0);
  });

  it("is left out for people who aren't on the board", () => {
    expect(onBoard("gm")).toBe(false);
    expect(ownTotal(board([row(1)], 40), "gm")).toBeNull();
    expect(ownTotal(board([], 0), "director")).toBeNull();
  });

  it("reads each row with its place and coins", () => {
    expect(en("leaderboard.rowA11y", { rank: 1, name: "Maria", count: 240 })).toBe(
      "Number 1: Maria, 240 coins this month",
    );
    expect(en("leaderboard.ownTotal", { count: 1, amount: "1" })).toBe("You: 1 coin this month");
    expect(es("leaderboard.ownTotal", { count: 1240, amount: "1240" })).toBe("Tú: 1240 monedas este mes");
  });
});

function person(id: string, value: number): AwardPerson {
  return { id, name: id === "me" ? "Jamal" : "Maria", initials: "M", role: "crew", value };
}

function category(changes: Partial<AwardCategory>): AwardCategory {
  return {
    id: "top",
    name: "Top Earner",
    name_es: "Mayor ganador",
    metric: "earned",
    coins: 100,
    leader: null,
    winner: null,
    ...changes,
  };
}

describe("an award's standing (CR-36)", () => {
  it("is up for grabs until someone has more than 0", () => {
    expect(awardStanding(en, category({}), "me")).toBe("Up for grabs");
    expect(standingPerson(category({}))).toBeNull();
  });

  it("names who leads, or says it's you", () => {
    expect(awardStanding(en, category({ leader: person("maria", 240) }), "me")).toBe("Leading: Maria");
    expect(awardStanding(en, category({ leader: person("me", 240) }), "me")).toBe("Leading: you!");
    expect(awardStanding(es, category({ leader: person("maria", 240) }), "me")).toBe("Va ganando: Maria");
  });

  it("names the winner once paid, ahead of whoever leads now", () => {
    const paid = category({ leader: person("me", 300), winner: person("maria", 240) });
    expect(awardStanding(en, paid, "me")).toBe("Winner: Maria");
    expect(standingPerson(paid)?.id).toBe("maria");
    expect(awardStanding(en, category({ winner: person("me", 240) }), "me")).toBe("You won this one!");
  });

  it("says what the leader's number means for each award", () => {
    expect(awardValue(en, "earned", 240)).toBe("240 coins this month");
    expect(awardValue(en, "improved", 1)).toBe("1 coin more than last month");
    expect(awardValue(en, "guest", 5)).toBe("5 Guest Hero shout-outs");
    expect(awardValue(en, "peer", 1)).toBe("1 shout-out from the crew");
    expect(awardValue(es, "guest", 5)).toBe("5 reconocimientos de Héroe del cliente");
    expect(awardValue(en, "earned", 1240)).toBe("1,240 coins this month");
  });
});

describe("an award on the Wall", () => {
  const post = { award_name: "Top Earner", award_name_es: "Mayor ganador", award_month: "2026-11" };

  it("is named with its month in the language on screen", () => {
    expect(awardTitle(en, post)).toBe("November's Top Earner");
    expect(awardTitle(es, post)).toBe("Mayor ganador de noviembre");
  });

  it("falls back to the English name, and to the bare name without a month", () => {
    expect(awardTitle(es, { ...post, award_name_es: null })).toBe("Top Earner de noviembre");
    expect(awardTitle(en, { ...post, award_month: null })).toBe("Top Earner");
    expect(awardTitle(en, { award_name: null })).toBe("");
  });
});
