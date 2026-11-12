import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { PushPrompt } from "@/components/PushPrompt";
import { homeGroupFor, useAuth } from "@/lib/auth";
import { useMe } from "@/lib/me";
import {
  askPermission,
  forgetThisPhone,
  markOffered,
  nameChannel,
  type PushPermission,
  pushSupported,
  type PushTap,
  pushTapOf,
  readPermission,
  registerThisPhone,
  showWhileOpen,
  wasOffered,
} from "@/lib/push";
import { type Group, notificationDestination } from "@/lib/routes";

interface PushValue {
  /** What this phone allows (push.ts). "unsupported" on the web build, a simulator, and until
   *  the first look, which happens once notifications are on. */
  permission: PushPermission;
  /**
   * Pushes on for this phone, from the switch in Profile (CR-34): the app's own word first
   * when the OS has not been asked yet, then the OS's question, then the token to the API.
   * Resolves to what the phone allows afterwards; "denied" means only the phone's settings
   * can change it.
   */
  enable: () => Promise<PushPermission>;
}

const PushContext = createContext<PushValue | null>(null);

/**
 * The phone's side of push (plan D10), for whoever is signed in:
 *
 * - With notifications on (`me.notifications_on`), a phone already allowed is registered
 *   (`PUT /me/push-tokens`) once a run; one never asked is offered pushes once, with the
 *   app's explanation (PushPrompt) before the OS asks; one refused in the phone's settings is
 *   unregistered. Coming back from the phone's settings looks again.
 * - A push that lands while the app is open shows as a banner and refreshes the summary, so
 *   the bell's dot is right.
 * - Tapping a push, with the app open or from cold, opens the screen for its type through the
 *   route helper (routes.ts), in the person's own tab group and only once the session has
 *   been read: never for someone signed out, never into the other group's gate.
 *
 * None of it holds a screen up: every step runs on its own and fails quietly.
 */
