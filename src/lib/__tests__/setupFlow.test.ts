/**
 * The state the three setup steps share (CR-03 to CR-06): which step can be entered, what a
 * new code, a wait, a lock or a right code changes, and that "Start again" keeps only the EID.
 */
import type { Problem } from "@/lib/errors";
import {
  canEnter,
  codeOnItsWay,
  type FlowAction,
  flowActionFor,
  flowReducer,
  initialFlow,
  type SetupFlow,
} from "@/lib/setupFlow";

const NOW = 1_000_000;

function sent(over: Partial<Extract<FlowAction, { type: "sent" }>> = {}): FlowAction {
  return {
    type: "sent",
    eid: "2741001",
    purpose: "setup",
    expiresInS: 600,
    resendAfterS: 30,
    now: NOW,
    ...over,
  };
}

function run(...actions: FlowAction[]): SetupFlow {
  return actions.reduce(flowReducer, initialFlow());
}

const lock: Problem = {
  code: "code_locked",
  key: "errors.code_locked",
  until: NOW + 15 * 60_000,
  values: { seconds: 900, minutes: 15 },
};

describe("a code going out", () => {
  it("marks a code as asked for and works out the deadlines on this phone's clock", () => {
    const flow = run(sent());
    expect(flow).toEqual({
      purpose: "setup",
      eid: "2741001",
      codeRequested: true,
      codeExpiresAt: NOW + 600_000,
      resendAt: NOW + 30_000,
      lock: null,
      setupToken: null,
    });
  });

  it("remembers that this is a password reset, for the titles (CR-06)", () => {
    expect(run(sent({ purpose: "reset" })).purpose).toBe("reset");
  });

  it("voids whatever an earlier code had reached: a resend has to be checked again", () => {
    const flow = run(sent(), { type: "verified", setupToken: "receipt" }, sent({ now: NOW + 60_000 }));
    expect(flow.setupToken).toBeNull();
    expect(flow.codeExpiresAt).toBe(NOW + 60_000 + 600_000);
    expect(flow.resendAt).toBe(NOW + 60_000 + 30_000);
  });

  it("moves the resend countdown when the API asks for a longer wait", () => {
    expect(run(sent(), { type: "wait", until: NOW + 45_000 }).resendAt).toBe(NOW + 45_000);
  });
});

describe("checking the code", () => {
  it("keeps the receipt in memory and spends the code", () => {
    const flow = run(sent(), { type: "verified", setupToken: "receipt" });
    expect(flow.setupToken).toBe("receipt");
    expect(flow.codeExpiresAt).toBeNull();
    expect(flow.codeRequested).toBe(true);
  });

  it("forgets the code when the API says it has run out", () => {
    const flow = run(sent(), { type: "expired" });
    expect(flow.codeExpiresAt).toBeNull();
    expect(flow.codeRequested).toBe(true);
  });

  it("locks after the fifth wrong code, and the code is gone with it (CR-04)", () => {
    const flow = run(sent(), { type: "locked", lock });
    expect(flow.lock).toBe(lock);
    expect(flow.codeExpiresAt).toBeNull();
    expect(flow.setupToken).toBeNull();
  });

  it("lifts the lock once a new code goes out", () => {
    expect(run(sent(), { type: "locked", lock }, sent({ now: NOW + 16 * 60_000 })).lock).toBeNull();
  });
});

describe("starting again", () => {
  it("keeps the EID and the purpose, and drops everything else", () => {
    const flow = run(sent({ purpose: "reset" }), { type: "verified", setupToken: "receipt" }, { type: "restart" });
    expect(flow).toEqual({ ...initialFlow("reset"), eid: "2741001" });
  });
});

describe("which steps can be entered", () => {
  it("lets anyone in at step 1, and step 2 only once a code has gone out", () => {
    const fresh = initialFlow();
    expect(canEnter(fresh, 1)).toBe(true);
    expect(canEnter(fresh, 2)).toBe(false);
    expect(canEnter(run(sent()), 2)).toBe(true);
  });

  it("lets step 3 in only with the receipt", () => {
    expect(canEnter(run(sent()), 3)).toBe(false);
    expect(canEnter(run(sent(), { type: "verified", setupToken: "receipt" }), 3)).toBe(true);
    expect(canEnter(run(sent(), { type: "verified", setupToken: "receipt" }, { type: "restart" }), 3)).toBe(false);
  });
});

describe("Back to step 1 and Continue again within 30 seconds", () => {
  it("carries on with the code already sent to the same EID", () => {
    const flow = run(sent());
    expect(codeOnItsWay(flow, "2741001", "setup")).toBe(true);
    expect(codeOnItsWay(run(sent(), { type: "verified", setupToken: "receipt" }), "2741001", "setup")).toBe(true);
  });

  it("does not for another EID, another purpose, a fresh flow or a locked one", () => {
    const flow = run(sent());
    expect(codeOnItsWay(flow, "2741002", "setup")).toBe(false);
    expect(codeOnItsWay(flow, "2741001", "reset")).toBe(false);
    expect(codeOnItsWay(initialFlow(), "", "setup")).toBe(false);
    expect(codeOnItsWay(run(sent(), { type: "locked", lock }), "2741001", "setup")).toBe(false);
  });
});

describe("what a failed step changes in the flow", () => {
  it("turns a lock, a wait and an expired code into flow changes", () => {
    expect(flowActionFor(lock)).toEqual({ type: "locked", lock });
    expect(
      flowActionFor({ code: "resend_too_soon", key: "errors.resend_too_soon", until: NOW + 9_000 }),
    ).toEqual({ type: "wait", until: NOW + 9_000 });
    expect(flowActionFor({ code: "code_expired", key: "errors.code_expired" })).toEqual({ type: "expired" });
  });

  it("leaves everything else to the message alone", () => {
    expect(flowActionFor({ code: "code_invalid", key: "errors.code_invalid_left", values: { count: 2 } })).toBeNull();
    expect(flowActionFor({ code: "network", key: "errors.network" })).toBeNull();
    expect(flowActionFor({ code: "sms_failed", key: "errors.sms_failed" })).toBeNull();
  });
});
