import {
  NotoSansDevanagari_300Light,
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_600SemiBold,
} from '@expo-google-fonts/noto-sans-devanagari';
import {
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  useFonts,
} from '@expo-google-fonts/outfit';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Palette } from '@/constants/theme';
import { AuthProvider } from '@/state/auth';
import { ScreeningProvider } from '@/state/screening';

SplashScreen.preventAutoHideAsync();

// The design is light-only; screens draw their own top bars.
const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: Palette.bg, primary: Palette.brand },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    NotoSansDevanagari_300Light,
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_500Medium,
    NotoSansDevanagari_600SemiBold,
  });

  // Keep the native splash up until fonts are ready; fall back to system fonts on error.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={theme}>
        <AuthProvider>
          <ScreeningProvider>
            <AnimatedSplashOverlay />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="record" options={{ gestureEnabled: false }} />
              <Stack.Screen name="analyzing" options={{ gestureEnabled: false }} />
            </Stack>
          </ScreeningProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
