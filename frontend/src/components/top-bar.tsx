import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { Art } from './art';

import { Palette } from '@/constants/theme';
import { useScreening } from '@/state/screening';

type TopBarProps = {
  title: string;
  /** Defaults to going back one screen. */
  onBack?: () => void;
  hideBack?: boolean;
};

export function TopBar({ title, onBack, hideBack = false }: TopBarProps) {
  const { t } = useScreening();

  return (
    <View style={styles.bar}>
      {hideBack ? (
        <View style={styles.slot} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          hitSlop={8}
          onPress={onBack ?? (() => router.back())}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Art name="icon-back" box={20} />
        </Pressable>
      )}
      <AppText size={17} weight="medium" align="center" numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
      <View style={styles.slot} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 56,
    paddingHorizontal: 24,
    paddingVertical: 6,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 0.75,
    borderColor: Palette.line,
    backgroundColor: Palette.surface,
  },
  pressed: {
    opacity: 0.6,
  },
  title: {
    flex: 1,
  },
  slot: {
    width: 44,
    height: 44,
  },
});
