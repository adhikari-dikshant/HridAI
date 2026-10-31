import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from './app-text';

import { Palette, Shadow } from '@/constants/theme';

type CardProps = {
  children: ReactNode;
  /** Bold heading inside the card, e.g. "By chest spot". */
  title?: string;
  /** list: rows separated by lines, tight vertical padding. */
  variant?: 'padded' | 'list';
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, title, variant = 'padded', style }: CardProps) {
  const list = variant === 'list';
  return (
    <View style={[styles.card, list ? styles.list : styles.padded, style]}>
      {title && (
        <AppText size={16} weight="semibold">
          {title}
        </AppText>
      )}
      {children}
    </View>
  );
}

type CardRowProps = {
  leading: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  /** Draws the separator below the row. Off for the last row. */
  divider?: boolean;
  /** Medium title with a 13 px subtitle (consent rows) vs 12 px (spot rows). */
  dense?: boolean;
  titleColor?: string;
  titleWeight?: 'regular' | 'medium';
};

/** A row with an icon tile, two lines of text and an optional trailing tag. */
export function CardRow({
  leading,
  title,
  subtitle,
  trailing,
  divider = false,
  dense = true,
  titleColor = Palette.ink,
  titleWeight = 'medium',
}: CardRowProps) {
  return (
    <View style={[styles.row, divider && styles.divider]}>
      {leading}
      <View style={styles.rowText}>
        <AppText size={15} weight={titleWeight} color={titleColor}>
          {title}
        </AppText>
        {subtitle && (
          <AppText
            size={dense ? 12 : 13}
            leading={dense ? undefined : 18}
            color={dense ? Palette.ink3 : Palette.ink2}>
            {subtitle}
          </AppText>
        )}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    backgroundColor: Palette.surface,
    borderWidth: 0.65,
    borderColor: Palette.line,
    borderRadius: 20,
    boxShadow: Shadow.card,
  },
  padded: {
    gap: 12,
    padding: 16,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: Palette.line,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});
