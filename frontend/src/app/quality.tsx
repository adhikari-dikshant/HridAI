import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { QualityIssue } from '@/api/types';
import { AppText } from '@/components/app-text';
import { Art, type ArtworkName } from '@/components/art';
import { Button } from '@/components/button';
import { Card, CardRow } from '@/components/card';
import { IconTile } from '@/components/icon-tile';
import { Note } from '@/components/note';
import { Screen } from '@/components/screen';
import { StepProgress } from '@/components/step-progress';
import { Spots, isSpot } from '@/constants/chest-locations';
import { Palette, Shadow } from '@/constants/theme';
import type { StringKey } from '@/i18n/strings';
import { Strings } from '@/i18n/strings';
import { hasAcceptedChest, useScreening } from '@/state/screening';

const ISSUES: QualityIssue[] = [
  'too_short',
  'too_quiet',
  'clipping',
  'too_noisy',
  'no_heartbeat_detected',
  'heart_rate_out_of_range',
];

const FIXES: { icon: ArtworkName; text: StringKey }[] = [
  { icon: 'icon-mute-small', text: 'quality.fix1' },
  { icon: 'icon-micoff-small', text: 'quality.fix2' },
  { icon: 'icon-phone-small', text: 'quality.fix3' },
];

function isIssue(value: unknown): value is QualityIssue {
  return ISSUES.includes(value as QualityIssue);
}

