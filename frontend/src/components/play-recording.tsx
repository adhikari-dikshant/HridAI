import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { IconTile } from './icon-tile';

import { Palette } from '@/constants/theme';
import { useScreening } from '@/state/screening';

// How close to the end counts as finished, in seconds.
const END_MARGIN_S = 0.1;

/** Plays the recording saved on this phone. Heart sounds are too low for most phone speakers. */
export function PlayRecording({ uri }: { uri: string }) {
  const { t } = useScreening();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  async function toggle() {
    if (status.playing) {
      player.pause();
      return;
    }
    const finished = status.duration > 0 && status.currentTime >= status.duration - END_MARGIN_S;
    if (finished) await player.seekTo(0);
    player.play();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(status.playing ? 'quality.pause' : 'quality.listen')}
      onPress={() => void toggle()}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <IconTile icon={status.playing ? 'icon-pause' : 'icon-play'} background={Palette.brandSoft} />
      <View style={styles.text}>
        <AppText size={15} weight="medium">
          {t(status.playing ? 'quality.pause' : 'quality.listen')}
        </AppText>
        <AppText size={12} color={Palette.ink3}>
          {t('quality.earphones')}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: Palette.surface,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
