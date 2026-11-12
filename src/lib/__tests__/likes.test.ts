/**
 * The optimistic heart (CR-17, plan D11): it answers the finger at once, the server ends on
 * the last thing the heart showed however fast the taps, and a like that cannot be saved goes
 * back to what the server last said.
 */
import { type LikeEvent, likeFrom, type LikeState, pendingLike, reduceLike } from "@/lib/likes";

function run(state: LikeState, ...events: LikeEvent[]): LikeState {
  return events.reduce(reduceLike, state);
}

const answer = (liked: boolean, count: number): LikeEvent => ({ type: "answer", server: { liked, count } });

describe("a single tap", () => {
  it("shows the like at once and asks for it to be sent", () => {
    const state = run(likeFrom({ liked: false, like_count: 3 }), { type: "tap" });
    expect(state.shown).toEqual({ liked: true, count: 4 });
    expect(state.confirmed).toEqual({ liked: false, count: 3 });
    expect(pendingLike(state)).toBe(true);
  });

  it("takes the server's count when it answers (other people like posts too)", () => {
    const state = run(likeFrom({ liked: false, like_count: 3 }), { type: "tap" }, { type: "sent" }, answer(true, 7));
    expect(state.shown).toEqual({ liked: true, count: 7 });
    expect(state.sending).toBe(false);
    expect(pendingLike(state)).toBeNull();
  });

  it("unlikes the same way, never below zero", () => {
    const state = run(likeFrom({ liked: true, like_count: 0 }), { type: "tap" });
    expect(state.shown).toEqual({ liked: false, count: 0 });
    expect(pendingLike(state)).toBe(false);
  });
});

describe("taps while a request is on its way", () => {
  it("sends nothing more until the first answers", () => {
    const state = run(likeFrom({ liked: false, like_count: 1 }), { type: "tap" }, { type: "sent" }, { type: "tap" });
    expect(state.shown).toEqual({ liked: false, count: 1 });
    expect(pendingLike(state)).toBeNull();
  });

  it("then sends the newer wish, so the server ends where the heart is", () => {
    let state = run(likeFrom({ liked: false, like_count: 1 }), { type: "tap" }, { type: "sent" }, { type: "tap" });
    state = reduceLike(state, answer(true, 2));
    // Still showing the unlike the person asked for, counted from the server's total.
    expect(state.shown).toEqual({ liked: false, count: 1 });
    expect(pendingLike(state)).toBe(false);
    state = run(state, { type: "sent" }, answer(false, 1));
    expect(state.shown).toEqual({ liked: false, count: 1 });
    expect(pendingLike(state)).toBeNull();
  });

  it("sends nothing at all after an even number of taps answered in between", () => {
    const state = run(
      likeFrom({ liked: false, like_count: 5 }),
      { type: "tap" },
      { type: "sent" },
      { type: "tap" },
      { type: "tap" },
      answer(true, 6),
    );
    expect(state.shown).toEqual({ liked: true, count: 6 });
    expect(pendingLike(state)).toBeNull();
  });
});

describe("a failure", () => {
  it("puts the heart back to what the server last said", () => {
    const state = run(likeFrom({ liked: false, like_count: 3 }), { type: "tap" }, { type: "sent" }, { type: "failed" });
    expect(state.shown).toEqual({ liked: false, count: 3 });
    expect(state.sending).toBe(false);
    expect(pendingLike(state)).toBeNull();
  });

  it("rolls back to the last confirmed state, not the original one", () => {
    const state = run(
      likeFrom({ liked: false, like_count: 3 }),
      { type: "tap" },
      { type: "sent" },
      answer(true, 4),
      { type: "tap" },
      { type: "sent" },
      { type: "failed" },
    );
    expect(state.shown).toEqual({ liked: true, count: 4 });
  });
});
