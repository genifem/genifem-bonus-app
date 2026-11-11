import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import type { TextInput } from "react-native";

import { SignedOutOnly } from "@/components/Gate";
import { Body, Button, colors, Field, IconButton, Page, ScreenHeader, ScreenTitle, TextLink } from "@/components/ui";
import { api } from "@/lib/api";
import { type TokenOut, useAuth } from "@/lib/auth";
import { EID_MAX, isEid, normaliseEid, PASSWORD_MAX } from "@/lib/credentials";
import { type Problem, say, signInProblem } from "@/lib/errors";
import { useSecondsUntil } from "@/lib/useCountdown";

/**
 * CR-02: Employee ID and password (`POST /auth/login`). A wrong EID, a wrong password and an
 * account that was never set up all fail with one sentence, so nothing tells anyone which
 * EIDs exist. The fifth wrong password locks sign-in for 15 minutes (CR-07), and the message
 * counts the minutes down; a terminated account is told so, but only after the right
 * password (CR-09).
 *
 * A success saves the session, and the gate takes a GM to the manager tabs and everyone else
 * to the crew tabs (CR-08), so this screen never navigates after it.
 */
function SignInScreen() {
  const { t, signedIn } = useAuth();
  const router = useRouter();
  const [eid, setEid] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordInput = useRef<TextInput>(null);

  const secondsLeft = useSecondsUntil(problem?.until ?? null);
  const message = say(t, problem, secondsLeft);
  const ready = isEid(eid) && password.length > 0;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const tokens = await api<TokenOut>("/auth/login", {
        method: "POST",
        body: { eid, password },
        anonymous: true,
      });
      await signedIn(tokens);
    } catch (err) {
      setProblem(signInProblem(err, Date.now()));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page bottomInset>
      <Body gap={18}>
        <ScreenHeader
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))}
        />
        <ScreenTitle title={t("signIn.title")} />
        <Field
          label={t("signIn.eid")}
          value={eid}
          onChangeText={(text) => {
            setEid(normaliseEid(text));
            setProblem(null);
          }}
          numeric
          invalid={problem?.code === "credentials_invalid"}
          maxLength={EID_MAX}
          autoComplete="username"
          textContentType="username"
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="next"
          onSubmitEditing={() => passwordInput.current?.focus()}
          submitBehavior="submit"
        />
        <Field
          ref={passwordInput}
          label={t("signIn.password")}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setProblem(null);
          }}
          error={message ?? undefined}
          secureTextEntry={!show}
          maxLength={PASSWORD_MAX}
          autoComplete="current-password"
          textContentType="password"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
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
        <TextLink
          title={t("signIn.forgot")}
          onPress={() => router.push({ pathname: "/setup/[step]", params: { step: "1", mode: "reset" } })}
        />
        <Button title={t("signIn.submit")} full disabled={!ready} busy={busy} onPress={() => void submit()} />
      </Body>
    </Page>
  );
}

export default function SignIn() {
  return (
    <SignedOutOnly>
      <SignInScreen />
    </SignedOutOnly>
  );
}
