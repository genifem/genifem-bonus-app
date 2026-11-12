import { Stack } from "expo-router";

import { RoleGate } from "@/components/Gate";
import { colors } from "@/components/ui";

/** The GM's side of the app: the manager tabs, behind a gate that sends anyone else to the
 *  crew tabs (or the welcome screen), with the shared screens (notifications) pushed over
 *  them as in the crew group. */
export default function ManagerLayout() {
  return (
    <RoleGate group="manager">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="notifications" />
      </Stack>
    </RoleGate>
  );
}
