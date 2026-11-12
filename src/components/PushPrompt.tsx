import { StyleSheet, View } from "react-native";

import { Mascot } from "@/components/Mascot";
import { Button, colors, Sheet, T } from "@/components/ui";
import { useAuth } from "@/lib/auth";

/**
 * The app's own word before the phone's permission question (plan §8 "Push"): what pushes
 * bring (a GM also hears about reward requests), and that nothing in the app is needed off
 * the clock, with no pushes at night (NF-07). "Not now" leaves the phone unasked, so the
 * question can still come later from the switch in Profile.
 */
export function PushPrompt({
  visible,
  manager,
  onAllow,
  onLater,
}: {
  visible: boolean;
  manager: boolean;
  onAllow: () => void;
  onLater: () => void;
}) {
  const { t } = useAuth();
  return (
    <Sheet
      visible={visible}
      onClose={onLater}
      label={t("push.title")}
      closeLabel={t("push.later")}
      footer={
        <>
          <Button title={t("push.allow")} icon="bell" full onPress={onAllow} />
          <Button title={t("push.later")} variant="ghost" full onPress={onLater} />
        </>
      }
    >
      <View style={styles.body}>
        <Mascot pose="wave" size={96} />
        <T size={22} weight={900} align="center" heading>
          {t("push.title")}
        </T>
        <T size={14} color={colors.muted} align="center">
          {t(manager ? "push.leadManager" : "push.lead")}
        </T>
        <T size={13} weight={700} align="center">
          {t("push.offClock")}
        </T>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: "center", gap: 10, paddingTop: 4 },
});
