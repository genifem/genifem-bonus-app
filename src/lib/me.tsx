import type { Schemas } from "@crewstars/api-client";
import { useFocusEffect } from "expo-router";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** `GET /me/summary`: balance, lifetime, tier, kudos, this month, rank, spins, unread. */
export type Summary = Schemas["SummaryOut"];
export type Kudos = Schemas["KudosOut"];

interface MeValue {
  /** Null until the first answer, and after signing out. */
  summary: Summary | null;
  error: ApiError | null;
  /** Fetch again quietly: what is on screen stays until the answer arrives. */
  refresh: () => Promise<void>;
  /**
   * Put a number the API has just returned on screen at once (the kudos left after a send,
   * the unread count after read-all), ahead of the refresh that follows.
   */
  patch: (changes: Partial<Summary>) => void;
}

const MeContext = createContext<MeValue | null>(null);

function asApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError(0, "generic", "failed");
}

/**
 * The numbers every screen shows about the person (plan D12): one summary, refreshed when the
 * app comes back to the foreground, when a screen comes into view (useMeRefreshOnFocus), and
 * after every action that changes it (send, like, read-all). Owners change allowances and
 * thresholds from the portal, and the next screen load must show them (acceptance test 15),
 * which refreshing on focus does without a cache library.
 *
 * Answers can cross (a focus refresh and a post-send refresh); only the newest request's
 * answer is kept, and nothing from before a sign-out lands after it.
 *
 * With no connection the summary's error is the network one, and screens show their calm
 * offline state with a retry (ErrorState); the session itself is untouched (auth.tsx).
 */
export function MeProvider({ children }: { children: ReactNode }) {
  const { me, offline, reload } = useAuth();
  const personId = me?.id ?? null;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [owner, setOwner] = useState(personId);
  const asked = useRef(0);

  // Someone else signed in, or nobody is: the last person's numbers must not show.
  if (owner !== personId) {
    setOwner(personId);
    setSummary(null);
    setError(null);
  }

  const refresh = useCallback(async () => {
    if (!personId) return;
    const request = ++asked.current;
    try {
      const next = await api<Summary>("/me/summary");
      if (request !== asked.current) return;
      setSummary(next);
      setError(null);
    } catch (err) {
      if (request === asked.current) setError(asApiError(err));
    }
  }, [personId]);

  useEffect(() => {
    // Every sign-in, sign-out and switch of person starts a new generation, so an answer
    // still on its way for the last one is dropped. The first fetch is inlined so nothing
    // sets state while the effect body runs.
    const request = ++asked.current;
    if (!personId) return;
    void (async () => {
      try {
        const next = await api<Summary>("/me/summary");
        if (request !== asked.current) return;
        setSummary(next);
        setError(null);
      } catch (err) {
        if (request === asked.current) setError(asApiError(err));
      }
    })();
  }, [personId]);

  // The app opened offline on the profile it last saw (auth.tsx). The first summary to arrive
  // means the server can be reached again, so the profile is read again too.
  useEffect(() => {
    if (offline && summary) void reload();
  }, [offline, summary, reload]);

  // Back from the background: kudos may have reset at midnight, a shout-out may have landed.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const patch = useCallback((changes: Partial<Summary>) => {
    setSummary((current) => (current ? { ...current, ...changes } : current));
  }, []);

  const value = useMemo<MeValue>(() => ({ summary, error, refresh, patch }), [summary, error, refresh, patch]);
  return <MeContext value={value}>{children}</MeContext>;
}

export function useMe(): MeValue {
  const value = use(MeContext);
  if (!value) throw new Error("useMe must be used inside MeProvider");
  return value;
}

/**
 * Refresh the summary whenever the screen comes into view, so a tab that stayed mounted
 * shows today's numbers. The first view is skipped: the provider has just fetched.
 */
export function useMeRefreshOnFocus() {
  const { refresh } = useMe();
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void refresh();
    }, [refresh]),
  );
}
