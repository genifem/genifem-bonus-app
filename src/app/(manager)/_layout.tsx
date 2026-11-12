import { Stack } from "expo-router";

import { RoleGate } from "@/components/Gate";
import { colors } from "@/components/ui";

/** The GM's side of the app: the manager tabs, behind a gate that sends anyone else to the
 *  crew tabs (or the welcome screen), with the shared screens (notifications, my rewards,
 *  spin, the leaderboard) pushed over them as in the crew group. A GM redeems too (MG-09),
 *  but has Approvals where the crew have the Rewards tab, so the catalogue is pushed from My
 *  rewards. */
export default function ManagerLayout() {
  return (
    <RoleGate group="manager">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="my-rewards" />
        <Stack.Screen name="rewards" />
        <Stack.Screen name="spin" />
        <Stack.Screen name="leaderboard" />
      </Stack>
    </RoleGate>
  );
}
