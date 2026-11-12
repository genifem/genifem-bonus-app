import { Stack } from "expo-router";

import { RoleGate } from "@/components/Gate";
import { colors } from "@/components/ui";

/**
 * The crew's side of the app (crew, shift managers, supervisors, directors). It is also where
 * a launch lands ("/" resolves here first), so its gate decides the way in: the welcome
 * screen, or the manager tabs for a GM.
 *
 * A stack over the tabs, so the screens you go into later (spin, leaderboard, notifications)
 * push in over the bar and swipe back.
 */
export default function CrewLayout() {
  return (
    <RoleGate group="crew">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="notifications" />
      </Stack>
    </RoleGate>
  );
}
