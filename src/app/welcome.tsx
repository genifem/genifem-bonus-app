import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { SignedOutOnly } from "@/components/Gate";
import { Floaty, Mascot } from "@/components/Mascot";
import { Body, Button, colors, Page, radius, Spacer, T } from "@/components/ui";
import { useAuth } from "@/lib/auth";

/** CR-01: the first screen. The operator's logo is a placeholder until it is supplied. */
function WelcomeScreen() {
  const { t } = useAuth();
  const router = useRouter();
  return (
    <Page bottomInset>
      <Body fill top={26} gap={16} style={styles.center}>
        <View style={styles.logo}>
          <T size={12} weight={800} color={colors.muted}>
            {t("welcome.logoPlaceholder")}
          </T>
        </View>
        <View style={{ marginTop: 14 }}>
          <Floaty>
            <Mascot pose="coin" size={190} />
          </Floaty>
        </View>
        <T size={36} weight={900} tracking={-1} align="center" heading maxFontSizeMultiplier={1.3}>
          {t("welcome.title")}
        </T>
        <T size={15} color={colors.muted} align="center">
          {t("welcome.subtitle")}
        </T>
        <Spacer />
        <View style={styles.actions}>
          <Button
            title={t("welcome.firstTime")}
            full
            onPress={() => router.push({ pathname: "/setup/[step]", params: { step: "1" } })}
          />
          <Button title={t("welcome.signIn")} variant="soft" full onPress={() => router.push("/sign-in")} />
        </View>
      </Body>
    </Page>
  );
}

export default function Welcome() {
  return (
    <SignedOutOnly>
      <WelcomeScreen />
    </SignedOutOnly>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center" },
  logo: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.dashed,
    borderRadius: radius.chip,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  actions: { alignSelf: "stretch", gap: 12 },
});
