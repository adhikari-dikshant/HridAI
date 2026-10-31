/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** HridAI design tokens, named as in the Figma file. The design is light-only. */
export const Palette = {
  bg: '#f7f6f3',
  surface: '#ffffff',
  surface2: '#efede8',
  line: '#e5e0dc',
  ink: '#241c20',
  ink2: '#635c61',
  ink3: '#797278',
  brand: '#e12c40',
  brandSoft: '#fbe9eb',
  brandDeep: '#8b1d31',
  ok: '#1f8a55',
  okSoft: '#e2f3e9',
  warn: '#b36a00',
  warnSoft: '#fcefd6',
  neutral: '#5f6068',
  neutralSoft: '#e9e9ec',
  onDark: '#ffffff',
  night: '#100a0c',
} as const;

/** Loaded in the root layout. Weight is picked by family, not fontWeight. */
export const FontFamily = {
  light: 'Outfit_300Light',
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
} as const;

export const DevanagariFamily: Record<keyof typeof FontFamily, string> = {
  light: 'NotoSansDevanagari_300Light',
  regular: 'NotoSansDevanagari_400Regular',
  medium: 'NotoSansDevanagari_500Medium',
  semibold: 'NotoSansDevanagari_600SemiBold',
};

export const Shadow = {
  card: '0px 3px 14px 0px rgba(52, 35, 44, 0.04)',
  button: '0px 5px 7px 0px rgba(175, 24, 59, 0.16)',
} as const;

/** Night gradient behind the countdown and recording screens. */
export const NightGradient = 'linear-gradient(180deg, #3a0d15 0%, #100a0c 100%)';

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
