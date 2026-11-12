/**
 * The heart on a post, kept optimistic (plan D11: likes may retry silently).
 *
 * A tap shows at once. The request behind it goes in the background, one at a time per post;
 * if the person taps again while one is on its way, the next request goes once the first
 * answers, so the server ends on whatever the heart last showed, however fast the taps. A
 * request that fails (after its silent retry) puts the heart back to what the server last
 * said.
 *
 * Pure, so the order of events can be tested without a network; useLikes.ts drives it.
 */

export interface Like {
  liked: boolean;
  count: number;
}

export interface LikeState {
  /** What the heart shows: the person's latest wish, with the count it implies. */
  shown: Like;
  /** What the server last said. */
  confirmed: Like;
  /** A request is on its way. */
  sending: boolean;
}

export type LikeEvent =
  | { type: "tap" }
  | { type: "sent" }
  | { type: "answer"; server: Like }
  | { type: "failed" };

export function likeFrom(post: { liked: boolean; like_count: number }): LikeState {
  const like = { liked: post.liked, count: Math.max(0, post.like_count) };
  return { shown: like, confirmed: like, sending: false };
}

/** `count` moved by one in the direction of `liked`, never below zero. */
function nudged(count: number, liked: boolean): number {
  return Math.max(0, count + (liked ? 1 : -1));
}

export function reduceLike(state: LikeState, event: LikeEvent): LikeState {
  switch (event.type) {
    case "tap": {
      const liked = !state.shown.liked;
      return { ...state, shown: { liked, count: nudged(state.shown.count, liked) } };
    }
    case "sent":
      return { ...state, sending: true };
    case "answer": {
      const confirmed = { liked: event.server.liked, count: Math.max(0, event.server.count) };
      // Tapped again while this was on its way: keep showing the newer wish, counted from
      // the server's fresh total (other people like posts too).
      const shown =
        state.shown.liked === confirmed.liked
          ? confirmed
          : { liked: state.shown.liked, count: nudged(confirmed.count, state.shown.liked) };
      return { shown, confirmed, sending: false };
    }
    case "failed":
      return { shown: state.confirmed, confirmed: state.confirmed, sending: false };
  }
}

/** The like to send next (true to like, false to unlike), or null when nothing needs sending:
 *  one is already on its way, or the heart matches the server. */
export function pendingLike(state: LikeState): boolean | null {
  if (state.sending) return null;
  return state.shown.liked === state.confirmed.liked ? null : state.shown.liked;
}
