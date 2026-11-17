import { isRunningInExpoGo } from "expo";
import type * as ExpoNotifications from "expo-notifications";

/**
 * expo-notifications, loaded only where it can work (plan D10). Expo Go has had no remote
 * pushes since SDK 53, and on Android merely loading the module throws, which took the whole
 * app down before its first screen. So Expo Go never loads it: the app runs there without
 * pushes (the bell still works), and the APK and development builds have them.
 *
 * Everything that touches the module goes through here (push.ts, usePush.tsx); a type-only
 * import of it is fine anywhere, since it is gone once compiled.
 */
export type NotificationsModule = typeof ExpoNotifications;

let loaded: NotificationsModule | null | undefined;

/** The module, or null in Expo Go (or if it could not load, which is logged once). */
export function notificationsModule(): NotificationsModule | null {
  if (loaded !== undefined) return loaded;
  if (isRunningInExpoGo()) {
    loaded = null;
    return loaded;
  }
  try {
    // Loaded on first use rather than imported at the top, so Expo Go never evaluates it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require("expo-notifications") as NotificationsModule;
  } catch (err) {
    console.info("[push] expo-notifications could not load", err instanceof Error ? err.message : "");
    loaded = null;
  }
  return loaded;
}
