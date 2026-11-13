import type { Schemas } from "@crewstars/api-client";
import { useRouter } from "expo-router";
import { Image, StyleSheet, View } from "react-native";

import { SignedOutOnly } from "@/components/Gate";
import { Floaty, Mascot } from "@/components/Mascot";
import { Body, Button, colors, Page, radius, Spacer, T, TextLink } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/useApi";

/**
 * Whose app this is (`GET /meta`): the operator's logo, or its name until it has one. The
 * row keeps its height while it loads, so nothing below it jumps. Without an answer it shows
 * what the company screen kept (P7), or stays empty: the screen works without it.
 */
function Operator() {
  const { t, company } = useAuth();
  const { data } = useApi<Schemas["MetaOut"]>("/meta");
  const name = data?.name ?? company?.name ?? null;
  const logo = data ? data.logo_url : (company?.logoUrl ?? null);
  if (logo && name) {
    return (
      <Image
        source={{ uri: logo }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t("welcome.operatorLogo", { name })}
        resizeMode="contain"
        style={styles.logoImage}
      />
    );
  }
  return (
    <View style={styles.logoRow}>
      {name ? (
        <View style={styles.logo}>
          <T size={12} weight={800} color={colors.muted} numberOfLines={1}>
            {name}
          </T>
        </View>
      ) : null}
    </View>
  );
}

/** CR-01: the first screen, with the operator's logo, then the two ways in, and the way to
 *  another company (P7) for a phone set up for the wrong one. */
function WelcomeScreen() {
  const { t, changeCompany } = useAuth();
  const router = useRouter();
  return (
    <Page bottomInset>
      <Body fill top={26} gap={16} style={styles.center}>
        <Operator />
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
          <TextLink title={t("company.change")} onPress={() => void changeCompany()} />
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
  logoRow: { minHeight: 34, justifyContent: "center" },
  logoImage: { width: 180, height: 48 },
  logo: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
    borderRadius: radius.chip,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  actions: { alignSelf: "stretch", gap: 12 },
});
