import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { SignedOutOnly } from "@/components/Gate";
import { OtpInput } from "@/components/OtpInput";
import {
  Body,
  Button,
  colors,
  Field,
  Icon,
  IconButton,
  Page,
  radius,
  Rich,
  ScreenHeader,
  ScreenTitle,
  Spacer,
  T,
  TextLink,
  useToast,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { formatCountdown, useCountdownFrom } from "@/lib/useCountdown";

/**
 * CR-03/05/06: first-time setup in three steps, reused with other titles for a forgotten
 * password (`?mode=reset`): the EID, the texted code, then a password.
 *
 * P0 is the interface only. Phase P1 wires the steps to `/auth/setup/start`, `/verify` and
 * `/complete`; until then Continue only moves to the next step, and the last step says the
 * rest is on its way.
 */

const STEPS = 3;
const RESEND_AFTER = 30;
/** What `/auth/setup/start` will send back as `masked_phone`; fully masked until then. */
const MASKED_PHONE = "(•••) •••-••••";

type Mode = "setup" | "reset";

interface StepProps {
  mode: Mode;
  eid: string;
  next: (params: { eid?: string }) => void;
}

function StepBar({ step }: { step: number }) {
  const { t } = useAuth();
  const label = t("setup.step", { step, total: STEPS });
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      aria-valuemin={1}
      aria-valuemax={STEPS}
      aria-valuenow={step}
      style={{ gap: 8 }}
    >
      <View style={styles.steps}>
        {Array.from({ length: STEPS }, (_, index) => (
          <View
            key={index}
            style={[styles.stepSegment, { backgroundColor: index < step ? colors.brand : colors.track }]}
          />
        ))}
      </View>
      <T size={12} weight={800} color={colors.muted}>
        {label}
      </T>
    </View>
  );
}

function EidStep({ mode, eid: initial, next }: StepProps) {
  const { t } = useAuth();
  const [eid, setEid] = useState(initial);
  const ready = eid.trim().length >= 4;
  return (
    <>
      <ScreenTitle title={mode === "reset" ? t("setup.titleReset") : t("setup.titleSetup")} />
      <Field
        label={t("setup.eid")}
        hint={t("setup.eidHint")}
        value={eid}
        onChangeText={(text) => setEid(text.replace(/\D/g, ""))}
        numeric
        keyboardType="number-pad"
        inputMode="numeric"
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => ready && next({ eid: eid.trim() })}
      />
      <Spacer />
      <Button
        title={t("common.continue")}
        iconRight="chev"
        full
        disabled={!ready}
        onPress={() => next({ eid: eid.trim() })}
      />
    </>
  );
}

function CodeStep({ next }: StepProps) {
  const { t } = useAuth();
  const [code, setCode] = useState("");
  const [remaining, restart] = useCountdownFrom(RESEND_AFTER);
  const ready = code.length === 6;
  return (
    <>
      <View style={{ gap: 4 }}>
        <ScreenTitle title={t("setup.codeTitle")} />
        <Rich size={13} color={colors.muted} parts={t.rich("setup.codeSent", { phone: MASKED_PHONE })} />
      </View>
      <OtpInput value={code} onChange={setCode} label={t("setup.codeLabel")} onSubmit={() => ready && next({})} />
      <TextLink
        role="button"
        title={remaining > 0 ? t("setup.resendIn", { time: formatCountdown(remaining) }) : t("setup.resend")}
        disabled={remaining > 0}
        onPress={restart}
      />
      <Spacer />
      <Button title={t("common.continue")} iconRight="chev" full disabled={!ready} onPress={() => next({})} />
    </>
  );
}

function Rule({ met, label }: { met: boolean; label: string }) {
  const { t } = useAuth();
  return (
    <View accessible accessibilityLabel={`${label}, ${met ? t("setup.met") : t("setup.notMet")}`} style={styles.rule}>
      <View style={[styles.ruleMark, { backgroundColor: met ? colors.success : colors.track }]}>
        {met ? <Icon name="check" size={12} color={colors.brandFg} stroke={3.4} /> : null}
      </View>
      <T size={13} weight={700} color={met ? colors.successInk : colors.muted}>
        {label}
      </T>
    </View>
  );
}

function PasswordStep({ mode }: StepProps) {
  const { t } = useAuth();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const rules = [
    { met: password.length >= 8, label: t("setup.rules.length") },
    { met: /\d/.test(password), label: t("setup.rules.number") },
    { met: password.length > 0 && password === confirm, label: t("setup.rules.match") },
  ];
  const ok = rules.every((rule) => rule.met);
  return (
    <>
      <ScreenTitle
        title={mode === "reset" ? t("setup.passwordTitleReset") : t("setup.passwordTitleSetup")}
        lead={t("setup.passwordLead")}
      />
      <Field
        label={t("setup.password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!show}
        autoComplete="new-password"
        textContentType="newPassword"
        autoCapitalize="none"
        autoCorrect={false}
        accessory={
          <IconButton
            icon={show ? "eyeOff" : "eye"}
            label={show ? t("signIn.hidePassword") : t("signIn.showPassword")}
            color={colors.muted}
            size={20}
            onPress={() => setShow((value) => !value)}
          />
        }
      />
      <Field
        label={t("setup.confirm")}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry={!show}
        autoComplete="new-password"
        textContentType="newPassword"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={{ gap: 8 }}>
        {rules.map((rule) => (
          <Rule key={rule.label} met={rule.met} label={rule.label} />
        ))}
      </View>
      <Spacer />
      <Button
        title={mode === "reset" ? t("setup.savePassword") : t("setup.createAccount")}
        full
        disabled={!ok}
        onPress={() => toast.show(t("setup.comingSoon"), { icon: "info" })}
      />
    </>
  );
}

const STEP_SCREENS = { 1: EidStep, 2: CodeStep, 3: PasswordStep } as const;

function SetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ step: string; mode?: string; eid?: string }>();
  const step = Number(params.step);
  const mode: Mode = params.mode === "reset" ? "reset" : "setup";
  const eid = typeof params.eid === "string" ? params.eid : "";

  if (step !== 1 && step !== 2 && step !== 3) {
    return (
      <Redirect
        href={{ pathname: "/setup/[step]", params: mode === "reset" ? { step: "1", mode } : { step: "1" } }}
      />
    );
  }

  const Step = STEP_SCREENS[step];
  const next = (more: { eid?: string }) => {
    const carried = more.eid ?? eid;
    router.push({
      pathname: "/setup/[step]",
      params: {
        step: String(step + 1),
        ...(mode === "reset" ? { mode } : {}),
        ...(carried ? { eid: carried } : {}),
      },
    });
  };
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(mode === "reset" ? "/sign-in" : "/welcome");
  };

  return (
    <Page bottomInset scrollToTopKey={step}>
      <Body fill gap={18}>
        <ScreenHeader onBack={back} />
        <StepBar step={step} />
        <Step mode={mode} eid={eid} next={next} />
      </Body>
    </Page>
  );
}

export default function Setup() {
  return (
    <SignedOutOnly>
      <SetupScreen />
    </SignedOutOnly>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: "row", gap: 6 },
  stepSegment: { flex: 1, height: 6, borderRadius: radius.pill },
  rule: { flexDirection: "row", alignItems: "center", gap: 8 },
  ruleMark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
