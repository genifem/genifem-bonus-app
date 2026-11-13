import { useEffect, useState } from "react";
import { AccessibilityInfo, BackHandler, Image, Platform, StyleSheet, View } from "react-native";

import { Mascot } from "@/components/Mascot";
import {
  Body,
  Button,
  Card,
  colors,
  Field,
  OfflineState,
  Page,
  ScreenHeader,
  ScreenTitle,
  Spacer,
  T,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { companyProblem, type Problem, say } from "@/lib/errors";
import {
  type Company,
  COMPANY_CODE_MAX,
  companyOf,
  defaultCompanyCode,
  isCompanyCode,
  type MetaOut,
  normaliseCompanyCode,
} from "@/lib/tenant";

/**
 * P7: which company this phone is for, asked once, before anything else. The root guard makes
 * this the only screen there is until a company is chosen, and takes it away once one is.
 *
 * The code is the operator's slug ("ECC" is `ecc`), checked with `GET /meta` naming it in
 * X-Tenant before anything is kept. The answer's name (and logo, when it has one) asks "Is
 * this your company?"; yes keeps it (auth.tsx `chooseCompany`) and the guard opens the
 * welcome screen, where crew sign in or set up. A code no operator has, a paused operator and
 * no connection each say so differently; only the last is said calmly, with a retry.
 */

/* ---------------------------------------------------------------- is this it? */

function Confirm({ company, onBack }: { company: Company; onBack: () => void }) {
  const { t, chooseCompany } = useAuth();
  const [busy, setBusy] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const name = company.name ?? company.code.toUpperCase();
  const question = t("company.confirmA11y", { name });

  // Android's back button goes back to the code, as the header's does, rather than out of the
  // app: this is still the first screen.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  // The question takes the field's place without a new screen, so it is read out: the card is
  // a live region for Android and the web, and iOS, which has none, is told.
  useEffect(() => {
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(question);
  }, [question]);

  const yes = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // The guard moves on to the welcome screen as soon as it is kept.
      await chooseCompany(company);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page bottomInset>
      <Body fill gap={18}>
        <ScreenHeader onBack={onBack} />
        <ScreenTitle title={t("company.confirmTitle")} />
        <Card padding={22}>
          <View
            accessible
            accessibilityLabel={question}
            accessibilityLiveRegion="polite"
            aria-live="polite"
            style={styles.found}
          >
            {company.logoUrl && !logoFailed ? (
              <Image
                source={{ uri: company.logoUrl }}
                resizeMode="contain"
                onError={() => setLogoFailed(true)}
                style={styles.logo}
              />
            ) : null}
            <T size={22} weight={900} align="center">
              {name}
            </T>
            <T size={13} weight={800} color={colors.muted} align="center" tabular>
              {company.code.toUpperCase()}
            </T>
          </View>
        </Card>
        <Spacer />
        <Button title={t("company.yes")} full busy={busy} onPress={() => void yes()} />
        <Button title={t("company.no")} variant="ghost" full disabled={busy} onPress={onBack} />
      </Body>
    </Page>
  );
}

/* ---------------------------------------------------------------- the code */

export default function CompanyScreen() {
  const { t } = useAuth();
  // A build made for one operator (EXPO_PUBLIC_TENANT) starts with its code filled in.
  const [code, setCode] = useState(() => defaultCompanyCode() ?? "");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [checking, setChecking] = useState(false);
  const [found, setFound] = useState<Company | null>(null);
  const ready = isCompanyCode(code);
  const offline = problem?.code === "network";
  // No connection is not the code's fault: it is said under the field, calmly, not on it.
  const message = offline ? null : say(t, problem, null);

  const check = async () => {
    if (!ready || checking) return;
    setChecking(true);
    setProblem(null);
    try {
      const meta = await api<MetaOut>("/meta", { anonymous: true, tenant: code });
      setFound(companyOf(meta));
    } catch (err) {
      setProblem(companyProblem(err));
    } finally {
      setChecking(false);
    }
  };

  if (found) return <Confirm company={found} onBack={() => setFound(null)} />;

  return (
    <Page bottomInset>
      <Body fill top={26} gap={18}>
        <View style={styles.art}>
          <Mascot pose="wave" size={120} />
        </View>
        <ScreenTitle title={t("company.title")} lead={t("company.lead")} />
        <Field
          label={t("company.code")}
          hint={t("company.codeHint")}
          error={message ?? undefined}
          // Shown in capitals, as managers write it; kept and sent in lower case.
          value={code.toUpperCase()}
          onChangeText={(text) => {
            setCode(normaliseCompanyCode(text));
            setProblem(null);
          }}
          maxLength={COMPANY_CODE_MAX}
          autoCapitalize="characters"
          autoComplete="off"
          importantForAutofill="no"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="go"
          onSubmitEditing={() => void check()}
        />
        {offline ? <OfflineState onRetry={() => void check()} /> : null}
        <Spacer />
        <Button
          title={t("common.continue")}
          iconRight="chev"
          full
          disabled={!ready}
          busy={checking}
          onPress={() => void check()}
        />
      </Body>
    </Page>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: "center" },
  found: { alignItems: "center", gap: 8 },
  logo: { width: 180, height: 56 },
});
