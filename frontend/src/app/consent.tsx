import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Art } from '@/components/art';
import { Button } from '@/components/button';
import { Card, CardRow } from '@/components/card';
import { IconTile } from '@/components/icon-tile';
import { Screen } from '@/components/screen';
import { StepProgress } from '@/components/step-progress';
import { Palette } from '@/constants/theme';
import { useScreening } from '@/state/screening';

const POINTS = [
  { icon: 'icon-mic', title: 'consent.sounds', body: 'consent.soundsBody' },
  { icon: 'icon-lock', title: 'consent.essentials', body: 'consent.essentialsBody' },
  { icon: 'icon-trash', title: 'consent.choice', body: 'consent.choiceBody' },
] as const;

export default function ConsentScreen() {
  const { t } = useScreening();
  const [agreed, setAgreed] = useState(false);

  return (
    <Screen
      title={t('consent.title')}
      footer={
        <>
          <Button
            label={t('consent.continue')}
            disabled={!agreed}
            onPress={() => router.push('/patient')}
          />
          <Pressable
            accessibilityRole="link"
            hitSlop={8}
            onPress={() => Alert.alert(t('consent.policyTitle'), t('consent.body'))}
            style={({ pressed }) => [styles.policy, pressed && styles.pressed]}>
            <AppText size={13} weight="medium" color={Palette.ink2}>
              {t('consent.policy')}
            </AppText>
          </Pressable>
        </>
      }>
      <StepProgress step={1} name={t('consent.title')} />

      <AppText size={28} leading={34} weight="medium" tracking={-0.448}>
        {t('consent.heading')}
      </AppText>

      <View style={styles.notice}>
        <Art name="icon-info" box={22} />
        <View style={styles.noticeText}>
          <AppText size={16} weight="semibold">
            {t('consent.notice')}
          </AppText>
          <AppText size={14} leading={20} color={Palette.ink2}>
            {t('consent.noticeBody')}
          </AppText>
        </View>
      </View>

      <Card variant="list" style={styles.points}>
        {POINTS.map((point, i) => (
          <CardRow
            key={point.title}
            leading={
              <IconTile icon={point.icon} size={40} iconBox={20} background={Palette.brandSoft} />
            }
            title={t(point.title)}
            subtitle={t(point.body)}
            dense={false}
            divider={i < POINTS.length - 1}
          />
        ))}
      </Card>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        onPress={() => setAgreed(!agreed)}
        style={[styles.agree, agreed && styles.agreeOn]}>
        <View style={[styles.box, agreed && styles.boxOn]}>
          {agreed && <Art name="icon-check-white" box={16} />}
        </View>
        <AppText size={14} leading={20} style={styles.flex}>
          {t('consent.agree')}
        </AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: Palette.brandSoft,
  },
  noticeText: {
    flex: 1,
    gap: 4,
  },
  points: {
    paddingTop: 2,
    paddingBottom: 2,
  },
  agree: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Palette.line,
    backgroundColor: Palette.surface,
  },
  agreeOn: {
    borderColor: Palette.ink,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Palette.ink3,
  },
  boxOn: {
    borderColor: Palette.ink,
    backgroundColor: Palette.ink,
  },
  flex: {
    flex: 1,
  },
  policy: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  pressed: {
    opacity: 0.6,
  },
});
