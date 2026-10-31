import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './app-text';

import { Palette, Shadow } from '@/constants/theme';

type Option<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

type SegmentedProps<T extends string> = {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** brand: selected segment is brand-soft (sex picker). plain: white (source picker). */
  tone?: 'brand' | 'plain';
  /** Compact pill toggle, e.g. EN / हिं on the result. */
  size?: 'regular' | 'small';
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  tone = 'plain',
  size = 'regular',
}: SegmentedProps<T>) {
  const small = size === 'small';

  return (
    <View accessibilityRole="radiogroup" style={[styles.track, small && styles.trackSmall]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            style={[
              small ? styles.segmentSmall : styles.segment,
              selected && (tone === 'brand' ? styles.selectedBrand : styles.selectedPlain),
              selected && small && styles.selectedSmall,
            ]}>
            {option.icon}
            <AppText
              size={small ? 12 : 15}
              weight={selected ? 'semibold' : 'medium'}
              color={
                selected ? (tone === 'brand' ? Palette.brandDeep : Palette.ink) : Palette.ink2
              }>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 14,
    backgroundColor: Palette.surface2,
  },
  trackSmall: {
    gap: 2,
    padding: 3,
    borderRadius: 10,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  selectedBrand: {
    backgroundColor: Palette.brandSoft,
    borderColor: 'rgba(214, 40, 76, 0.22)',
    boxShadow: Shadow.card,
  },
  selectedPlain: {
    backgroundColor: Palette.surface,
    borderColor: Palette.line,
    borderWidth: 0.65,
    boxShadow: Shadow.card,
  },
  selectedSmall: {
    borderWidth: 0,
    boxShadow: undefined,
  },
});
