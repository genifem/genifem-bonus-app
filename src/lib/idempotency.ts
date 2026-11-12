import { ApiError } from "@/lib/apiError";

/**
 * Idempotency keys for coin actions (plan D13). The server keeps the first result for each
 * key, so the key must name one *intent*, not one request:
 *
 *   - a tap on Send with a new draft gets a new key;
 *   - a retry of that same draft after the outcome was unknown (no connection, a server
 *     fault, a timeout) reuses it, so if the first request did land the retry returns that
 *     shout-out instead of sending the coins twice;
 *   - once the server has answered (sent, or refused with a reason), the intent is over, and
 *     the next tap is a new one, even with the same draft.
 */

export interface Intent {
  key: string;
  /** What the key was made for; a different draft is a different intent. */
  fingerprint: string;
}

/** A version-4 UUID. Hermes has no crypto.randomUUID, so the random source is passed in
 *  (crypto.getRandomValues where the engine has it, else Math.random). */
export function uuid4(randomByte: () => number = defaultRandomByte): string {
  const bytes = Array.from({ length: 16 }, () => randomByte() & 0xff);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function defaultRandomByte(): number {
  const crypto = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;
  if (crypto?.getRandomValues) return crypto.getRandomValues(new Uint8Array(1))[0]!;
  return Math.floor(Math.random() * 256);
}

/** The intent for a tap: the one still open when it is for the same draft, else a new one. */
export function intentFor(open: Intent | null, fingerprint: string, makeKey: () => string = uuid4): Intent {
  return open && open.fingerprint === fingerprint ? open : { key: makeKey(), fingerprint };
}

/**
 * Whether the server may have acted without the app hearing about it: no answer at all, or a
 * fault on its side. Only then is a retry the same intent.
 */
export function outcomeUnknown(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true;
  return err.status === 0 || err.status === 408 || err.status >= 500;
}

/** The intent to keep open after an attempt: the same one when the outcome is unknown,
 *  nothing after a success (`err` null) or a clear answer from the server. */
export function afterAttempt(intent: Intent, err: unknown): Intent | null {
  return err !== null && outcomeUnknown(err) ? intent : null;
}

/** A draft as one string, so two drafts are the same intent only if every field matches. */
export function fingerprintOf(fields: Record<string, string | number | null>): string {
  return JSON.stringify(Object.keys(fields).sort().map((key) => [key, fields[key]]));
}
