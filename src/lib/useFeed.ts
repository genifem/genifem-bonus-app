import { useCallback, useEffect, useRef, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { appendPage, type CursorPage, type Feed, mergeFirstPage, pagePath } from "@/lib/pages";

export const PAGE_SIZE = 20;

const EMPTY: Feed<never> = { items: [], next: null };

function asApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError(0, "generic", "failed");
}

export interface FeedState<T> {
  items: T[];
  /** More, older rows exist. */
  hasMore: boolean;
  /** True until the first page for this path has answered. */
  loading: boolean;
  /** Only while a pull-to-refresh the person started is running. */
  refreshing: boolean;
  loadingMore: boolean;
  /** The first page failed (or the last pull-to-refresh did). */
  error: ApiError | null;
  /** The last older page failed; the list stays, with a way to try again. */
  moreError: ApiError | null;
  /** Fetch the first page again with the loading state (a Retry button). */
  reload: () => Promise<void>;
  /** Pull-to-refresh: the first page replaces the list. */
  refresh: () => Promise<void>;
  /** Quietly lay a fresh first page over the list (coming back to the screen). */
  revalidate: () => Promise<void>;
  /** The next, older page, once at a time. */
  loadMore: () => Promise<void>;
  /** Take a row out (a post just hidden). */
  remove: (id: string) => void;
}

/**
 * A newest-first list read a page at a time (`before=` cursors): the wall, notifications.
 * A FlatList shows it (plan §8: a flat list and pages of 20 for low-end Android).
 *
 * Answers that arrive after the path changed (Everyone to For you) are dropped, so one tab's
 * rows never land in the other.
 */
export function useFeed<T extends { id: string }>(path: string, limit = PAGE_SIZE): FeedState<T> {
  const [feed, setFeed] = useState<Feed<T>>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [moreError, setMoreError] = useState<ApiError | null>(null);
  const [current, setCurrent] = useState(path);
  const generation = useRef(0);
  const fetchingMore = useRef(false);

  if (current !== path) {
    setCurrent(path);
    setFeed(EMPTY);
    setLoading(true);
    setError(null);
    setMoreError(null);
  }

  const firstPage = useCallback(() => api<CursorPage<T>>(pagePath(path, null, limit)), [path, limit]);

  useEffect(() => {
    const ours = ++generation.current;
    void (async () => {
      try {
        const page = await firstPage();
        if (ours !== generation.current) return;
        setFeed({ items: page.items, next: page.next_before });
        setError(null);
      } catch (err) {
        if (ours === generation.current) setError(asApiError(err));
      } finally {
        if (ours === generation.current) setLoading(false);
      }
    })();
  }, [firstPage]);

  const replace = useCallback(
    async (show: (on: boolean) => void) => {
      const ours = generation.current;
      show(true);
      try {
        const page = await firstPage();
        if (ours !== generation.current) return;
        setFeed({ items: page.items, next: page.next_before });
        setError(null);
        setMoreError(null);
      } catch (err) {
        if (ours === generation.current) setError(asApiError(err));
      } finally {
        if (ours === generation.current) show(false);
      }
    },
    [firstPage],
  );

  const reload = useCallback(() => replace(setLoading), [replace]);
  const refresh = useCallback(() => replace(setRefreshing), [replace]);

  const revalidate = useCallback(async () => {
    const ours = generation.current;
    try {
      const page = await firstPage();
      if (ours !== generation.current) return;
      setFeed((loaded) => mergeFirstPage(loaded, page));
      setError(null);
    } catch {
      // Quiet by design: what is on screen stays, and pull-to-refresh is there to ask again.
    }
  }, [firstPage]);

  const next = feed.next;
  const loadMore = useCallback(async () => {
    if (!next || fetchingMore.current) return;
    const ours = generation.current;
    fetchingMore.current = true;
    setLoadingMore(true);
    try {
      const page = await api<CursorPage<T>>(pagePath(path, next, limit));
      if (ours !== generation.current) return;
      setFeed((loaded) => appendPage(loaded, page));
      setMoreError(null);
    } catch (err) {
      if (ours === generation.current) setMoreError(asApiError(err));
    } finally {
      fetchingMore.current = false;
      setLoadingMore(false);
    }
  }, [next, path, limit]);

  const remove = useCallback((id: string) => {
    setFeed((loaded) => ({ ...loaded, items: loaded.items.filter((item) => item.id !== id) }));
  }, []);

  return {
    items: feed.items,
    hasMore: feed.next !== null,
    loading,
    refreshing,
    loadingMore,
    error,
    moreError,
    reload,
    refresh,
    revalidate,
    loadMore,
    remove,
  };
}
