import type { Schemas } from "@crewstars/api-client";

/**
 * The GM's Approvals (MG-05 to MG-07), kept optimistic: a tap on Approve, Decline or Mark
 * collected takes the request off its list at once, and the request behind it goes in the
 * background. The server's answer puts the row where it now belongs (approved ones wait to
 * be collected, and every decision tops the recent list); a refusal puts it back where it
 * was. A request someone else decided meanwhile (an owner, from the portal) just stays off.
 *
 * Pure, so the order of events can be tested without a network; the Approvals screen
 * drives it.
 */

export type RequestRow = Schemas["RequestRow"];
export type Queues = Schemas["ManagerRequestsOut"];
export type Decision = "approve" | "decline" | "collect";

/** MG-07: the recent list holds the last five decisions. */
export const RECENT_MAX = 5;

/** The list each action takes a row from. */
const FROM: Record<Decision, "pending" | "ready"> = { approve: "pending", decline: "pending", collect: "ready" };

interface InFlight {
  decision: Decision;
  row: RequestRow;
}

export interface ApprovalsState {
  /** What the screen shows; null until the first answer. */
  queues: Queues | null;
  /** Rows taken off while their action is on its way, to put back if it fails. */
  inFlight: Record<string, InFlight>;
}

export type ApprovalsEvent =
  /** The lists arrived from the server. */
  | { type: "loaded"; queues: Queues }
  /** A tap: take the row off at once. */
  | { type: "start"; id: string; decision: Decision }
  /** The server did it, and this is the request now. */
  | { type: "done"; id: string; row: RequestRow }
  /** Already decided or gone (409 / 404): there is nothing to put back. */
  | { type: "gone"; id: string }
  /** Refused or never answered: put the row back. */
  | { type: "failed"; id: string };

export const initialApprovals: ApprovalsState = { queues: null, inFlight: {} };

function without(rows: readonly RequestRow[], id: string): RequestRow[] {
  return rows.filter((row) => row.id !== id);
}

function older(a: RequestRow, b: RequestRow): boolean {
  return a.created_at < b.created_at || (a.created_at === b.created_at && a.id < b.id);
}

/** `row` among `rows`, oldest first, as the server sorts both queues. */
export function inOrder(rows: readonly RequestRow[], row: RequestRow): RequestRow[] {
  const rest = without(rows, row.id);
  const at = rest.findIndex((other) => older(row, other));
  return at < 0 ? [...rest, row] : [...rest.slice(0, at), row, ...rest.slice(at)];
}

function settle(inFlight: Record<string, InFlight>, id: string): Record<string, InFlight> {
  const next = { ...inFlight };
  delete next[id];
  return next;
}

export function reduceApprovals(state: ApprovalsState, event: ApprovalsEvent): ApprovalsState {
  switch (event.type) {
    case "loaded": {
      // A refresh that lands while an action is on its way may still list that row: it
      // stays off until the action answers.
      const shown = (rows: readonly RequestRow[]) => rows.filter((row) => !(row.id in state.inFlight));
      const { pending, ready, recent } = event.queues;
      return { ...state, queues: { pending: shown(pending), ready: shown(ready), recent: recent.slice(0, RECENT_MAX) } };
    }
    case "start": {
      const queues = state.queues;
      if (!queues || state.inFlight[event.id]) return state;
      const from = FROM[event.decision];
      const row = queues[from].find((candidate) => candidate.id === event.id);
      if (!row) return state;
      return {
        queues: { ...queues, [from]: without(queues[from], event.id) },
        inFlight: { ...state.inFlight, [event.id]: { decision: event.decision, row } },
      };
    }
    case "done": {
      const flight = state.inFlight[event.id];
      const inFlight = settle(state.inFlight, event.id);
      if (!state.queues) return { ...state, inFlight };
      const { row } = event;
      const pending = without(state.queues.pending, row.id);
      let ready = without(state.queues.ready, row.id);
      if (row.status === "approved") ready = inOrder(ready, row);
      // Approving and declining are decisions, and the newest goes on top. Handing a reward
      // over isn't one: its line in the list just catches up.
      const recent =
        flight?.decision === "collect"
          ? state.queues.recent.map((other) => (other.id === row.id ? row : other))
          : [row, ...without(state.queues.recent, row.id)].slice(0, RECENT_MAX);
      return { queues: { pending, ready, recent }, inFlight };
    }
    case "gone":
      return state.inFlight[event.id] ? { ...state, inFlight: settle(state.inFlight, event.id) } : state;
    case "failed": {
      const flight = state.inFlight[event.id];
      if (!flight) return state;
      const inFlight = settle(state.inFlight, event.id);
      if (!state.queues) return { ...state, inFlight };
      const from = FROM[flight.decision];
      return { queues: { ...state.queues, [from]: inOrder(state.queues[from], flight.row) }, inFlight };
    }
  }
}

/** Whether an action failed because the request has moved on without this GM: decided by
 *  someone else, collected already, or gone. Nothing to put back then. */
export function alreadySettled(code: string | null | undefined): boolean {
  return code === "request_not_pending" || code === "request_not_approved" || code === "request_not_found";
}
