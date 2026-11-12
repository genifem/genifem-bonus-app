import type { Translator, Values } from "@crewstars/i18n";

import { ApiError } from "@/lib/apiError";
import { clockTime, minutesLeft } from "@/lib/format";

/** What went wrong, in the person's language: the API's error code when the catalog has a
 *  message for it (`errors.<code>`), else the generic one. */
export function explain(t: Translator, err: unknown): string {
  const code = err instanceof ApiError ? err.code : "generic";
  return t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.generic");
}

/**
 * A failure as something to say, kept as a catalog key rather than a sentence so it can be
 * said again in the other language, or with a countdown that has moved on.
 */
export interface Problem {
  /** The API's code ("code_locked"), or "network" / "generic". */
  code: string;
  /** The message: `errors.<code>` or a more specific variant of it. */
  key: string;
  values?: Values;
  /**
   * When the wait behind it ends, on this phone's clock (ms). The message counts down to it
   * ({seconds}, {minutes}, {time}) and goes away when it passes.
   */
  until?: number;
  /** The setup step's receipt is spent or out of time: the only way on is to start again. */
  restart?: boolean;
}

/** CR-04 and CR-07 both lock for 15 minutes. */
const LOCK_S = 15 * 60;

function details(err: ApiError): Record<string, unknown> {
  return typeof err.details === "object" && err.details !== null ? (err.details as Record<string, unknown>) : {};
}

function detailNumber(err: ApiError, key: string): number | null {
  const value = details(err)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * How long a lock or a wait has left, in seconds, from the error's details: `retry_after_s`
 * when the API sends one, else the time left until `until`. Null when it says neither.
 */
export function waitSeconds(err: ApiError, now: number): number | null {
  const after = detailNumber(err, "retry_after_s");
  if (after !== null) return after;
  const until = details(err).until;
  if (typeof until !== "string") return null;
  const end = Date.parse(until);
  return Number.isNaN(end) ? null : (end - now) / 1000;
}

/**
 * A lock as a deadline on this phone's clock. `until` is the server's clock, and a phone
 * that is a few minutes out would otherwise say "0 minutes" (and let go at once) or "75
 * minutes". So the time left is kept between one second and the lock's full length, and the
 * countdown runs from now.
 */
function lock(err: ApiError, key: string, now: number): Problem {
  const left = waitSeconds(err, now);
  const seconds = Math.ceil(left === null || left > LOCK_S ? LOCK_S : Math.max(1, left));
  return {
    code: err.code,
    key,
    until: now + seconds * 1000,
    values: { seconds, minutes: minutesLeft(seconds) },
  };
}

function plain(code: string): Problem {
  return { code, key: `errors.${code}` };
}

const GENERIC: Problem = plain("generic");

/**
 * A failed sign-in (CR-02, CR-07, CR-08, CR-09). A wrong EID, a wrong password and an account
 * that never finished setup all say CR-02's one sentence, so nothing tells anyone which EIDs
 * exist. A lock, a terminated account (only told after the right password), a dead connection
 * and a server fault are told apart, since each has a different way forward.
 */
export function signInProblem(err: unknown, now: number): Problem {
  if (!(err instanceof ApiError)) return GENERIC;
  switch (err.code) {
    case "account_locked":
      return lock(err, "errors.account_locked", now);
    case "network":
    case "account_inactive":
    case "rate_limited":
    case "owner_use_portal":
      return plain(err.code);
  }
  // 422 is an EID or password the API would not even look up (too long, say): still a
  // combination that does not match.
  if (err.status === 401 || err.status === 422) return plain("credentials_invalid");
  return GENERIC;
}

/** The codes after which the setup receipt cannot be used again (CR-03, step 3). */
const RESTART = new Set(["token_expired", "token_used", "token_invalid"]);

/** A failed setup or reset step (CR-03 to CR-06). */
export function setupProblem(t: Translator, err: unknown, now: number): Problem {
  if (!(err instanceof ApiError)) return GENERIC;
  switch (err.code) {
    case "code_locked":
      return lock(err, "errors.code_locked", now);
    case "code_invalid": {
      const left = detailNumber(err, "attempts_left");
      return left === null
        ? plain(err.code)
        : { code: err.code, key: "errors.code_invalid_left", values: { count: left } };
    }
    case "resend_too_soon": {
      // CR-04: thirty seconds between codes, unless the API says how long is left.
      const seconds = Math.max(1, Math.ceil(detailNumber(err, "retry_after_s") ?? 30));
      return { code: err.code, key: "errors.resend_too_soon", until: now + seconds * 1000, values: { seconds } };
    }
  }
  if (RESTART.has(err.code)) return { ...plain(err.code), restart: true };
  return t.has(`errors.${err.code}`) ? plain(err.code) : GENERIC;
}

/**
 * A shout-out the server refused or never answered (CR-19 to CR-23), with the numbers it
 * sends back: how many kudos are really left, the longest message allowed.
 */
export function sendProblem(t: Translator, err: unknown): Problem {
  if (!(err instanceof ApiError)) return GENERIC;
  switch (err.code) {
    case "kudos_insufficient": {
      const left = detailNumber(err, "kudos_left");
      return left === null
        ? plain(err.code)
        : { code: err.code, key: "errors.kudos_insufficient_left", values: { count: left } };
    }
    case "message_too_long": {
      const max = detailNumber(err, "max");
      return max === null ? plain(err.code) : { code: err.code, key: "errors.message_too_long_max", values: { max } };
    }
  }
  return t.has(`errors.${err.code}`) ? plain(err.code) : GENERIC;
}

/**
 * The words for a problem, `secondsLeft` into its countdown (null before the first tick, when
 * the values worked out as it happened still stand). Null once a wait is over: there is
 * nothing left to say.
 */
export function say(t: Translator, problem: Problem | null, secondsLeft: number | null): string | null {
  if (!problem) return null;
  if (problem.until === undefined) return t(problem.key, problem.values);
  if (secondsLeft !== null && secondsLeft <= 0) return null;
  const values: Values = { ...problem.values, time: clockTime(problem.until, t.locale) };
  if (secondsLeft !== null) {
    values.seconds = secondsLeft;
    values.minutes = minutesLeft(secondsLeft);
  }
  return t(problem.key, values);
}
