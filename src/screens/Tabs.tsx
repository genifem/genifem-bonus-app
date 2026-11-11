import type { Locale } from "@crewstars/i18n";
import { View } from "react-native";

import { Button, Card, Icon, LanguageSwitch, T, useToast } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { translatorFor } from "@/lib/i18n";

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
 * The profile (both tab groups). For now it carries the language switch and signing out, so
 * the gates can be tried end to end; the rest of the profile comes later.
 *
 * The language changes on screen at once (NF-02) and is then saved to the profile, so the
 * texts and the next phone this person signs in on use it too. A save that fails says so,
 * but leaves the switch where it is: it still holds on this phone.
 */
export function Profile() {
  const { t, me, signOut, setLocale, savePreferences } = useAuth();
  const toast = useToast();

  const chooseLanguage = (language: Locale) => {
    void setLocale(language);
    savePreferences({ language }).catch(() => {
      // In the language just chosen: `t` still speaks the one being left.
      toast.show(translatorFor(language)("profile.languageNotSaved"), { icon: "info" });
    });
  };

  return (
    <PlaceholderTab title={t("profile.title")} lead={me?.name} pose="happy">
      <Card style={{ paddingVertical: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56 }}>
          <Icon name="globe" size={20} />
          <T weight={700} style={{ flex: 1 }}>
            {t("common.language")}
          </T>
          <LanguageSwitch onChange={chooseLanguage} />
        </View>
      </Card>
      <Button title={t("common.signOut")} icon="logout" variant="soft" full onPress={() => void signOut()} />
    </PlaceholderTab>
  );
}
