import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Palette } from '@/constants/theme';
import { useScreening } from '@/state/screening';

export default function NotFoundScreen() {
  const { t } = useScreening();

  return (
    <Screen
      centered
      hideBack
      title={t('notFound.title')}
      footer={<Button label={t('notFound.home')} onPress={() => router.replace('/')} />}>
      <View style={styles.copy}>
        <AppText size={28} leading={34} weight="medium" tracking={-0.448} align="center">
          {t('notFound.heading')}
        </AppText>
        <AppText size={15} leading={22} color={Palette.ink2} align="center">
          {t('notFound.body')}
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