export default function QualityScreen() {
  const { t, lang, session } = useScreening();
  // `issue` is set when the phone's own check rejected the recording before upload.
  const params = useLocalSearchParams<{ location?: string; issue?: string }>();

  if (!session || !isSpot(params.location)) return <Redirect href="/" />;

  const location = params.location;
  const recording = session.recordings[location];
  const localIssue = isIssue(params.issue) ? params.issue : null;
  if (!localIssue && !recording) return <Redirect href="/" />;

  const spot = Spots[location][lang];
  const recordAgain = () => router.replace({ pathname: '/record', params: { location } });
  const skipNeck = (
    <Button
      label={t('guide.skipNeck')}
      variant="ghost"
      onPress={() => router.push('/reports')}
    />
  );

  if (localIssue || !recording?.accepted) {
    const issue = localIssue ?? recording?.quality.issues[0] ?? 'too_noisy';
    // Local checks only cover these two; their copy lives in the app.
    const local = localIssue === 'too_short' || localIssue === 'clipping';
    const messageEn = local
      ? Strings.en[`record.${localIssue}`]
      : (recording?.message_en ?? Strings.en.genericError);
    const messageHi = local
      ? Strings.hi[`record.${localIssue}`]
      : (recording?.message_hi ?? Strings.hi.genericError);

    return (
      <Screen
        title={t('quality.title')}
        gap={12}
        footer={
          <>
            <Button label={t('quality.recordAgain')} onPress={recordAgain} />
            <Button
              label={t('quality.seeGuide')}
              variant="ghost"
              onPress={() => router.replace({ pathname: '/guide', params: { location } })}
            />
            {location === 'NK' && hasAcceptedChest(session) && skipNeck}
          </>
        }>
        <StepProgress step={3} name={t('guide.step')} />

        <View style={styles.hero}>
          <View style={[styles.badge, styles.badgeSmall, styles.badgeWarn]}>
            <Art name="icon-mute-warn-large" box={40} />
          </View>
          <AppText size={28} weight="medium" tracking={-0.448} align="center">
            {t(location === 'NK' && issue === 'too_quiet' ? 'issue.neck_too_quiet' : `issue.${issue}`)}
          </AppText>
          <AppText size={15} leading={22} color={Palette.ink2} align="center">
            {lang === 'hi' ? messageHi : messageEn}
          </AppText>
          <AppText size={13} leading={20} color={Palette.ink3} align="center">
            {lang === 'hi' ? messageEn : messageHi}
          </AppText>
        </View>

        <Note text={t('quality.notYourHeart')} />

        <Card title={t('quality.fixes')}>
          {FIXES.map((fix) => (
            <View key={fix.text} style={styles.fix}>
              <IconTile icon={fix.icon} />
              <AppText size={14} leading={19} style={styles.flex}>
                {t(fix.text)}
              </AppText>
            </View>
          ))}
        </Card>
      </Screen>
    );
  }

  const next = session.required_locations.find((l) => !session.recordings[l]?.accepted);
  const nextName = next ? Spots[next][lang].name : null;
  const bpm = recording.quality.heart_rate_bpm;
  const optional = session.optional_locations.filter((l) => !session.recordings[l]?.accepted);

  return (
    <Screen
      title={t('quality.title')}
      footer={
        <>
          {next && nextName ? (
            <Button
              label={t('quality.next', { name: nextName })}
              onPress={() => router.push({ pathname: '/guide', params: { location: next } })}
            />
          ) : (
            <Button label={t('continue')} onPress={() => router.push('/reports')} />
          )}
          <Button
            label={t('quality.again', { name: spot.name.toLocaleLowerCase() })}
            variant="ghost"
            onPress={recordAgain}
          />
          {next === 'NK' && skipNeck}
        </>
      }>
      <StepProgress step={3} name={t('guide.step')} />

      <View style={[styles.hero, styles.heroAccepted]}>
        <View style={[styles.badge, styles.badgeOk]}>
          <Art name="icon-check-ok-large" box={40} />
        </View>
        <AppText size={28} weight="medium" tracking={-0.448} align="center">
          {t('quality.accepted')}
        </AppText>
        <AppText size={15} leading={22} color={Palette.ink2} align="center">
          {nextName
            ? t('quality.capturedNext', { name: spot.name, next: nextName.toLocaleLowerCase() })
            : t('quality.capturedDone', { name: spot.name })}
        </AppText>
      </View>

      <View style={styles.stats}>
        <Stat
          icon="icon-heart-brand"
          label={t('quality.heartRate')}
          value={bpm !== null ? String(bpm) : '–'}
          unit={t('quality.bpm')}
        />
        <Stat
          icon="icon-clock"
          label={t('quality.length')}
          value={recording.quality.duration_s.toFixed(1)}
          unit={t('quality.sec')}
        />
      </View>

      <Card variant="list" style={styles.spots}>
        {session.required_locations.map((l, i) => {
          const done = Boolean(session.recordings[l]?.accepted);
          const isNext = l === next;
          return (
            <CardRow
              key={l}
              leading={
                <IconTile
                  icon={done ? 'icon-check-ok' : 'icon-map'}
                  background={done ? Palette.okSoft : Palette.surface2}
                />
              }
              title={Spots[l][lang].name}
              subtitle={Spots[l][lang].short}
              divider={i < session.required_locations.length - 1 || optional.length > 0}
              trailing={
                <AppText
                  size={13}
                  weight="medium"
                  color={done ? Palette.ok : isNext ? Palette.ink : Palette.ink3}>
                  {done ? t('guide.recorded') : t('guide.next')}
                </AppText>
              }
            />
          );
        })}
        {optional.length > 0 && (
          <CardRow
            leading={<IconTile icon="icon-map-muted" />}
            title={optional.map((l) => Spots[l][lang].name).join(' & ')}
            titleColor={Palette.ink2}
            subtitle={t('quality.optionalSpots')}
            trailing={
              <AppText size={13} weight="medium" color={Palette.ink3}>
                {t('optional')}
              </AppText>
            }
          />
        )}
      </Card>
    </Screen>
  );
}

function Stat({
  icon,
  label,
  value,
  unit,
}: {
  icon: ArtworkName;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <Card style={styles.stat}>
      <View style={styles.statLabel}>
        <Art name={icon} box={16} />
        <AppText size={13} color={Palette.ink2}>
          {label}
        </AppText>
      </View>
      <View style={styles.statValue}>
        <AppText size={30} weight="medium" tracking={-0.48}>
          {value}
        </AppText>
        <AppText size={14} color={Palette.ink3}>
          {unit}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: 10,
    paddingBottom: 4,
  },
  heroAccepted: {
    gap: 14,
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    boxShadow: '0px 6px 16px 0px rgba(68, 49, 48, 0.05)',
  },
  badgeSmall: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  badgeOk: {
    backgroundImage: 'linear-gradient(126.87deg, rgb(234, 247, 240) 0%, rgb(209, 237, 222) 71.429%)',
  },
  badgeWarn: {
    backgroundImage: 'linear-gradient(126.87deg, rgb(254, 243, 221) 0%, rgb(249, 230, 188) 71.429%)',
  },
  stats: {
    flexDirection: 'row',
    gap: 10,
  },
  stat: {
    flex: 1,
    gap: 14,
    boxShadow: Shadow.card,
  },
  statLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  spots: {
    paddingTop: 4,
  },
  fix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
});
