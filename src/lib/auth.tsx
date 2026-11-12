import type { Schemas } from "@crewstars/api-client";
import { isLocale, type Locale, type Translator } from "@crewstars/i18n";
import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { api, onSessionEnded } from "@/lib/api";
import { ApiError } from "@/lib/apiError";
import { keepsSession } from "@/lib/errors";
import { deviceLocale, translatorFor } from "@/lib/i18n";
import {
  clearTokens,
  loadLocale,
  loadPushToken,
  loadSession,
  saveLocale,
  savePushToken,
  saveTokens,
} from "@/lib/session";
import storage from "@/lib/storage";

/** `GET /me`: who is signed in, their role (which picks the tab group) and capabilities. */
export type MeOut = Schemas["MeOut"];

/** What every sign-in step ends with (`/auth/login`, `/auth/setup/complete`): the tokens,
 *  and `user`, so the app knows who this is without asking `/me` again. */
export type TokenOut = Schemas["TokenOut"];

/** `PATCH /me/preferences`: only the fields sent change. */
export type Preferences = Schemas["PreferencesIn"];

export type Role = MeOut["role"];

/** Something the server lets this person do (`approve_rewards`, `hide_posts`...). The API
 *  sends the list with `/me`, so screens never work it out from the role. */
export type Capability = string;

