import { isLocale, type Locale, type Translator } from "@crewstars/i18n";
import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useState } from "react";

import { api, onSessionEnded } from "@/lib/api";
import { deviceLocale, translatorFor } from "@/lib/i18n";
import { clearTokens, loadLocale, loadSession, saveLocale, saveTokens } from "@/lib/session";

/** Who can be signed in to the app. Owners use the web portal (CR-08). */
export type Role = "crew" | "shift" | "gm" | "supervisor" | "director";

/** Something the server lets this person do. The API sends the list with `/me`. */
export type Capability = string;

/**
 * `GET /me`, the parts the app reads today. It moves to the generated api-client type
 * (`Schemas["MeOut"]`) once bonus-backend exports the endpoint in phase P1.
 */
export interface Me {
  id: string;
  name: string;
  role: Role;
  /** The language saved on the person's profile ("en" / "es"). */
  language?: string | null;
  capabilities?: Capability[];
}

/** The tokens every sign-in step ends with (`/auth/login`, `/auth/setup/complete`). */
export interface Tokens {
  access_token: string;
  refresh_token?: string | null;
}

interface AuthValue {
  ready: boolean;
  me: Me | null;
  t: Translator;
  locale: Locale;
  /** The English / Español switch. Remembered on this device; the profile's language is the
   *  default, and the phone's language before anyone signs in. */
  setLocale: (locale: Locale) => Promise<void>;
  reload: () => Promise<void>;
  /** Store the tokens from any sign-in step and load who this is. */
  signedIn: (tokens: Tokens) => Promise<void>;
  /** End the session here and on the server. */
  signOut: () => Promise<void>;
  can: (capability: Capability) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Who is signed in, if anyone. */
async function whoIsThis(): Promise<Me | null> {
  const session = await loadSession();
  if (!session.accessToken) return null;
  try {
    return await api<Me>("/me");
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [override, setOverride] = useState<Locale | null>(null);

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
  useEffect(() => onSessionEnded(() => setMe(null)), []);

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
      reload,
      signedIn: async (tokens) => {
        await saveTokens(tokens.access_token, tokens.refresh_token ?? null);
        // Signing in hands the language back to the profile.
        setOverride(null);
        await saveLocale(null);
        await reload();
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
 *  crew tabs (plan §8). */
export function homeGroupFor(me: Pick<Me, "role">): "manager" | "crew" {
  return me.role === "gm" ? "manager" : "crew";
}
