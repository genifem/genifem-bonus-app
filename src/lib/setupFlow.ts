import type { Problem } from "@/lib/errors";

/**
 * Where someone is in first-time setup or a password reset (CR-03 to CR-06), shared by the
 * three steps.
 *
 * It lives in memory, in the setup section's layout, and nowhere else: the setup token is a
 * receipt that the texted code was right, and it must not end up in a URL, in history or on
 * disk. Leaving the setup screens drops it. Deadlines are on this phone's clock, worked out
 * from the relative times the API sends.
 *
 * Pure, so the transitions are tested without a screen.
 */

export type Purpose = "setup" | "reset";

export interface SetupFlow {
  /** First-time setup or "Forgot password?": only the titles differ (CR-06). */
  purpose: Purpose;
  /** The EID the code went to, normalised. */
  eid: string;
  /** "(•••) •••-4821", from `/auth/setup/start`. Set once a code has gone out. */
  maskedPhone: string | null;
  /** When the texted code stops working (CR-04: 10 minutes). Null once it is spent. */
  codeExpiresAt: number | null;
  /** When "Resend code" unlocks (CR-04: 30 seconds), or when the API said to wait until. */
  resendAt: number | null;
  /** Five wrong codes lock the EID's code flow for 15 minutes (CR-04). */
  lock: Problem | null;
  /** The code was right: what step 3 trades, with the new password, for a session. */
  setupToken: string | null;
}

export type FlowAction =
  /** A code went out (step 1, or "Resend code"). Anything from an earlier code is void. */
  | {
      type: "sent";
      eid: string;
      purpose: Purpose;
      maskedPhone: string;
      expiresInS: number;
      resendAfterS: number;
      now: number;
    }
  /** The API asked for a wait before another code (`resend_too_soon`). */
  | { type: "wait"; until: number }
  /** The fifth wrong code (`code_locked`). The API has thrown the code away. */
  | { type: "locked"; lock: Problem }
  /** The API says the code has run out (`code_expired`). */
  | { type: "expired" }
  /** The code was right. */
  | { type: "verified"; setupToken: string }
  /** The receipt is spent or stale: back to step 1, keeping the EID and the purpose. */
  | { type: "restart" };

export function initialFlow(purpose: Purpose = "setup"): SetupFlow {
  return {
    purpose,
    eid: "",
    maskedPhone: null,
    codeExpiresAt: null,
    resendAt: null,
    lock: null,
    setupToken: null,
  };
}

export function flowReducer(state: SetupFlow, action: FlowAction): SetupFlow {
  switch (action.type) {
    case "sent":
      return {
        purpose: action.purpose,
        eid: action.eid,
        maskedPhone: action.maskedPhone,
        codeExpiresAt: action.now + action.expiresInS * 1000,
        resendAt: action.now + action.resendAfterS * 1000,
        lock: null,
        setupToken: null,
      };
    case "wait":
      return { ...state, resendAt: action.until };
    case "locked":
      return { ...state, lock: action.lock, codeExpiresAt: null, setupToken: null };
    case "expired":
      return { ...state, codeExpiresAt: null };
    case "verified":
      // A code works once: it is spent now, whatever its clock said.
      return { ...state, setupToken: action.setupToken, codeExpiresAt: null };
    case "restart":
      return { ...initialFlow(state.purpose), eid: state.eid };
  }
}

/**
 * Whether a step has what it needs. Step 2 needs a code to have gone out, step 3 the receipt
 * for it; a step reached any other way (a deep link, a reload on the web) starts over.
 */
export function canEnter(flow: SetupFlow, step: 1 | 2 | 3): boolean {
  if (step === 1) return true;
  if (step === 2) return flow.maskedPhone !== null || flow.setupToken !== null;
  return flow.setupToken !== null;
}

/**
 * Step 1 asked for a code and the API said one went out moments ago (`resend_too_soon`). If
 * it went to this EID in this flow, that code is still good (or already checked), so step 2
 * carries on with it rather than stopping the person with a wait: the usual way here is
 * Back from step 2 and Continue again.
 */
export function codeOnItsWay(flow: SetupFlow, eid: string, purpose: Purpose): boolean {
  return flow.eid === eid && flow.purpose === purpose && canEnter(flow, 2) && flow.lock === null;
}

/**
 * What a failed step changes in the flow, beyond its message: a lock, a wait before the next
 * code, a code that has run out. Null when it changes nothing, and the message is all there
 * is. Step 2 shows these from the flow itself, so it does not say them twice.
 */
export function flowActionFor(problem: Problem): FlowAction | null {
  switch (problem.code) {
    case "code_locked":
      return { type: "locked", lock: problem };
    case "resend_too_soon":
      return problem.until === undefined ? null : { type: "wait", until: problem.until };
    case "code_expired":
      return { type: "expired" };
    default:
      return null;
  }
}
