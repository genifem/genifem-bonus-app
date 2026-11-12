import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { crewStars } from "@/components/ui/theme";
import { api } from "@/lib/api";
import { loadPushToken, savePushToken } from "@/lib/session";
import storage from "@/lib/storage";

/**
 * Push notifications on this phone (plan D10, CR-34). The API decides what is sent and when:
 * it writes the text in the person's saved language (D14), skips anyone who turned
 * notifications off, and holds pushes between 10 pm and 7 am store time (NF-07). The phone's
 * part is here: ask the OS (after the app has said why, PushPrompt), hand the API this
 * phone's Expo token for whoever is signed in, and name it at sign-out (`/auth/logout`, in
 * auth.tsx) so the server stops.
 *
 * None of it blocks a screen or says anything when it fails: a phone without pushes still has
 * the bell. A failure is logged once, not shown.
 */

/** What `PUT /me/push-tokens` accepts (`PushTokenIn`): an Expo token, never a raw APNs or FCM
 *  one. */
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$/;

export function isExpoPushToken(value: unknown): value is string {
  return typeof value === "string" && EXPO_TOKEN.test(value);
}

export type PushPlatform = "ios" | "android";

/** The phones the API takes tokens for. The web build gets no pushes. */
export function pushPlatform(os: string): PushPlatform | null {
  return os === "ios" || os === "android" ? os : null;
}

interface ConstantsLike {
  expoConfig?: { extra?: { eas?: { projectId?: unknown } } } | null;
  easConfig?: { projectId?: unknown } | null;
}

/** The EAS project an Expo token belongs to. There is none in Expo Go or a build made without
 *  EAS, and without it there is no token: those builds get no pushes. */
export function projectIdOf(constants: ConstantsLike): string | null {
  const id = constants.expoConfig?.extra?.eas?.projectId ?? constants.easConfig?.projectId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/**
 * What the phone allows, as the app acts on it: "granted" (iOS's quiet, provisional yes counts),
 * "undetermined" while the OS can still ask (Android asks twice before it stops), "denied" once
 * only the phone's settings can change it, and "unsupported" for the web build, a simulator,
 * or before the first look.
 */
export type PushPermission = "granted" | "undetermined" | "denied" | "unsupported";

export function permissionOf(answer: {
  granted: boolean;
  canAskAgain: boolean;
  provisional?: boolean;
}): Exclude<PushPermission, "unsupported"> {
  if (answer.granted || answer.provisional) return "granted";
  return answer.canAskAgain ? "undetermined" : "denied";
}

/** A push's `data` (`{type, id}`, the notification's type and id). A push without it still
 *  opens something: an unknown type lands on the notification list. */
export interface PushTap {
  type: string;
  id: string | null;
}

export function pushTapOf(data: unknown): PushTap {
  const fields = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  return {
    type: typeof fields.type === "string" ? fields.type : "",
    id: typeof fields.id === "string" && fields.id ? fields.id : null,
  };
}

/* ---------------------------------------------------------------- the phone */

const logged = new Set<string>();

/** Pushes never show a problem to the person; a developer sees each kind once. */
function note(what: string, err?: unknown): void {
  if (logged.has(what)) return;
  logged.add(what);
  console.info(`[push] ${what}`, err instanceof Error ? err.message : (err ?? ""));
}

/** Pushes need a real phone: not the web build, not a simulator. */
export function pushSupported(): boolean {
  return pushPlatform(Platform.OS) !== null && Device.isDevice;
}

const CHANNEL = "default";

/**
 * Android shows nothing without a channel, and Android 13 only asks for permission once one
 * exists. Setting it again renames it, so the channel's name in the phone's settings follows
 * the language on screen.
 */
export async function nameChannel(name: string): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name,
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: crewStars.red,
    });
  } catch (err) {
    note("could not set up the notification channel", err);
  }
}

function answerOf(status: Notifications.NotificationPermissionsStatus) {
  return {
    granted: status.granted,
    canAskAgain: status.canAskAgain,
    provisional: status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
  };
}

/** What the phone allows now, without asking. */
export async function readPermission(): Promise<PushPermission> {
  if (!pushSupported()) return "unsupported";
  try {
    return permissionOf(answerOf(await Notifications.getPermissionsAsync()));
  } catch (err) {
    note("could not read the permission", err);
    return "unsupported";
  }
}

/** The OS's own question. Only after PushPrompt has said why (plan §8 "Push"). */
export async function askPermission(channelName: string): Promise<PushPermission> {
  if (!pushSupported()) return "unsupported";
  try {
    await nameChannel(channelName);
    return permissionOf(answerOf(await Notifications.requestPermissionsAsync()));
  } catch (err) {
    note("could not ask for the permission", err);
    return "unsupported";
  }
}

/**
 * Hand this phone's token to the API for whoever is signed in (`PUT /me/push-tokens`; a phone
 * someone else used before moves to them), and keep it for sign-out. Quietly nothing without
 * permission, without an EAS project id (Expo Go, a local build) or without a connection: the
 * next sign-in or launch tries again. Resolves to the token registered, or null.
 */
export async function registerThisPhone(channelName: string): Promise<string | null> {
  const platform = pushPlatform(Platform.OS);
  if (!platform || !Device.isDevice) return null;
  const projectId = projectIdOf(Constants);
  if (!projectId) {
    note("no EAS projectId in this build, so no push token: skipped");
    return null;
  }
  try {
    await nameChannel(channelName);
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!isExpoPushToken(token)) {
      note("Expo returned a token the API would not accept: skipped");
      return null;
    }
    await api("/me/push-tokens", { method: "PUT", body: { token, platform } });
    await savePushToken(token);
    return token;
  } catch (err) {
    note("could not register this phone", err);
    return null;
  }
}

/** The phone no longer allows notifications: stop the API pushing to it
 *  (`DELETE /me/push-tokens`). Kept for the next try if the API can't be reached. */
export async function forgetThisPhone(): Promise<void> {
  const token = await loadPushToken();
  if (!token) return;
  try {
    await api("/me/push-tokens", { method: "DELETE", body: { token } });
    await savePushToken(null);
  } catch (err) {
    note("could not unregister this phone", err);
  }
}

/** A push that lands while the app is open shows as a banner too, and the bell's count is
 *  refreshed by whoever listens (usePush). Nobody signed in: nothing shows. */
export function showWhileOpen(signedIn: boolean): void {
  if (!pushSupported()) return;
  Notifications.setNotificationHandler(
    signedIn
      ? {
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }),
        }
      : null,
  );
}

/* ---------------------------------------------------------------- asking once */

const askedKey = (personId: string) => `cs_push_asked_${personId}`;

/** Whether the app has offered pushes to this person on this phone: it offers once by itself,
 *  after that only from the switch in Profile. */
export async function wasOffered(personId: string): Promise<boolean> {
  try {
    return (await storage.getItem(askedKey(personId))) === "1";
  } catch {
    return false;
  }
}

export async function markOffered(personId: string): Promise<void> {
  try {
    await storage.setItem(askedKey(personId), "1");
  } catch {
    // The offer may come once more; nothing worse.
  }
}
