import { Nunito_400Regular } from "@expo-google-fonts/nunito/400Regular";
import { Nunito_600SemiBold } from "@expo-google-fonts/nunito/600SemiBold";
import { Nunito_700Bold } from "@expo-google-fonts/nunito/700Bold";
import { Nunito_800ExtraBold } from "@expo-google-fonts/nunito/800ExtraBold";
import { Nunito_900Black } from "@expo-google-fonts/nunito/900Black";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { CompanyPaused, OfflineStart } from "@/components/Gate";
import { colors, ToastProvider } from "@/components/ui";
import { AuthProvider, useAuth } from "@/lib/auth";
import { placeFor } from "@/lib/guards";
import { MeProvider } from "@/lib/me";
import { PushProvider } from "@/lib/usePush";

void SplashScreen.preventAutoHideAsync();

/**
 * Which screens exist depends on the company and on who is signed in (P7, CR-08), so the
 * stack guards them rather than redirecting between them (guards.ts `placeFor`), in this
 * order: no company, the company screen alone; a company but nobody signed in, the welcome,
 * sign-in and setup screens; signed in, the person's own tabs. Choosing a company, signing in,
 * signing out, changing company or a session the server ended each turn one guard off and
 * another on: the stack drops the screens that went (so Android's back button can't return
 * to them) and opens the first one allowed. Each guard lists the first screen of its group
 * first: that is where the app opens for someone in it. A deep link or a tapped push can only
 * land on a screen its guard allows.
 *
 * Nothing is drawn until the company and the saved session have been read, behind the splash
 * screen, so nobody sees the wrong screen flash by. With no connection the session is kept
 * and the person's own tabs open on the profile last seen; only a phone that has never kept
 * one waits on a calm offline screen instead of the welcome screen. A paused company covers
 * everything with the paused screen, which has no stack behind it to slip into.
 */
function RootStack() {
  const { ready, company, me, offline, paused } = useAuth();
  const place = placeFor({ ready, company: company?.code ?? null, me, offline, paused });

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (place === "loading") return null;
  if (place === "paused") return <CompanyPaused />;
  if (place === "offline") return <OfflineStart />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={place === "crew"}>
        <Stack.Screen name="(crew)" />
      </Stack.Protected>
      <Stack.Protected guard={place === "manager"}>
        <Stack.Screen name="(manager)" />
      </Stack.Protected>
      <Stack.Protected guard={place === "signedOut"}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="setup" />
      </Stack.Protected>
      <Stack.Protected guard={place === "company"}>
        <Stack.Screen name="company" />
      </Stack.Protected>
    </Stack>
  );
}

/**
 * Every screen draws its own header, as the prototype does, so the stack shows none. The
 * crew's and the GM's tabs are route groups under this stack; the company, welcome, sign-in
 * and setup screens sit beside them. Push (usePush) sits inside the session and the summary: it
 * registers whoever is signed in and opens a tapped push's screen in their own group.
 */
export default function RootLayout() {
  // Only the weights the prototype loads: Nunito 400, 600, 700, 800 and 900.
  const [loaded, error] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  // A font that fails to load falls back to the system face rather than blocking the app.
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <MeProvider>
          <ToastProvider>
            <PushProvider>
              <StatusBar style="dark" />
              <RootStack />
            </PushProvider>
          </ToastProvider>
        </MeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
