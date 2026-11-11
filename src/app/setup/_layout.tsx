import { Stack } from "expo-router";

import { SignedOutOnly } from "@/components/Gate";
import { colors } from "@/components/ui";
import { SetupFlowProvider } from "@/lib/useSetupFlow";

/**
 * The three setup steps, as a stack of their own under one flow (CR-03 to CR-06).
 *
 * Each step is pushed, so Back, a swipe and Android's back button return to the step before
 * it as it was left. What the steps share (the EID, the masked phone, the countdowns, the
 * setup token) lives in the provider here: memory only, never a URL, and gone once the
 * person leaves the section or finishes it. Finishing signs them in, and the gate sends them
 * on to their tabs.
 */
export default function SetupLayout() {
  return (
    <SignedOutOnly>
      <SetupFlowProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
      </SetupFlowProvider>
    </SignedOutOnly>
  );
}
