/**
 * The Give form's own rules (CR-19 to CR-23): amounts over the kudos left are never on
 * offer (acceptance test 2), the message is counted as the server counts it, and the picker's
 * search finds people the way someone would type them.
 */
import type { Schemas } from "@crewstars/api-client";

import {
  amountOptions,
  canSend,
  charCount,
  clampMessage,
  cleanMessage,
  filterGroups,
  findPerson,
  kudosUsedUp,
  orderedTags,
  selectedAmount,
} from "@/lib/recognition";

type PartyOut = Schemas["PartyOut"];
type RecipientGroup = Schemas["RecipientGroup"];

describe("amounts and kudos left (CR-21, acceptance test 2)", () => {
  it("disables every amount over the kudos left", () => {
    expect(amountOptions([5, 10, 15], 5)).toEqual([
      { value: 5, enabled: true },
      { value: 10, enabled: false },
      { value: 15, enabled: false },
    ]);
    expect(amountOptions([5, 10, 15], 30).every((option) => option.enabled)).toBe(true);
    expect(amountOptions([5, 10, 15], 10).map((option) => option.enabled)).toEqual([true, true, false]);
    expect(amountOptions([5, 10, 15], 0).some((option) => option.enabled)).toBe(false);
  });

  it("says the kudos are used up when not even the smallest amount fits (CR-23)", () => {
    expect(kudosUsedUp([5, 10, 15], 4)).toBe(true);
    expect(kudosUsedUp([5, 10, 15], 0)).toBe(true);
    expect(kudosUsedUp([5, 10, 15], 5)).toBe(false);
    expect(kudosUsedUp([], 0)).toBe(true);
    expect(kudosUsedUp([], 10)).toBe(false);
  });

  it("lets a choice lapse when the kudos drop under it or it is no longer offered", () => {
    expect(selectedAmount(10, [5, 10, 15], 30)).toBe(10);
    expect(selectedAmount(10, [5, 10, 15], 5)).toBeNull();
    expect(selectedAmount(20, [5, 10, 15], 30)).toBeNull();
    expect(selectedAmount(null, [5, 10, 15], 30)).toBeNull();
  });
});

describe("Send (CR-22)", () => {
  const full = { to: "p1", tag: "guest" as const, amount: 10, message: "" };

  it("needs a recipient, a tag and an amount, and nothing already sending", () => {
    expect(canSend(full, false)).toBe(true);
    expect(canSend(full, true)).toBe(false);
    expect(canSend({ ...full, to: null }, false)).toBe(false);
    expect(canSend({ ...full, tag: null }, false)).toBe(false);
    expect(canSend({ ...full, amount: null }, false)).toBe(false);
  });

  it("does not need a message", () => {
    expect(canSend({ ...full, message: "" }, false)).toBe(true);
  });
});

describe("the message (140 characters in the app)", () => {
  it("counts an emoji as one character, as the server does", () => {
    expect(charCount("Thanks!")).toBe(7);
    expect(charCount("Gracias 🙌")).toBe(9);
    expect("Gracias 🙌".length).toBe(10);
  });

  it("cuts to the limit without splitting an emoji", () => {
    const long = "a".repeat(139) + "🙌🙌";
    const cut = clampMessage(long, 140);
    expect(charCount(cut)).toBe(140);
    expect(cut.endsWith("🙌")).toBe(true);
    expect(clampMessage("short", 140)).toBe("short");
  });

  it("collapses spaces the way the server stores them, and sends nothing for blank", () => {
    expect(cleanMessage("  great   job\n\ntoday ")).toBe("great job today");
    expect(cleanMessage("   \n ")).toBeNull();
    expect(cleanMessage("")).toBeNull();
  });
});

describe("tags", () => {
  it("keeps the prototype's order whatever order the API sends", () => {
    expect(orderedTags(["team", "guest", "lead"])).toEqual(["guest", "team", "lead"]);
    expect(orderedTags(["guest", "rush", "team", "clean", "above"])).not.toContain("lead");
    expect(orderedTags(["unknown", "rush"])).toEqual(["rush"]);
  });
});

function person(id: string, name: string, role: PartyOut["role"], store = "2741"): PartyOut {
  return {
    id,
    name,
    first_name: name.split(" ")[0]!,
    initials: name
      .split(" ")
      .map((part) => part[0])
      .join(""),
    role,
    store: { id: `s${store}`, number: store, name: "Main St" },
  };
}

const groups: RecipientGroup[] = [
  { role: "gm", people: [person("g1", "Monica Díaz", "gm")] },
  { role: "shift", people: [person("s1", "Jordan Bell", "shift")] },
  {
    role: "crew",
    people: [
      person("c1", "Ana Reyes", "crew"),
      person("c2", "José Ortega", "crew"),
      person("c3", "Maria Lopez", "crew", "2815"),
    ],
  },
];

describe("the recipient search (D18)", () => {
  it("returns every group, in the API's order, for an empty search", () => {
    expect(filterGroups(groups, "").map((group) => group.role)).toEqual(["gm", "shift", "crew"]);
    expect(filterGroups(groups, "   ")).toHaveLength(3);
  });

  it("matches the start of any word, ignoring case and accents", () => {
    expect(filterGroups(groups, "jose").flatMap((group) => group.people.map((p) => p.id))).toEqual(["c2"]);
    expect(filterGroups(groups, "DIAZ").flatMap((group) => group.people.map((p) => p.id))).toEqual(["g1"]);
    expect(filterGroups(groups, "ma lo").flatMap((group) => group.people.map((p) => p.id))).toEqual(["c3"]);
    expect(filterGroups(groups, "eyes")).toEqual([]);
  });

  it("drops groups left empty", () => {
    expect(filterGroups(groups, "ana").map((group) => group.role)).toEqual(["crew"]);
  });

  it("finds someone at another store by its number", () => {
    expect(filterGroups(groups, "2815").flatMap((group) => group.people.map((p) => p.id))).toEqual(["c3"]);
  });

  it("finds a chosen person in the groups, or nobody", () => {
    expect(findPerson(groups, "s1")?.name).toBe("Jordan Bell");
    expect(findPerson(groups, "gone")).toBeNull();
    expect(findPerson(groups, null)).toBeNull();
  });
});
