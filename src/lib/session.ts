import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Where the app keeps its session.
 *
 * Tokens go in the device keychain, never in plain storage. The tenant is not kept here: one
 * operator per build, named by EXPO_PUBLIC_TENANT (see tenant.ts, plan D3).
 *
 * The keychain has no web implementation. The app's web build exists only to develop against
 * (`pnpm web`), so there - and only in development - the session lives in the tab's
 * sessionStorage instead.
 */

const ACCESS = "cs_access";
const REFRESH = "cs_refresh";
const LOCALE = "cs_locale";

export interface Session {
  accessToken: string | null;
  refreshToken: string | null;
}

const devWeb = Platform.OS === "web" && __DEV__;

function webStore(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

async function read(key: string): Promise<string | null> {
  if (devWeb) return webStore()?.getItem(key) ?? null;
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null; // a locked or unavailable keychain must not crash the app
  }
}

async function write(key: string, value: string | null): Promise<void> {
  if (devWeb) {
    const store = webStore();
    if (value === null) store?.removeItem(key);
    else store?.setItem(key, value);
    return;
  }
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // Nothing to do: the next call will simply ask the person to sign in again.
  }
}

export async function loadSession(): Promise<Session> {
  const [accessToken, refreshToken] = await Promise.all([read(ACCESS), read(REFRESH)]);
  return { accessToken, refreshToken };
}

export async function saveTokens(access: string, refresh: string | null): Promise<void> {
  await write(ACCESS, access);
  if (refresh) await write(REFRESH, refresh);
}

export async function clearTokens(): Promise<void> {
  await write(ACCESS, null);
  await write(REFRESH, null);
}

/** The UI language someone picked with the English / Español switch, which beats the
 *  profile's. */
export async function loadLocale(): Promise<string | null> {
  return read(LOCALE);
}

export async function saveLocale(locale: string | null): Promise<void> {
  await write(LOCALE, locale);
}
