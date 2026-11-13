import type { Schemas } from "@crewstars/api-client";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, type TextInput, View } from "react-native";

import { OtpInput } from "@/components/OtpInput";
import {
  Alert,
  Body,
  Button,
  colors,
  Field,
  Icon,
  IconButton,
  Page,
  radius,
  ScreenHeader,
  ScreenTitle,
  Spacer,
  T,
  TextLink,
  useToast,
} from "@/components/ui";
import { api } from "@/lib/api";
import { type TokenOut, useAuth } from "@/lib/auth";
import {
  EID_MAX,
  isEid,
  normaliseEid,
  PASSWORD_MAX,
  PASSWORD_MIN,
  passwordChecks,
  passwordReady,
} from "@/lib/credentials";
import { type Problem, say, setupProblem } from "@/lib/errors";
import { canEnter, codeOnItsWay, flowActionFor, type Purpose } from "@/lib/setupFlow";
import { formatCountdown, useSecondsUntil } from "@/lib/useCountdown";
import { useSetupFlow } from "@/lib/useSetupFlow";

/**
 * CR-03 to CR-06: first-time setup in three steps (the EID, the texted code, a password), and
 * the same steps with other titles for "Forgot password?" (`?mode=reset`).
 *
 * The steps share their state through the setup layout's flow (lib/setupFlow.ts), never the
 * URL: only the step and the mode are in it. A step reached without what it needs (a deep
 * link, a reload on the web) starts again at step 1.
 */

type SetupStartOut = Schemas["SetupStartOut"];
type SetupVerifyOut = Schemas["SetupVerifyOut"];

const STEPS = 3;
const CODE_LENGTH = 6;

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

/* ---------------------------------------------------------------- step 1: the EID */

function EidStep({ purpose, onSent }: { purpose: Purpose; onSent: () => void }) {
  const { t } = useAuth();
  const { flow, dispatch } = useSetupFlow();
  const [eid, setEid] = useState(flow.eid);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const secondsLeft = useSecondsUntil(problem?.until ?? null);
  const message = say(t, problem, secondsLeft);
  const ready = isEid(eid);

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const sent = await api<SetupStartOut>("/auth/setup/start", {
        method: "POST",
        body: { eid, purpose },
        anonymous: true,
      });
      // The same answer for every EID (P6 security review): whether a text went out is only
      // known to the phone it went to.
      dispatch({
        type: "sent",
        eid,
        purpose,
        expiresInS: sent.expires_in_s,
        resendAfterS: sent.resend_after_s,
        now: Date.now(),
      });
      onSent();
    } catch (err) {
      const found = setupProblem(t, err, Date.now());
      if (found.code === "resend_too_soon" && codeOnItsWay(flow, eid, purpose)) {
        // Back from step 2 and Continue again: the code sent moments ago still works.
        const wait = flowActionFor(found);
        if (wait) dispatch(wait);
        onSent();
      } else {
        setProblem(found);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ScreenTitle title={purpose === "reset" ? t("setup.titleReset") : t("setup.titleSetup")} />
      <Field
        label={t("setup.eid")}
        hint={t("setup.eidHint")}
        error={message ?? undefined}
        value={eid}
        onChangeText={(text) => {
          setEid(normaliseEid(text));
          setProblem(null);
        }}
        numeric
        maxLength={EID_MAX}
        autoComplete="username"
        textContentType="username"
        autoCapitalize="characters"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="next"
        onSubmitEditing={() => void submit()}
      />
      <Spacer />
      <Button
        title={t("common.continue")}
        iconRight="chev"
        full
        disabled={!ready}
        busy={busy}
        onPress={() => void submit()}
      />
    </>
  );
}

/* ---------------------------------------------------------------- step 2: the texted code */

