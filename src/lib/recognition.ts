import type { Schemas } from "@crewstars/api-client";

import type { IconName } from "@/components/ui/Icon";

/**
 * The Give form's rules (CR-19 to CR-23) that the app applies before the server sees
 * anything. The server still decides (plan D6) and refuses a forced send; these only keep the
 * person from asking for something it would refuse.
 */

type PartyOut = Schemas["PartyOut"];
type RecipientGroup = Schemas["RecipientGroup"];
export type TagId = Schemas["GiveContextOut"]["tags"][number];

/** Every value tag, in the order the prototype lists them. Which ones a person may use comes
 *  from the API (`/give/context` tags); Great Leadership is for GMs and above. */
export const TAG_IDS = ["guest", "rush", "team", "clean", "above", "lead"] as const satisfies readonly TagId[];

/** Each tag's glyph (the prototype's TAGS). */
export const TAG_ICONS = {
  guest: "heart",
  rush: "bolt",
  team: "users",
  clean: "sparkle",
  above: "arrowUp",
  lead: "flag",
} as const satisfies Record<TagId, IconName>;

export function isTagId(value: unknown): value is TagId {
  return typeof value === "string" && (TAG_IDS as readonly string[]).includes(value);
}

/** The allowed tags in the canonical order, whatever order the API sent them in. */
export function orderedTags(allowed: readonly string[]): TagId[] {
  return TAG_IDS.filter((id) => allowed.includes(id));
}

export interface AmountOption {
  value: number;
  /** False when it is more than the kudos left: drawn disabled, never sent (acceptance test 2). */
  enabled: boolean;
}

export function amountOptions(amounts: readonly number[], kudosLeft: number): AmountOption[] {
  return amounts.map((value) => ({ value, enabled: value > 0 && value <= kudosLeft }));
}

/** CR-23: not even the smallest amount fits in what is left this month. */
export function kudosUsedUp(amounts: readonly number[], kudosLeft: number): boolean {
  const positive = amounts.filter((value) => value > 0);
  if (positive.length === 0) return kudosLeft <= 0;
  return kudosLeft < Math.min(...positive);
}

/**
 * The amount still selected, if it is still on offer and still affordable. Kudos can drop
 * under a choice (a send from another phone, a refresh), and the choice then quietly lapses
 * rather than being sent and refused.
 */
export function selectedAmount(selected: number | null, amounts: readonly number[], kudosLeft: number): number | null {
  if (selected === null) return null;
  return amounts.includes(selected) && selected <= kudosLeft ? selected : null;
}

/** Characters as the server counts them (Python's len: code points), so an emoji is one, not
 *  the two UTF-16 units `string.length` would say. */
export function charCount(text: string): number {
  return Array.from(text).length;
}

/** Cut a message to `max` code points, never through the middle of an emoji. */
export function clampMessage(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? chars.slice(0, max).join("") : text;
}

/** What the server stores: the words with runs of spaces and line breaks collapsed. Empty
 *  means no message (it is optional). */
export function cleanMessage(text: string): string | null {
  const value = text.split(/\s+/).filter(Boolean).join(" ");
  return value ? value : null;
}

export interface Draft {
  to: string | null;
  tag: TagId | null;
  amount: number | null;
  message: string;
}

/** CR-22: Send is on only with a recipient, a tag and an amount, and while nothing is being
 *  sent already. */
export function canSend(draft: Draft, sending: boolean): boolean {
  return !sending && !!draft.to && !!draft.tag && draft.amount !== null;
}

/** Lower case, accents gone: "José" is found by "jose". */
function fold(text: string): string {
  const decomposed = typeof text.normalize === "function" ? text.normalize("NFD") : text;
  return decomposed.replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * The recipient sheet's search (D18): people whose name has every word typed, at the start of
 * any of its words ("ma lo" finds Maria Lopez), or whose store number starts with it. Groups
 * left empty are dropped; the API's order (highest rank first) is kept.
 */
export function filterGroups(groups: readonly RecipientGroup[], query: string): RecipientGroup[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return groups.filter((group) => group.people.length > 0);
  const matches = (person: PartyOut) => {
    const nameWords = fold(person.name).split(/\s+/);
    const store = person.store?.number ?? "";
    return words.every(
      (word) => nameWords.some((part) => part.startsWith(word)) || (store !== "" && store.startsWith(word)),
    );
  };
  return groups
    .map((group) => ({ ...group, people: group.people.filter(matches) }))
    .filter((group) => group.people.length > 0);
}

export function findPerson(groups: readonly RecipientGroup[], id: string | null | undefined): PartyOut | null {
  if (!id) return null;
  for (const group of groups) {
    const person = group.people.find((candidate) => candidate.id === id);
    if (person) return person;
  }
  return null;
}
