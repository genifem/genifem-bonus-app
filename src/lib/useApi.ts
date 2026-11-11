import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { api, ApiError } from "@/lib/api";

interface State<T> {
  data: T | null;
  error: ApiError | null;
  /** True until the first answer for this path, and again when the path changes. */
  loading: boolean;
  /** True only while a pull-to-refresh the person started is running. */
  refreshing: boolean;
  /** Fetch again and show it (a Retry button): loading goes true. */
  reload: () => Promise<void>;
  /** Pull-to-refresh: the spinner shows for this and nothing else. */
  refresh: () => Promise<void>;
  /** Fetch again quietly, keeping what is on screen until the answer arrives (coming back to
   *  a tab). No spinner, no skeleton. */
  revalidate: () => Promise<void>;
}

/** Fetch once, with a pull-to-refresh style reload. Small on purpose: the screens here are
 *  simple, and a cache library would be more machinery than they need. */
export function useApi<T>(path: string | null): State<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [current, setCurrent] = useState(path);
  // A new path (a search, another store) is loading even while the last answer is still on
  // screen, so a screen can say so rather than presenting stale rows as the result.
  if (current !== path) {
    setCurrent(path);
    setLoading(true);
  }

  const fetchNow = useCallback(async () => {
    if (!path) return;
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "generic", "failed"));
    }
  }, [path]);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    await fetchNow();
    setLoading(false);
  }, [path, fetchNow]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNow();
    setRefreshing(false);
  }, [fetchNow]);

  useEffect(() => {
    // The fetch is inlined rather than calling reload(), so nothing sets state
    // synchronously while the effect runs.
    if (!path) return;
    let active = true;
    void (async () => {
      try {
        const result = await api<T>(path);
        if (active) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof ApiError ? err : new ApiError(0, "generic", "failed"));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [path]);

  return { data, error, loading, refreshing, reload, refresh, revalidate: fetchNow };
}

/**
 * Tab screens stay mounted, so coming back to one after giving coins would show the old
 * numbers. This refetches whenever the screen comes back into view (not on its first show,
 * which useApi has already fetched). Pass `revalidate`, so it happens without a spinner.
 */
export function useRefreshOnFocus(reload: () => Promise<void>) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void reload();
    }, [reload]),
  );
}
