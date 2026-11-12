/**
 * The GM's Approvals, optimistic (MG-05 to MG-07): a row goes at once, lands where the
 * server's answer puts it, and comes back if the server says no.
 */
import {
  alreadySettled,
  type ApprovalsEvent,
  type ApprovalsState,
  initialApprovals,
  inOrder,
  type Queues,
  RECENT_MAX,
  reduceApprovals,
  type RequestRow,
} from "@/lib/approvals";

function request(id: string, minute: number, changes: Partial<RequestRow> = {}): RequestRow {
  return {
    id,
    person: { id: `p-${id}`, name: `Person ${id}`, first_name: "Person", initials: "P", role: "crew", store: null },
    store: null,
    reward_id: "r1",
    source: "catalog",
    name: "Meal on us",
    name_es: null,
    icon: "burger",
    cost: 100,
    status: "pending",
    approver: "gm",
    created_at: new Date(Date.UTC(2026, 10, 12, 9, minute)).toISOString(),
    decided_by: null,
    decided_at: null,
    collected_at: null,
    ...changes,
  };
}

function run(state: ApprovalsState, ...events: ApprovalsEvent[]): ApprovalsState {
  return events.reduce(reduceApprovals, state);
}

const ids = (rows: readonly RequestRow[] | undefined) => (rows ?? []).map((row) => row.id);

const a = request("a", 1);
const b = request("b", 2);
const c = request("c", 3);
const readyD = request("d", 0, { status: "approved" });
const recentE = request("e", 0, { status: "declined" });

const queues: Queues = { pending: [a, b, c], ready: [readyD], recent: [recentE] };
const loaded = run(initialApprovals, { type: "loaded", queues });

describe("approving", () => {
  it("takes the row off the pending list at once", () => {
    const state = run(loaded, { type: "start", id: "b", decision: "approve" });
    expect(ids(state.queues?.pending)).toEqual(["a", "c"]);
    expect(state.inFlight.b?.decision).toBe("approve");
  });

  it("moves it to Ready to collect, oldest first, and tops the recent list when the server agrees", () => {
    const state = run(
      loaded,
      { type: "start", id: "b", decision: "approve" },
      { type: "done", id: "b", row: { ...b, status: "approved" } },
    );
    expect(ids(state.queues?.pending)).toEqual(["a", "c"]);
    expect(ids(state.queues?.ready)).toEqual(["d", "b"]);
    expect(ids(state.queues?.recent)).toEqual(["b", "e"]);
    expect(state.inFlight).toEqual({});
  });

  it("puts it back where it was, oldest first, when the server says no", () => {
    const state = run(loaded, { type: "start", id: "b", decision: "approve" }, { type: "failed", id: "b" });
    expect(ids(state.queues?.pending)).toEqual(["a", "b", "c"]);
    expect(state.inFlight).toEqual({});
  });

  it("puts a failed row back among rows that changed meanwhile", () => {
    const state = run(
      loaded,
      { type: "start", id: "b", decision: "approve" },
      { type: "start", id: "a", decision: "approve" },
      { type: "done", id: "a", row: { ...a, status: "approved" } },
      { type: "failed", id: "b" },
    );
    expect(ids(state.queues?.pending)).toEqual(["b", "c"]);
  });

  it("ignores a second tap on a row that is already on its way", () => {
    const once = run(loaded, { type: "start", id: "b", decision: "approve" });
    expect(reduceApprovals(once, { type: "start", id: "b", decision: "decline" })).toBe(once);
  });

  it("ignores a tap on a row that isn't there", () => {
    expect(reduceApprovals(loaded, { type: "start", id: "zz", decision: "approve" })).toBe(loaded);
    expect(reduceApprovals(initialApprovals, { type: "start", id: "a", decision: "approve" })).toBe(initialApprovals);
  });
});

