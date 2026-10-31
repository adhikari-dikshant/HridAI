import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { Art, type ArtworkName } from './art';

import { Palette } from '@/constants/theme';

type NoteProps = {
  text: string;
  icon?: ArtworkName;
  /** muted: grey box. alert: brand-soft box with bold text. plain: no box. */
  tone?: 'muted' | 'alert' | 'plain';
};

export function Note({ text, icon = 'icon-info-muted', tone = 'muted' }: NoteProps) {
  const alert = tone === 'alert';
  return (
    <View style={[styles.note, styles[tone]]}>
      <Art name={alert ? 'icon-alert-brand' : icon} box={18} />
      <AppText
        size={alert ? 13 : tone === 'plain' ? 13 : 14}
        leading={alert ? 18 : tone === 'plain' ? 19 : 20}
        weight={alert ? 'medium' : 'regular'}
        color={alert ? Palette.ink : Palette.ink2}
        style={styles.text}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  muted: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: Palette.surface2,
  },
  alert: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: Palette.brandSoft,
  },
  plain: {},
  text: {
    flex: 1,
  },
});
