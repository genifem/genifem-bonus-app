/**
 * What a valid Employee ID and password look like on this side, so a form can say so before
 * anything is sent. The API applies the same rules and has the last word.
 */

/** The roster's EIDs: letters and digits as the payroll system prints them, 3 to 20 (the
 *  API's EID_RE). Matched without regard to case. */
export const EID_MIN = 3;
export const EID_MAX = 20;

/**
 * What was typed (or pasted, or autofilled) as an EID, the way the roster stores it: spaces
 * and punctuation dropped, letters upper-cased. Letters are kept on purpose: an operator
 * whose payroll prints "E2741001" must still be able to sign in.
 */
export function normaliseEid(text: string): string {
  return text
    .replace(/[^0-9a-z]/gi, "")
    .toUpperCase()
    .slice(0, EID_MAX);
}

export function isEid(value: string): boolean {
  return value.length >= EID_MIN && value.length <= EID_MAX && /^[0-9A-Z]+$/.test(value);
}

/** CR-05: at least 8 characters and at least one number. */
export const PASSWORD_MIN = 8;
/** The API refuses anything longer, so the field stops there rather than failing later. */
export const PASSWORD_MAX = 128;

export interface PasswordChecks {
  /** 8 or more characters. */
  length: boolean;
  /** At least one number. */
  number: boolean;
  /** The confirmation is filled in and the same. */
  match: boolean;
}

/** The live checklist under the new-password fields (CR-05), one answer per line. */
export function passwordChecks(password: string, confirm: string): PasswordChecks {
  return {
    length: password.length >= PASSWORD_MIN,
    number: /\d/.test(password),
    match: confirm.length > 0 && password === confirm,
  };
}

/** Submit stays off until every line of the checklist is ticked. */
export function passwordReady(checks: PasswordChecks): boolean {
  return checks.length && checks.number && checks.match;
}
