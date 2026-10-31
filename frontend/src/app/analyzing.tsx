import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, errorMessage } from '@/api/client';
import { AppText } from '@/components/app-text';
import { Art } from '@/components/art';
import { Button } from '@/components/button';
import { Card, CardRow } from '@/components/card';
import { IconTile } from '@/components/icon-tile';
import { Screen } from '@/components/screen';
import { SessionLost } from '@/components/session-lost';
import { Palette } from '@/constants/theme';
import type { StringKey } from '@/i18n/strings';
import { useScreening } from '@/state/screening';

const STEPS: StringKey[] = ['analyzing.step1', 'analyzing.step2', 'analyzing.step3'];
// The API gives no progress, so the last step lights up after a typical model run.
const WRITING_AFTER_MS = 4000;

export default function AnalyzingScreen() {
  const { t, lang, session, setResult, clearLocalFiles } = useScreening();
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  // Guards against the effect running twice in development.
  const startedRef = useRef(false);

  const screeningId = session?.screening_id;

  async function analyze(id: string) {
    setError(null);
    try {
      const response = await api.analyze(id);
      setResult(response);
      clearLocalFiles();
      router.dismissAll();
      router.push('/result');
    } catch (cause) {
      setError(errorMessage(cause, lang));
    }
  }

  useEffect(() => {
    if (!screeningId || startedRef.current) return;
    startedRef.current = true;
    void analyze(screeningId);
  });

  useEffect(() => {
    const timer = setTimeout(() => setActiveStep(2), WRITING_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!screeningId) return <SessionLost />;

  return (
    <Screen
      centered
      gap={36}
      footer={
        error && (
          <>
            <Button label={t('retry')} onPress={() => analyze(screeningId)} />
            <Button label={t('cancel')} variant="ghost" onPress={() => router.back()} />
          </>
        )
      }>
      <View style={styles.inner}>
        <View style={styles.hero}>
          <Image
            source={require('@/assets/figma/hero-heart.png')}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <View style={styles.status}>
            <Art name="dot-listening" />
            <AppText size={10} weight="medium" color={Palette.onDark} tracking={0.5}>
              {t('analyzing.badge').toLocaleUpperCase()}
            </AppText>
          </View>
        </View>

        <View style={styles.copy}>
          <AppText size={26} weight="medium" tracking={-0.416} align="center">
            {t('analyzing.title')}
          </AppText>
          <AppText size={15} leading={22} color={Palette.ink2} align="center">
            {error ?? t('analyzing.line')}
          </AppText>
        </View>

        {!error && (
          <Card variant="list" style={styles.steps}>
            {STEPS.map((step, i) => {
              const done = i < activeStep;
              const active = i === activeStep;
              return (
                <CardRow
                  key={step}
                  leading={
                    <IconTile
                      round
                      size={26}
                      iconBox={14}
                      icon={done ? 'icon-check-ok-tiny' : active ? 'icon-dot-brand' : 'icon-dot-muted'}
                      background={done ? Palette.okSoft : active ? Palette.brandSoft : Palette.surface2}
                    />
                  }
                  title={t(step)}
                  titleColor={done || active ? Palette.ink : Palette.ink3}
                  titleWeight={active ? 'medium' : 'regular'}
                  divider={i < STEPS.length - 1}
                />
              );
            })}
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inner: {
    gap: 36,
    paddingHorizontal: 8,
    paddingTop: 40,
    paddingBottom: 8,
  },
  hero: {
    height: 292,
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  status: {
    position: 'absolute',
    left: 15,
    top: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.11)',
  },
  copy: {
    gap: 8,
  },
  steps: {
    paddingTop: 6,
    paddingBottom: 6,
  },
});
