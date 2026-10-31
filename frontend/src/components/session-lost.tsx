import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { Button } from './button';
import { Screen } from './screen';

import { Palette } from '@/constants/theme';
import { useScreening } from '@/state/screening';

/** Shown when a screen needs a screening in progress and none exists, e.g. after a restart. */
export function SessionLost() {
  const { t } = useScreening();

  return (
    <Screen
      centered
      hideBack
      footer={<Button label={t('sessionLost.restart')} onPress={() => router.replace('/patients')} />}>
      <View style={styles.copy}>
        <AppText size={28} leading={34} weight="medium" tracking={-0.448} align="center">
          {t('sessionLost.heading')}
        </AppText>
        <AppText size={15} leading={22} color={Palette.ink2} align="center">
          {t('sessionLost.body')}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: {
    gap: 8,
  },
});
