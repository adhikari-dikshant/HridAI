import { getRecordingPermissionsAsync } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Art } from '@/components/art';
import { Button } from '@/components/button';
import { Card, CardRow } from '@/components/card';
import { Note } from '@/components/note';
import { Screen } from '@/components/screen';
import { Palette } from '@/constants/theme';
import { useScreening } from '@/state/screening';

const STEPS = ['mic.step1', 'mic.step2', 'mic.step3'] as const;

export default function MicAccessScreen() {
  const { t } = useScreening();
  const { location } = useLocalSearchParams<{ location?: string }>();

  // Coming back from Settings with the mic switched on goes straight to recording.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || !location) return;
      const permission = await getRecordingPermissionsAsync();
      if (permission.granted) router.replace({ pathname: '/record', params: { location } });
    });
    return () => subscription.remove();
  }, [location]);

  return (
    <Screen
      title={t('guide.title')}
      gap={20}
      footer={
        <>
          <Button label={t('mic.open')} onPress={() => Linking.openSettings()} />
          <Button label={t('mic.notNow')} variant="ghost" onPress={() => router.back()} />
        </>
      }>
      <View style={styles.hero}>
        <View style={styles.icon}>
          <Art name="icon-micoff-large" box={36} />
        </View>
        <AppText size={28} leading={34} weight="medium" tracking={-0.448} align="center">
          {t('mic.title')}
        </AppText>
        <AppText size={15} leading={22} color={Palette.ink2} align="center">
          {t('mic.body')}
        </AppText>
      </View>

      <Card variant="list" title={t('mic.steps')}>
        {STEPS.map((step, i) => (
          <CardRow
            key={step}
            leading={
              <View style={styles.number}>
                <AppText size={13} weight="semibold">
                  {i + 1}
                </AppText>
              </View>
            }
            title={t(step)}
            titleWeight="regular"
            divider={i < STEPS.length - 1}
          />
        ))}
      </Card>

      <Note text={t('mic.note')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 24,
    paddingBottom: 4,
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.neutralSoft,
  },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surface2,
  },
});