function CodeStep({ onVerified }: { onVerified: () => void }) {
  const { t } = useAuth();
  const toast = useToast();
  const { flow, dispatch } = useSetupFlow();
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  // Each is null until its first tick, which is read as "not over yet".
  const resendLeft = useSecondsUntil(flow.resendAt);
  const expiresLeft = useSecondsUntil(flow.codeExpiresAt);
  const lockLeft = useSecondsUntil(flow.lock?.until ?? null);

  const verified = flow.setupToken !== null;
  const lockMessage = say(t, flow.lock, lockLeft);
  const locked = lockMessage !== null;
  // A lock throws the code away too, so once it lifts there is nothing left to type in.
  const expired = !verified && !locked && (flow.codeExpiresAt === null || expiresLeft === 0);
  const waiting = flow.resendAt !== null && resendLeft !== 0;
  const canResend = !waiting && !locked && !sending && !busy;
  const ready = verified || (code.length === CODE_LENGTH && !locked && !expired);

  // One message at a time, the most pressing first.
  const problemMessage = say(t, problem, null);
  const notice: { text: string; kind: "error" | "warning" } | null = lockMessage
    ? { text: lockMessage, kind: "error" }
    : problemMessage
      ? { text: problemMessage, kind: "error" }
      : expired
        ? { text: t("errors.code_expired"), kind: "warning" }
        : null;

  const fail = (err: unknown): Problem => {
    const found = setupProblem(t, err, Date.now());
    const action = flowActionFor(found);
    // A lock, a wait or a spent code shows from the flow itself, so it is not said twice.
    if (action) dispatch(action);
    else setProblem(found);
    return found;
  };

  const verify = async () => {
    if (!ready || busy) return;
    if (verified) {
      // Back from step 3: the code has been checked already, and works only once.
      onVerified();
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const out = await api<SetupVerifyOut>("/auth/setup/verify", {
        method: "POST",
        body: { eid: flow.eid, code },
        anonymous: true,
      });
      dispatch({ type: "verified", setupToken: out.setup_token });
      onVerified();
    } catch (err) {
      // A wrong, expired or locked code is cleared for the next one; a dead connection
      // keeps what was typed, to send again.
      if (fail(err).code.startsWith("code_")) setCode("");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!canResend) return;
    setSending(true);
    setProblem(null);
    try {
      const sent = await api<SetupStartOut>("/auth/setup/start", {
        method: "POST",
        body: { eid: flow.eid, purpose: flow.purpose },
        anonymous: true,
      });
      dispatch({
        type: "sent",
        eid: flow.eid,
        purpose: flow.purpose,
        expiresInS: sent.expires_in_s,
        resendAfterS: sent.resend_after_s,
        now: Date.now(),
      });
      setCode("");
      toast.show(t("setup.codeResent"));
    } catch (err) {
      fail(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <View style={{ gap: 4 }}>
        <ScreenTitle title={t("setup.codeTitle")} />
        {/* "If": the API answers every EID alike and never shows the phone's digits (P6
            security review), so this screen can't know whether a text went out. */}
        <T size={13} color={colors.muted}>
          {t("setup.codeSent")}
        </T>
      </View>
      <OtpInput
        value={code}
        length={CODE_LENGTH}
        onChange={(next) => {
          setCode(next);
          setProblem(null);
        }}
        label={t("setup.codeLabel")}
        invalid={problem?.code === "code_invalid"}
        disabled={locked}
        onSubmit={() => void verify()}
      />
      {notice ? <Alert kind={notice.kind}>{notice.text}</Alert> : null}
      <TextLink
        role="button"
        title={
          waiting && resendLeft !== null
            ? t("setup.resendIn", { time: formatCountdown(resendLeft) })
            : t("setup.resend")
        }
        disabled={!canResend}
        onPress={() => void resend()}
      />
      <Spacer />
      <Button
        title={t("common.continue")}
        iconRight="chev"
        full
        disabled={!ready}
        busy={busy}
        onPress={() => void verify()}
      />
    </>
  );
}

/* ---------------------------------------------------------------- step 3: the password */

/**
 * One line of the checklist. It is a live region, so Android and the web read a line out when
 * it turns done or undone; iOS has no live regions, so there the change is announced.
 */
function Rule({ met, label }: { met: boolean; label: string }) {
  const { t } = useAuth();
  const spoken = `${label}, ${met ? t("setup.met") : t("setup.notMet")}`;
  const was = useRef(met);
  useEffect(() => {
    if (was.current === met) return;
    was.current = met;
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(spoken);
  }, [met, spoken]);
  return (
    <View
      accessible
      accessibilityLabel={spoken}
      accessibilityLiveRegion="polite"
      aria-live="polite"
      style={styles.rule}
    >
      <View style={[styles.ruleMark, { backgroundColor: met ? colors.success : colors.track }]}>
        {met ? <Icon name="check" size={12} color={colors.brandFg} stroke={3.4} /> : null}
      </View>
      <T size={13} weight={700} color={met ? colors.successInk : colors.muted} style={{ flexShrink: 1 }}>
        {label}
      </T>
    </View>
  );
}

function PasswordStep({ onStartAgain }: { onStartAgain: () => void }) {
  const { t, signedIn } = useAuth();
  const { flow } = useSetupFlow();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const confirmInput = useRef<TextInput>(null);

  const checks = passwordChecks(password, confirm);
  const ready = passwordReady(checks) && flow.setupToken !== null;
  const reset = flow.purpose === "reset";
  const message = say(t, problem, null);
  const rules = [
    { key: "length", met: checks.length, label: t("setup.rules.length") },
    { key: "number", met: checks.number, label: t("setup.rules.number") },
    { key: "match", met: checks.match, label: t("setup.rules.match") },
  ];

  const edit = (set: (text: string) => void) => (text: string) => {
    set(text);
    // A spent or stale receipt stays spent whatever is typed; anything else may be fixed.
    if (!problem?.restart) setProblem(null);
  };

  const submit = async () => {
    const setupToken = flow.setupToken;
    if (!ready || busy || !setupToken || problem?.restart) return;
    setBusy(true);
    setProblem(null);
    try {
      const tokens = await api<TokenOut>("/auth/setup/complete", {
        method: "POST",
        body: { setup_token: setupToken, password },
        anonymous: true,
      });
      // Signed in: the gate takes the person to their tabs, and this flow goes with it.
      await signedIn(tokens);
    } catch (err) {
      setProblem(setupProblem(t, err, Date.now()));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ScreenTitle
        title={reset ? t("setup.passwordTitleReset") : t("setup.passwordTitleSetup")}
        lead={t("setup.passwordLead")}
      />
      <Field
        label={t("setup.password")}
        value={password}
        onChangeText={edit(setPassword)}
        secureTextEntry={!showPassword}
        maxLength={PASSWORD_MAX}
        autoComplete="new-password"
        textContentType="newPassword"
        passwordRules={`minlength: ${PASSWORD_MIN}; required: digit;`}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="next"
        onSubmitEditing={() => confirmInput.current?.focus()}
        submitBehavior="submit"
        accessory={
          <IconButton
            icon={showPassword ? "eyeOff" : "eye"}
            label={showPassword ? t("signIn.hidePassword") : t("signIn.showPassword")}
            color={colors.muted}
            size={20}
            onPress={() => setShowPassword((value) => !value)}
          />
        }
      />
      <Field
        ref={confirmInput}
        label={t("setup.confirm")}
        value={confirm}
        onChangeText={edit(setConfirm)}
        secureTextEntry={!showConfirm}
        maxLength={PASSWORD_MAX}
        autoComplete="new-password"
        textContentType="newPassword"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        accessory={
          <IconButton
            icon={showConfirm ? "eyeOff" : "eye"}
            label={showConfirm ? t("setup.hideConfirm") : t("setup.showConfirm")}
            color={colors.muted}
            size={20}
            onPress={() => setShowConfirm((value) => !value)}
          />
        }
      />
      <View style={{ gap: 8 }}>
        {rules.map((rule) => (
          <Rule key={rule.key} met={rule.met} label={rule.label} />
        ))}
      </View>
      {message ? <Alert>{message}</Alert> : null}
      <Spacer />
      {problem?.restart ? (
        <Button title={t("setup.startAgain")} full onPress={onStartAgain} />
      ) : (
        <Button
          title={reset ? t("setup.savePassword") : t("setup.createAccount")}
          full
          disabled={!ready}
          busy={busy}
          onPress={() => void submit()}
        />
      )}
    </>
  );
}

/* ---------------------------------------------------------------- the screen */

function isStep(value: number): value is 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3;
}

export default function SetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ step: string; mode?: string }>();
  const { flow, dispatch } = useSetupFlow();
  const step = Number(params.step);
  const purpose: Purpose = params.mode === "reset" ? "reset" : "setup";
  const mode = purpose === "reset" ? { mode: purpose } : {};
  // Checked as the step opens, not on every change: a step on its way out after "Start
  // again" must not send the person to step 1 a second time.
  const [allowed] = useState(() => isStep(step) && canEnter(flow, step));

  if (!allowed || !isStep(step)) {
    return <Redirect href={{ pathname: "/setup/[step]", params: { step: "1", ...mode } }} />;
  }

  const go = (to: 2 | 3) => router.push({ pathname: "/setup/[step]", params: { step: String(to), ...mode } });
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(purpose === "reset" ? "/sign-in" : "/welcome");
  };
  // The receipt is spent or stale (CR-03): back to step 1, which still holds the EID.
  const startAgain = () => {
    dispatch({ type: "restart" });
    router.dismissAll();
  };

  return (
    <Page bottomInset scrollToTopKey={step}>
      <Body fill gap={18}>
        <ScreenHeader onBack={back} />
        <StepBar step={step} />
        {step === 1 ? (
          <EidStep purpose={purpose} onSent={() => go(2)} />
        ) : step === 2 ? (
          <CodeStep onVerified={() => go(3)} />
        ) : (
          <PasswordStep onStartAgain={startAgain} />
        )}
      </Body>
    </Page>
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
