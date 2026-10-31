import { Pressable, StyleSheet } from 'react-native';

import { AppText } from './app-text';
import { Art } from './art';

import { Palette } from '@/constants/theme';

type ChoiceChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/** Multi-select pill. Selected chips turn brand-soft with a tick. */
export function ChoiceChip({ label, selected, onPress }: ChoiceChipProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.idle,
        pressed && styles.pressed,
      ]}>
      {selected && <Art name="icon-check-brand-deep" box={14} />}
      <AppText size={14} weight="medium" color={selected ? Palette.brandDeep : Palette.ink}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  idle: {
    backgroundColor: Palette.surface,
    borderColor: Palette.line,
  },
  selected: {
    backgroundColor: Palette.brandSoft,
    borderColor: Palette.brandSoft,
  },
  pressed: {
    opacity: 0.7,
  },
});
