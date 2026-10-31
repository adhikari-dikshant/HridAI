import { Children } from 'react';
import { Text, type TextProps } from 'react-native';

import { DevanagariFamily, FontFamily, Palette } from '@/constants/theme';

type Weight = keyof typeof FontFamily;

export type AppTextProps = TextProps & {
  size?: number;
  /** Line height in px. Omit for the font's normal line height. */
  leading?: number;
  weight?: Weight;
  color?: string;
  /** Letter spacing in px. */
  tracking?: number;
  align?: 'left' | 'center' | 'right';
};

const DEVANAGARI = /[ऀ-ॿ]/;

/** Outfit has no Devanagari glyphs, so Hindi text switches to Noto Sans Devanagari. */
export function AppText({
  size = 15,
  leading,
  weight = 'regular',
  color = Palette.ink,
  tracking,
  align,
  style,
  children,
  ...rest
}: AppTextProps) {
  const hindi = Children.toArray(children).some(
    (child) => typeof child === 'string' && DEVANAGARI.test(child)
  );

  return (
    <Text
      style={[
        {
          fontFamily: hindi ? DevanagariFamily[weight] : FontFamily[weight],
          fontSize: size,
          lineHeight: leading,
          color,
          letterSpacing: tracking,
          textAlign: align,
        },
        style,
      ]}
      {...rest}>
      {children}
    </Text>
  );
}
