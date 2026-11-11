import type { Schemas } from "@crewstars/api-client";
import { isLocale, type Locale, type Translator } from "@crewstars/i18n";
import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, onSessionEnded } from "@/lib/api";
import { ApiError } from "@/lib/apiError";
import { deviceLocale, translatorFor } from "@/lib/i18n";
import { clearTokens, loadLocale, loadSession, saveLocale, saveTokens } from "@/lib/session";

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

/** Who is signed in, if anyone. */
async function whoIsThis(): Promise<MeOut | null> {
  const session = await loadSession();
  if (!session.accessToken) return null;
  try {
    const me = await api<MeOut>("/me");
    if (appUser(me)) return me;
    await clearTokens();
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<MeOut | null>(null);
  const [override, setOverride] = useState<Locale | null>(null);
  // Two quick taps on the language switch send two saves; only the last one's answer counts.
  // Signing out counts as a newer answer, so a save still on its way cannot bring `me` back.
  const savesSent = useRef(0);

  const reload = useCallback(async () => {
    setMe(await whoIsThis());
    setReady(true);
  }, []);

  useEffect(() => {
    // Inlined rather than calling reload(), so no state is set while the effect body runs.
    let active = true;
    void (async () => {
      const [loaded, chosen] = await Promise.all([whoIsThis(), loadLocale()]);
      if (!active) return;
      setOverride(isLocale(chosen) ? chosen : null);
      setMe(loaded);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // The server refused to renew the session (revoked, expired, or the person was terminated).
  // Forget who this was, and the route gates take the person back to the welcome screen.
  useEffect(
    () =>
      onSessionEnded(() => {
        savesSent.current += 1;
        setMe(null);
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
      t: translatorFor(locale),
      locale,
      setLocale: async (next: Locale) => {
        setOverride(next);
        await saveLocale(next);
      },
      savePreferences: async (changes) => {
        const sent = ++savesSent.current;
        const updated = await api<MeOut>("/me/preferences", { method: "PATCH", body: changes });
        if (sent === savesSent.current) setMe(updated);
      },
      reload,
      signedIn: async (tokens) => {
        if (!appUser(tokens.user)) throw new ApiError(403, "owner_use_portal", "owners use the web portal");
        await saveTokens(tokens.access_token, tokens.refresh_token ?? null);
        // Signing in hands the language back to the profile.
        setOverride(null);
        await saveLocale(null);
        // The sign-in answer already says who this is; asking /me again would only add a
        // round trip that could fail after the tokens were saved.
        setMe(tokens.user);
        setReady(true);
      },
      signOut: async () => {
        const { refreshToken } = await loadSession();
        if (refreshToken) {
          try {
            // The server revokes the refresh token's whole family, so the session really ends.
            // Anonymous, because a lapsed access token would otherwise be renewed first,
            // spending the very token being revoked.
            await api("/auth/logout", {
              method: "POST",
              body: { refresh_token: refreshToken },
              anonymous: true,
            });
          } catch {
            // Signing out locally matters more than telling the server about it.
          }
        }
        await clearTokens();
        savesSent.current += 1;
        setMe(null);
      },
      can: (capability) => (me?.capabilities ?? []).includes(capability),
    }),
    [ready, me, locale, reload],
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