interface AuthValue {
  ready: boolean;
  me: MeOut | null;
  /**
   * The server could not be reached when the session was read, so `me` is the profile this
   * phone last saw (or null, when it never saw one). The session is kept; screens that need
   * data say they are offline and offer a retry, and the next answer brings `me` up to date.
   */
  offline: boolean;
  t: Translator;
  locale: Locale;
  /** The English / Español switch, on this device only. Remembered here; the profile's
   *  language is the default, and the phone's language before anyone signs in. */
  setLocale: (locale: Locale) => Promise<void>;
  /** Save to the profile (`PATCH /me/preferences`) and take the answer as the new `me`.
   *  Throws when it could not be saved. */
  savePreferences: (changes: Preferences) => Promise<void>;
  reload: () => Promise<void>;
  /** Store the tokens from any sign-in step; the route gates then take the person to their
   *  tabs. Throws `owner_use_portal` for an owner's tokens, which are not stored (CR-08). */
  signedIn: (tokens: TokenOut) => Promise<void>;
  /** End the session here and on the server. */
  signOut: () => Promise<void>;
  can: (capability: Capability) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Owners use the web portal (CR-08). The API never signs one in here, but `/me` would
 *  describe one if an owner's token ever reached the app, so the app checks too. */
function appUser(me: MeOut): boolean {
  return me.holder === "person" && me.role !== "owner";
}

const LAST_ME = "cs_me";

/**
 * The last `/me` the server gave, so opening the app with no connection lands on the person's
 * own tabs rather than the welcome screen. Profile details, not credentials, so it sits in the
 * app's own storage rather than the keychain; it goes at sign-out and when the server ends the
 * session.
 */
async function rememberMe(me: MeOut | null): Promise<void> {
  try {
    if (me) await storage.setItem(LAST_ME, JSON.stringify(me));
    else await storage.removeItem(LAST_ME);
  } catch {
    // Only an offline launch misses it.
  }
}

async function lastMe(): Promise<MeOut | null> {
  try {
    const saved = await storage.getItem(LAST_ME);
    const me = saved ? (JSON.parse(saved) as MeOut) : null;
    return me && typeof me.id === "string" && typeof me.role === "string" && appUser(me) ? me : null;
  } catch {
    return null;
  }
}

interface Restored {
  me: MeOut | null;
  offline: boolean;
}

/**
 * Who is signed in, if anyone. Only the server saying who this isn't signs the person out
 * (a 401 once the refresh token is refused, or a 403); no connection or a server fault keeps
 * the session, with the last profile seen (errors.ts `keepsSession`).
 */
async function whoIsThis(): Promise<Restored> {
  const session = await loadSession();
  if (!session.accessToken) return { me: null, offline: false };
  try {
    const me = await api<MeOut>("/me");
    if (appUser(me)) {
      // Not awaited: the launch never waits on a write.
      void rememberMe(me);
      return { me, offline: false };
    }
    await clearTokens();
  } catch (err) {
    if (keepsSession(err)) return { me: await lastMe(), offline: true };
  }
  await rememberMe(null);
  return { me: null, offline: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<MeOut | null>(null);
  const [offline, setOffline] = useState(false);
  const [override, setOverride] = useState<Locale | null>(null);
  // Two quick taps on the language switch send two saves; only the last one's answer counts.
  // Signing out counts as a newer answer, so a save still on its way cannot bring `me` back.
  const savesSent = useRef(0);
  // Every sign-in and sign-out, so a session read still on its way can't undo one.
  const turns = useRef(0);

  const reload = useCallback(async () => {
    const turn = turns.current;
    const restored = await whoIsThis();
    if (turn !== turns.current) return;
    // Still unreachable: whoever is on screen stays, rather than the saved copy.
    setMe((current) => (restored.offline ? (current ?? restored.me) : restored.me));
    setOffline(restored.offline);
    setReady(true);
  }, []);

  useEffect(() => {
    // Inlined rather than calling reload(), so no state is set while the effect body runs.
    let active = true;
    void (async () => {
      const [loaded, chosen] = await Promise.all([whoIsThis(), loadLocale()]);
      if (!active) return;
      setOverride(isLocale(chosen) ? chosen : null);
      setMe(loaded.me);
      setOffline(loaded.offline);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Opened offline: try again each time the app comes back to the foreground.
  useEffect(() => {
    if (!offline) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void reload();
    });
    return () => subscription.remove();
  }, [offline, reload]);

  // The server refused to renew the session (revoked, expired, or the person was terminated).
  // Forget who this was, and the route gates take the person back to the welcome screen.
  useEffect(
    () =>
      onSessionEnded(() => {
        savesSent.current += 1;
        turns.current += 1;
        setMe(null);
        setOffline(false);
        void rememberMe(null);
        void savePushToken(null);
      }),
    [],
  );

  // Precedence: the switch on this device, then the profile's language, then the phone's.
  const profile = me?.language;
  const locale: Locale = override ?? (isLocale(profile) ? profile : deviceLocale());

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      me,
      offline,
      t: translatorFor(locale),
      locale,
      setLocale: async (next: Locale) => {
        setOverride(next);
        await saveLocale(next);
      },
      savePreferences: async (changes) => {
        const sent = ++savesSent.current;
        const updated = await api<MeOut>("/me/preferences", { method: "PATCH", body: changes });
        if (sent !== savesSent.current) return;
        setMe(updated);
        void rememberMe(updated);
      },
      reload,
      signedIn: async (tokens) => {
        if (!appUser(tokens.user)) throw new ApiError(403, "owner_use_portal", "owners use the web portal");
        await saveTokens(tokens.access_token, tokens.refresh_token ?? null);
        turns.current += 1;
        // Signing in hands the language back to the profile.
        setOverride(null);
        await saveLocale(null);
        // The sign-in answer already says who this is; asking /me again would only add a
        // round trip that could fail after the tokens were saved.
        setMe(tokens.user);
        setOffline(false);
        setReady(true);
        void rememberMe(tokens.user);
      },
      signOut: async () => {
        const [{ refreshToken }, pushToken] = await Promise.all([loadSession(), loadPushToken()]);
        if (refreshToken) {
          try {
            // The server revokes the refresh token's whole family, so the session really ends,
            // and stops pushing to this phone (plan D10). Anonymous, because a lapsed access
            // token would otherwise be renewed first, spending the very token being revoked;
            // the refresh token alone says whose phone it was.
            await api("/auth/logout", {
              method: "POST",
              body: pushToken ? { refresh_token: refreshToken, push_token: pushToken } : { refresh_token: refreshToken },
              anonymous: true,
            });
          } catch {
            // Signing out locally matters more than telling the server about it.
          }
        }
        await Promise.all([clearTokens(), savePushToken(null), rememberMe(null)]);
        savesSent.current += 1;
        turns.current += 1;
        setMe(null);
        setOffline(false);
      },
      can: (capability) => (me?.capabilities ?? []).includes(capability),
    }),
    [ready, me, offline, locale, reload],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthValue {
  const value = use(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

/** The tab group a signed-in person belongs to: GMs get the manager tabs, everyone else the
 *  crew tabs (CR-08, plan §8). */
export function homeGroupFor(me: Pick<MeOut, "role">): "manager" | "crew" {
  return me.role === "gm" ? "manager" : "crew";
}
