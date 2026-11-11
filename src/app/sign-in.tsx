import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import type { TextInput } from "react-native";

import { SignedOutOnly } from "@/components/Gate";
import { Body, Button, colors, Field, IconButton, Page, ScreenHeader, ScreenTitle, TextLink } from "@/components/ui";
import { api } from "@/lib/api";
import { type Tokens, useAuth } from "@/lib/auth";
import { explainSignIn } from "@/lib/errors";

/**
 * CR-02: Employee ID and password. A failure says one thing whatever went wrong, so it never
 * tells anyone which EIDs exist. `POST /auth/login` arrives with the API in phase P1; until
 * then every attempt ends in that same message.
 */
function SignInScreen() {
  const { t, signedIn } = useAuth();
  const router = useRouter();
  const [eid, setEid] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordInput = useRef<TextInput>(null);

  const ready = eid.length > 0 && password.length > 0;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const tokens = await api<Tokens>("/auth/login", {
        method: "POST",
        body: { eid, password },
        anonymous: true,
      });
      // The session reloads and the gate takes the person to their tabs.
      await signedIn(tokens);
    } catch (err) {
      setError(explainSignIn(t, err));
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
            setEid(text.replace(/\D/g, ""));
            setError(null);
          }}
          numeric
          invalid={!!error}
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete="username"
          textContentType="username"
          autoCapitalize="none"
          autoCorrect={false}
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
            setError(null);
          }}
          error={error ?? undefined}
          secureTextEntry={!show}
          autoComplete="current-password"
          textContentType="password"
          autoCapitalize="none"
          autoCorrect={false}
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
