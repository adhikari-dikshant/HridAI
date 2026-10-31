import { View } from 'react-native';

import { Art, type ArtworkName } from './art';

import { Palette } from '@/constants/theme';

type IconTileProps = {
  icon: ArtworkName;
  /** Tile edge in px. Corner radius follows Figma's 30% rule. */
  size?: number;
  /** Frame the icon is centred in. */
  iconBox?: number;
  background?: string;
  round?: boolean;
};

/** Rounded square (or circle) with a centred icon, used across list rows. */
export function IconTile({
  icon,
  size = 32,
  iconBox = 16,
  background = Palette.surface2,
  round = false,
}: IconTileProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: round ? size / 2 : size * 0.3,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Art name={icon} box={iconBox} />
    </View>
  );
}