export function PushProvider({ children }: { children: ReactNode }) {
  const { ready, me, offline, t } = useAuth();
  const { refresh } = useMe();
  const personId = me?.id ?? null;
  const wanted = !!me?.notifications_on;
  const group: Group | null = me ? homeGroupFor(me) : null;
  const channel = t("push.channel");

  const [permission, setPermission] = useState<PushPermission>("unsupported");
  // Whose offer is on screen. A sign-out or a new person hides one left open.
  const [offeringFor, setOfferingFor] = useState<string | null>(null);
  const answer = useRef<((allow: boolean) => void) | null>(null);
  // The one enable() in flight, so the switch and the offer after sign-in never ask twice.
  const enabling = useRef<Promise<PushPermission> | null>(null);
  // Who this phone has been handed to the API for, in this run of the app.
  const registered = useRef<string | null>(null);

  // Signed out, or someone else signed in: register again for them, and an offer still open
  // for the last person is answered "not now".
  useEffect(() => {
    registered.current = null;
    const resolve = answer.current;
    answer.current = null;
    resolve?.(false);
  }, [personId]);

  const register = useCallback(async () => {
    if (!personId || registered.current === personId) return;
    if (await registerThisPhone(channel)) registered.current = personId;
  }, [personId, channel]);

  const offer = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        answer.current = resolve;
        setOfferingFor(personId);
      }),
    [personId],
  );

  const decide = useCallback((allow: boolean) => {
    setOfferingFor(null);
    const resolve = answer.current;
    answer.current = null;
    resolve?.(allow);
  }, []);

  const enable = useCallback((): Promise<PushPermission> => {
    if (enabling.current) return enabling.current;
    const run = (async (): Promise<PushPermission> => {
      let now = await readPermission();
      setPermission(now);
      if (now === "undetermined") {
        const allow = await offer();
        if (personId) await markOffered(personId);
        if (!allow) return now;
        now = await askPermission(channel);
        setPermission(now);
      }
      if (now === "granted") void register();
      return now;
    })();
    enabling.current = run;
    const done = () => {
      if (enabling.current === run) enabling.current = null;
    };
    run.then(done, done);
    return run;
  }, [offer, personId, channel, register]);

  // After sign-in, and whenever notifications are turned on: register, offer, or tidy up.
  useEffect(() => {
    if (!personId || !wanted || !pushSupported()) return;
    let active = true;
    void (async () => {
      const now = await readPermission();
      if (!active) return;
      setPermission(now);
      if (now === "granted") await register();
      else if (now === "denied") await forgetThisPhone();
      else if (now === "undetermined" && !(await wasOffered(personId)) && active) void enable();
    })();
    return () => {
      active = false;
    };
  }, [personId, wanted, register, enable]);

  // The Android channel's name follows the language on screen.
  useEffect(() => {
    if (permission === "granted") void nameChannel(channel);
  }, [permission, channel]);

  // Back from the phone's settings (Profile's "Open settings"): the answer may have changed.
  useEffect(() => {
    if (!personId || !pushSupported()) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void readPermission().then((now) => {
        setPermission(now);
        if (now === "granted" && wanted) void register();
      });
    });
    return () => subscription.remove();
  }, [personId, wanted, register]);

  // The OS gave the phone a new token: hand that one over instead.
  useEffect(() => {
    if (!personId || !wanted || permission !== "granted") return;
    const subscription = Notifications.addPushTokenListener(() => {
      registered.current = null;
      void register();
    });
    return () => subscription.remove();
  }, [personId, wanted, permission, register]);

  // A push while the app is open: a banner, and the unread count on the bell.
  useEffect(() => {
    showWhileOpen(!!personId);
    if (!personId || !pushSupported()) return;
    const subscription = Notifications.addNotificationReceivedListener(() => void refresh());
    return () => subscription.remove();
  }, [personId, refresh]);

  // A tap waits here until the saved session has been read (and, offline on a phone that
  // never kept the profile, until it can be), then opens the screen for its type in the
  // person's own group.
  const place = useRef<{ ready: boolean; group: Group | null; waiting: boolean }>({
    ready: false,
    group: null,
    waiting: false,
  });
  const tapped = useRef<PushTap | null>(null);
  const handled = useRef(new Set<string>());

  const follow = useCallback(() => {
    const tap = tapped.current;
    const where = place.current;
    if (!tap || !where.ready || where.waiting) return;
    tapped.current = null;
    // Signed out since: the push was for someone who is no longer here.
    if (!where.group) return;
    const destination = notificationDestination(tap.type, where.group, tap.id);
    // A frame later, so the stack has drawn the person's screens after a cold start.
    requestAnimationFrame(() => {
      try {
        if (destination.push) router.push(destination.href);
        else router.navigate(destination.href);
      } catch (err) {
        console.info("[push] could not open the notification's screen", err instanceof Error ? err.message : "");
      }
    });
  }, []);

  const waiting = !me && offline;
  useEffect(() => {
    place.current = { ready, group, waiting };
    follow();
  }, [ready, group, waiting, follow]);

  useEffect(() => {
    if (!pushSupported()) return;
    const take = (response: Notifications.NotificationResponse | null) => {
      if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      // The same tap can come from the listener and from the last response at a cold start.
      const key = response.notification.request.identifier;
      if (handled.current.has(key)) return;
      handled.current.add(key);
      tapped.current = pushTapOf(response.notification.request.content.data);
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      follow();
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(take);
    // The tap that opened the app from cold.
    void Notifications.getLastNotificationResponseAsync().then(take, () => undefined);
    return () => subscription.remove();
  }, [follow]);

  const value = useMemo<PushValue>(() => ({ permission, enable }), [permission, enable]);

  return (
    <PushContext value={value}>
      {children}
      <PushPrompt
        visible={offeringFor !== null && offeringFor === personId}
        manager={group === "manager"}
        onAllow={() => decide(true)}
        onLater={() => decide(false)}
      />
    </PushContext>
  );
}

export function usePush(): PushValue {
  const value = use(PushContext);
  if (!value) throw new Error("usePush must be used inside PushProvider");
  return value;
}
