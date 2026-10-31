import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { AppText } from './app-text';

import { Palette, Shadow } from '@/constants/theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  /**
   * primary: brand fill. ghost: text only. light: white fill on dark screens.
   * glass: translucent fill on dark screens.
   */
  variant?: 'primary' | 'ghost' | 'light' | 'glass';
  disabled?: boolean;
  loading?: boolean;
};

const LABEL_COLOR = {
  primary: Palette.onDark,
  ghost: Palette.ink2,
  light: Palette.ink,
  glass: Palette.onDark,
} as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: ButtonProps) {
  const inactive = disabled || loading;
  const color = LABEL_COLOR[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        (pressed || inactive) && styles.dimmed,
      ]}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <AppText size={16} weight="semibold" color={color} align="center">
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    paddingHorizontal: 24,
    borderRadius: 18,
  },
  primary: {
    backgroundColor: Palette.brand,
    boxShadow: Shadow.button,
  },
  ghost: {},
  light: {
    backgroundColor: Palette.onDark,
    boxShadow: Shadow.button,
  },
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dimmed: {
    opacity: 0.6,
  },
});