describe("declining", () => {
  it("drops the row and puts the decision on top of the recent list", () => {
    const state = run(
      loaded,
      { type: "start", id: "a", decision: "decline" },
      { type: "done", id: "a", row: { ...a, status: "declined" } },
    );
    expect(ids(state.queues?.pending)).toEqual(["b", "c"]);
    expect(ids(state.queues?.ready)).toEqual(["d"]);
    expect(ids(state.queues?.recent)).toEqual(["a", "e"]);
  });

  it("keeps only the last five decisions", () => {
    const many = Array.from({ length: RECENT_MAX }, (_, index) => request(`r${index}`, 0, { status: "approved" }));
    const state = run(
      initialApprovals,
      { type: "loaded", queues: { pending: [a], ready: [], recent: many } },
      { type: "start", id: "a", decision: "decline" },
      { type: "done", id: "a", row: { ...a, status: "declined" } },
    );
    expect(state.queues?.recent).toHaveLength(RECENT_MAX);
    expect(ids(state.queues?.recent)[0]).toBe("a");
    expect(ids(state.queues?.recent)).not.toContain(`r${RECENT_MAX - 1}`);
  });
});

describe("marking collected (plan G5)", () => {
  it("takes the row off Ready to collect and leaves the decisions' order alone", () => {
    const withRecent = run(initialApprovals, {
      type: "loaded",
      queues: { pending: [], ready: [readyD], recent: [recentE, readyD] },
    });
    const state = run(
      withRecent,
      { type: "start", id: "d", decision: "collect" },
      { type: "done", id: "d", row: { ...readyD, status: "collected" } },
    );
    expect(state.queues?.ready).toEqual([]);
    expect(ids(state.queues?.recent)).toEqual(["e", "d"]);
    expect(state.queues?.recent[1]?.status).toBe("collected");
  });

  it("puts it back on Ready to collect if that fails", () => {
    const state = run(loaded, { type: "start", id: "d", decision: "collect" }, { type: "failed", id: "d" });
    expect(ids(state.queues?.ready)).toEqual(["d"]);
  });
});

describe("someone else got there first", () => {
  it("leaves a row decided elsewhere off the list", () => {
    const state = run(loaded, { type: "start", id: "c", decision: "approve" }, { type: "gone", id: "c" });
    expect(ids(state.queues?.pending)).toEqual(["a", "b"]);
    expect(state.inFlight).toEqual({});
  });

  it("knows which refusals mean the request has moved on", () => {
    expect(alreadySettled("request_not_pending")).toBe(true);
    expect(alreadySettled("request_not_approved")).toBe(true);
    expect(alreadySettled("request_not_found")).toBe(true);
    expect(alreadySettled("cannot_decide")).toBe(false);
    expect(alreadySettled("network")).toBe(false);
    expect(alreadySettled(undefined)).toBe(false);
  });
});

describe("a refresh while an action is on its way", () => {
  it("keeps the row off until the action answers", () => {
    const state = run(loaded, { type: "start", id: "a", decision: "approve" }, { type: "loaded", queues });
    expect(ids(state.queues?.pending)).toEqual(["b", "c"]);
    // And the failure still puts it back.
    expect(ids(reduceApprovals(state, { type: "failed", id: "a" }).queues?.pending)).toEqual(["a", "b", "c"]);
  });

  it("takes the server's lists as they are once nothing is on its way", () => {
    const state = run(loaded, { type: "loaded", queues: { pending: [c], ready: [], recent: [] } });
    expect(ids(state.queues?.pending)).toEqual(["c"]);
    expect(state.queues?.ready).toEqual([]);
  });
});

describe("inOrder", () => {
  it("places a row by when it was asked for, and never twice", () => {
    expect(ids(inOrder([a, c], b))).toEqual(["a", "b", "c"]);
    expect(ids(inOrder([b, c], a))).toEqual(["a", "b", "c"]);
    expect(ids(inOrder([a, b], c))).toEqual(["a", "b", "c"]);
    expect(ids(inOrder([a, b, c], b))).toEqual(["a", "b", "c"]);
    expect(ids(inOrder([], a))).toEqual(["a"]);
  });
});
