import { View } from "react-native";

import { Button, Card, Icon, LanguageSwitch, T } from "@/components/ui";
import { useAuth } from "@/lib/auth";

import { PlaceholderTab } from "./Placeholder";

/** The crew wall (both tab groups). */
export function Wall() {
  const { t } = useAuth();
  return <PlaceholderTab title={t("wall.title")} lead={t("wall.lead")} pose="happy" />;
}

/** Give a shout-out (both tab groups). */
export function Give() {
  const { t } = useAuth();
  return <PlaceholderTab title={t("give.title")} lead={t("give.lead")} pose="wave" />;
}

/** The rewards catalogue (crew tabs). */
export function Rewards() {
  const { t } = useAuth();
  return <PlaceholderTab title={t("rewards.title")} lead={t("rewards.lead")} pose="coin" />;
}

/** Reward requests waiting for the GM (manager tabs). */
export function Approvals() {
  const { t } = useAuth();
  return <PlaceholderTab title={t("approvals.title")} lead={t("approvals.lead")} pose="cheer" />;
}

/**
 * The profile (both tab groups). Already carries the two settings that work without new API:
 * the language switch and signing out, so the gates can be tried end to end.
 */
export function Profile() {
  const { t, me, signOut } = useAuth();
  return (
    <PlaceholderTab title={t("profile.title")} lead={me?.name} pose="happy">
      <Card style={{ paddingVertical: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56 }}>
          <Icon name="globe" size={20} />
          <T weight={700} style={{ flex: 1 }}>
            {t("common.language")}
          </T>
          <LanguageSwitch />
        </View>
      </Card>
      <Button title={t("common.signOut")} icon="logout" variant="soft" full onPress={() => void signOut()} />
    </PlaceholderTab>
  );
}
