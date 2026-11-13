import type { Schemas } from "@crewstars/api-client";
import { isLocale, type Locale, type Translator } from "@crewstars/i18n";
import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { api, onCompanyProblem, onSessionEnded } from "@/lib/api";
import { ApiError } from "@/lib/apiError";
import { keepsSession, tenantProblemOf } from "@/lib/errors";
import { homeGroupFor } from "@/lib/guards";
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
import { type Company, restoreCompany, saveCompany, setActiveCompany, tenantSlug } from "@/lib/tenant";

export { homeGroupFor };

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
  /** The company this phone is set up for (tenant.ts), or null until one is chosen: then the
   *  company screen is the only one there is. */
  company: Company | null;
  me: MeOut | null;
  /**
   * The server could not be reached when the session was read, so `me` is the profile this
   * phone last saw (or null, when it never saw one). The session is kept; screens that need
   * data say they are offline and offer a retry, and the next answer brings `me` up to date.
   */
  offline: boolean;
  /**
   * Signed in at a company the platform has paused (403 `tenant_suspended` from any call):
   * the paused screen covers the app, with sign-out, until a retry finds the company back.
   * The session is kept meanwhile; nothing about the person changed.
   */
  paused: boolean;
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
  /** End the session here and on the server. The company stays: the next person on this
   *  phone signs in at the same one. */
  signOut: () => Promise<void>;
  /** Keep the company the company screen confirmed (`GET /meta`) and name it on every request
   *  from now on; the guards then open the welcome screen. */
  chooseCompany: (company: Company) => Promise<void>;
  /**
   * "Not your company? Change": sign out first if someone is signed in, then forget the
   * company with everything this phone kept for it (profile, session, push token). The guards
   * then open the company screen.
   */
  changeCompany: () => Promise<void>;
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
 * app's own storage rather than the keychain; it goes at sign-out, when the server ends the
 * session, and with the company.
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

/** Everything this phone keeps about whoever was signed in: the session, the push token last
 *  handed to the API, and the cached profile. */
async function forgetPerson(): Promise<void> {
  await Promise.all([clearTokens(), savePushToken(null), rememberMe(null)]);
}

async function hasTokens(): Promise<boolean> {
  const { accessToken, refreshToken } = await loadSession();
  return !!(accessToken || refreshToken);
}

interface Restored {
  me: MeOut | null;
  offline: boolean;
  /** The company is paused: the session is kept, behind the paused screen. */
  paused: boolean;
  /** The company is gone (404 `tenant_not_found`): it goes, and the session with it. */
  gone: boolean;
}

const SIGNED_OUT: Restored = { me: null, offline: false, paused: false, gone: false };

/**
 * Who is signed in, if anyone. Only the server saying who this isn't signs the person out
 * (a 401 once the refresh token is refused, or a 403); no connection or a server fault keeps
 * the session, with the last profile seen (errors.ts `keepsSession`). What it says about the
 * company comes first: paused keeps the session behind the paused screen, gone ends it.
 */
async function whoIsThis(): Promise<Restored> {
  if (!tenantSlug()) return SIGNED_OUT;
  const session = await loadSession();
  if (!session.accessToken) return SIGNED_OUT;
  try {
    const me = await api<MeOut>("/me");
    if (appUser(me)) {
      // Not awaited: the launch never waits on a write.
      void rememberMe(me);
      return { ...SIGNED_OUT, me };
    }
    await clearTokens();
  } catch (err) {
    const company = tenantProblemOf(err);
    if (company === "gone") return { ...SIGNED_OUT, gone: true };
    if (company === "paused") return { ...SIGNED_OUT, me: await lastMe(), paused: true };
    if (keepsSession(err)) return { ...SIGNED_OUT, me: await lastMe(), offline: true };
  }
  await rememberMe(null);
  return SIGNED_OUT;
}

