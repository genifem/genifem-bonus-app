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

import { colors, ToastProvider } from "@/components/ui";
import { AuthProvider, homeGroupFor, useAuth } from "@/lib/auth";
import { MeProvider } from "@/lib/me";

void SplashScreen.preventAutoHideAsync();

/**
 * Which screens exist depends on who is signed in (CR-08), so the stack guards them rather
 * than redirecting between them. Signing in removes the welcome, sign-in and setup screens
 * from the history, so Android's back button can't return to them; signing out (or a
 * session the server ended) removes the tabs the same way. Each guard lists the first screen
 * of its group first: that is where the app opens for someone in it.
 *
 * Nothing is drawn until the saved session has been read, behind the splash screen, so a
 * signed-in person never sees the welcome screen flash by.
 */
function RootStack() {
  const { ready, me } = useAuth();

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  const home = me ? homeGroupFor(me) : null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={home === "crew"}>
        <Stack.Screen name="(crew)" />
      </Stack.Protected>
      <Stack.Protected guard={home === "manager"}>
        <Stack.Screen name="(manager)" />
      </Stack.Protected>
      <Stack.Protected guard={home === null}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="setup" />
      </Stack.Protected>
    </Stack>
  );
}

/**
 * Every screen draws its own header, as the prototype does, so the stack shows none. The
 * crew's and the GM's tabs are route groups under this stack; the welcome, sign-in and setup
 * screens sit beside them.
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
            <StatusBar style="dark" />
            <RootStack />
          </ToastProvider>
        </MeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
