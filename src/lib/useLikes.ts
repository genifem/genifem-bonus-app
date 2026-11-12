import type { Schemas } from "@crewstars/api-client";
import { useCallback, useEffect, useRef, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { type Like, likeFrom, type LikeEvent, type LikeState, pendingLike, reduceLike } from "@/lib/likes";

type LikeOut = Schemas["LikeOut"];

interface Likeable {
  id: string;
  liked: boolean;
  like_count: number;
}

/** How long to wait before the one silent retry. */
const RETRY_MS = 800;

function request(id: string, liked: boolean): Promise<LikeOut> {
  return api<LikeOut>(`/shoutouts/${encodeURIComponent(id)}/like`, { method: liked ? "PUT" : "DELETE" });
}

/** A refusal (the post was hidden, say) will not change on a retry; anything else might. */
function worthRetrying(err: unknown): boolean {
  return !(err instanceof ApiError) || err.status === 0 || err.status === 408 || err.status === 429 || err.status >= 500;
}

/**
 * Like and unlike are idempotent on the server (PUT / DELETE), so a request that may or may
 * not have landed is simply sent again once (plan D11). Null when it still did not work.
 */
async function sendLike(id: string, liked: boolean): Promise<LikeOut | null> {
  try {
    return await request(id, liked);
  } catch (err) {
    if (!worthRetrying(err)) return null;
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    try {
      return await request(id, liked);
    } catch {
      return null;
    }
  }
}

/**
 * Hearts on a list of posts (CR-17), optimistic (see likes.ts for the rules). `view` is what a
 * post's heart shows now. `onSettled` runs whenever a post's requests are all answered, so
 * the summary can be refreshed after the mutation (plan D12); `onFailed` when a like had to
 * be put back.
 */
export function useLikes({ onSettled, onFailed }: { onSettled?: () => void; onFailed?: () => void } = {}) {
  const [states, setStates] = useState<Record<string, LikeState>>({});
  // The same states, readable from the request loop between renders.
  const latest = useRef<Record<string, LikeState>>({});
  const callbacks = useRef({ onSettled, onFailed });
  useEffect(() => {
    callbacks.current = { onSettled, onFailed };
  });

  const apply = useCallback((id: string, base: LikeState, event: LikeEvent): LikeState => {
    const next = reduceLike(latest.current[id] ?? base, event);
    latest.current = { ...latest.current, [id]: next };
    setStates(latest.current);
    return next;
  }, []);

  const sync = useCallback(
    async (id: string, base: LikeState) => {
      for (;;) {
        const want = pendingLike(latest.current[id] ?? base);
        if (want === null) break;
        apply(id, base, { type: "sent" });
        const answer = await sendLike(id, want);
        if (!answer) {
          apply(id, base, { type: "failed" });
          callbacks.current.onFailed?.();
          break;
        }
        apply(id, base, { type: "answer", server: { liked: answer.liked, count: answer.like_count } });
      }
      callbacks.current.onSettled?.();
    },
    [apply],
  );

  const toggle = useCallback(
    (post: Likeable) => {
      const base = likeFrom(post);
      const state = apply(post.id, base, { type: "tap" });
      // A request already on its way picks the new wish up when it answers.
      if (!state.sending) void sync(post.id, base);
    },
    [apply, sync],
  );

  const view = useCallback(
    (post: Likeable): Like => states[post.id]?.shown ?? { liked: post.liked, count: Math.max(0, post.like_count) },
    [states],
  );

  /** Fresh rows have arrived: they know better than any like that has settled. */
  const forgetSettled = useCallback(() => {
    const kept = Object.fromEntries(
      Object.entries(latest.current).filter(([, state]) => state.sending || pendingLike(state) !== null),
    );
    latest.current = kept;
    setStates(kept);
  }, []);

  return { view, toggle, forgetSettled };
}