/** Whether what was read leaves someone signed in on this phone. */
function holdsSession(restored: Restored): boolean {
  return restored.me !== null || restored.offline || restored.paused;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [me, setMe] = useState<MeOut | null>(null);
  const [offline, setOffline] = useState(false);
  const [paused, setPaused] = useState(false);
  const [override, setOverride] = useState<Locale | null>(null);
  // Two quick taps on the language switch send two saves; only the last one's answer counts.
  // Signing out counts as a newer answer, so a save still on its way cannot bring `me` back.
  const savesSent = useRef(0);
  // Every sign-in, sign-out and change of company, so a session read still on its way can't
  // undo one.
  const turns = useRef(0);
  // Whether someone is signed in here right now, for a "paused" that arrives from any call:
  // only a session is paused; a sign-in that hears it says so on its own form.
  const session = useRef(false);

  /** The company is gone: forget it, and whoever was signed in at it, on this phone only (the
   *  server has nothing left to tell). The guards open the company screen. */
  const letCompanyGo = useCallback(async () => {
    setActiveCompany(null);
    session.current = false;
    savesSent.current += 1;
    turns.current += 1;
    setCompany(null);
    setMe(null);
    setOffline(false);
    setPaused(false);
    await Promise.all([forgetPerson(), saveCompany(null)]);
  }, []);

  const reload = useCallback(async () => {
    const turn = turns.current;
    const restored = await whoIsThis();
    if (turn !== turns.current) return;
    if (restored.gone) {
      await letCompanyGo();
      return;
    }
    session.current = holdsSession(restored);
    // Still unreachable, or still paused: whoever is on screen stays, rather than the saved
    // copy.
    setMe((current) => (restored.offline || restored.paused ? (current ?? restored.me) : restored.me));
    setOffline(restored.offline);
    setPaused(restored.paused);
    setReady(true);
  }, [letCompanyGo]);

  useEffect(() => {
    // Inlined rather than calling reload(), so no state is set while the effect body runs.
    let active = true;
    void (async () => {
      // The company first: every request from here on names it, /me included, so nothing is
      // asked of the wrong operator and no screen flashes by before the right one.
      const [chosen, saved] = await Promise.all([loadLocale(), restoreCompany()]);
      let loaded = SIGNED_OUT;
      if (saved) loaded = await whoIsThis();
      // A session with no company to name (left by a build that had its operator baked in)
      // can't be ended on the server or used again, so it ends here, push token and all.
      else await forgetPerson();
      if (loaded.gone) {
        setActiveCompany(null);
        await Promise.all([forgetPerson(), saveCompany(null)]);
      }
      if (!active) return;
      session.current = holdsSession(loaded);
      setOverride(isLocale(chosen) ? chosen : null);
      setCompany(loaded.gone ? null : saved);
      setMe(loaded.me);
      setOffline(loaded.offline);
      setPaused(loaded.paused);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Opened offline, or the company is paused: try again each time the app comes back to the
  // foreground.
  useEffect(() => {
    if (!offline && !paused) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void reload();
    });
    return () => subscription.remove();
  }, [offline, paused, reload]);

  // The server refused to renew the session (revoked, expired, or the person was terminated).
  // Forget who this was, and the route gates take the person back to the welcome screen.
  useEffect(
    () =>
      onSessionEnded(() => {
        session.current = false;
        savesSent.current += 1;
        turns.current += 1;
        setMe(null);
        setOffline(false);
        setPaused(false);
        void rememberMe(null);
        void savePushToken(null);
      }),
    [],
  );

  // Any call can hear that the company is paused or gone (api.ts). Paused covers a session
  // with the paused screen; gone sends the phone back to the company screen.
  useEffect(
    () =>
      onCompanyProblem((problem) => {
        if (problem === "paused") {
          if (session.current) setPaused(true);
        } else {
          void letCompanyGo();
        }
      }),
    [letCompanyGo],
  );

  const signOut = useCallback(async () => {
    // From here on nobody is signed in, so a "paused" heard by the logout below changes
    // nothing on screen.
    session.current = false;
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
    await forgetPerson();
    savesSent.current += 1;
    turns.current += 1;
    setMe(null);
    setOffline(false);
    setPaused(false);
  }, []);

  const chooseCompany = useCallback(async (next: Company) => {
    // Nobody can be signed in without a company, but a session can never be carried over to
    // another one, so anything left is dropped rather than trusted.
    if (await hasTokens()) await forgetPerson();
    await saveCompany(next);
    setActiveCompany(next.code);
    session.current = false;
    savesSent.current += 1;
    turns.current += 1;
    setMe(null);
    setOffline(false);
    setPaused(false);
    setCompany(next);
  }, []);

  const changeCompany = useCallback(async () => {
    // Signed in (behind the paused screen, say): end the session properly while the company
    // can still be named to the server, so it stops pushing to this phone too.
    if (await hasTokens()) await signOut();
    await letCompanyGo();
  }, [signOut, letCompanyGo]);

  // Precedence: the switch on this device, then the profile's language, then the phone's.
  const profile = me?.language;
  const locale: Locale = override ?? (isLocale(profile) ? profile : deviceLocale());

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      company,
      me,
      offline,
      paused,
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
        session.current = true;
        turns.current += 1;
        // Signing in hands the language back to the profile.
        setOverride(null);
        await saveLocale(null);
        // The sign-in answer already says who this is; asking /me again would only add a
        // round trip that could fail after the tokens were saved.
        setMe(tokens.user);
        setOffline(false);
        setPaused(false);
        setReady(true);
        void rememberMe(tokens.user);
      },
      signOut,
      chooseCompany,
      changeCompany,
      can: (capability) => (me?.capabilities ?? []).includes(capability),
    }),
    [ready, company, me, offline, paused, locale, reload, signOut, chooseCompany, changeCompany],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthValue {
  const value = use(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
