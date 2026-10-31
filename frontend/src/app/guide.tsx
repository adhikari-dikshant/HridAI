import { requestRecordingPermissionsAsync } from 'expo-audio';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Location, Source } from '@/api/types';
import { AppText } from '@/components/app-text';
import { Art, type ArtworkName } from '@/components/art';
import { Button } from '@/components/button';
import { ChestPlacement } from '@/components/chest-placement';
import { IconTile } from '@/components/icon-tile';
import { Note } from '@/components/note';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { StepProgress } from '@/components/step-progress';
import { Spots, isSpot } from '@/constants/chest-locations';
import { Palette } from '@/constants/theme';
import type { StringKey } from '@/i18n/strings';
import { hasAcceptedChest, useScreening } from '@/state/screening';

const SOURCES: { value: Source; icon: ArtworkName }[] = [
  { value: 'phone_mic', icon: 'icon-phone' },
  { value: 'stethoscope_mic', icon: 'icon-steth' },
];

const TIPS: { icon: ArtworkName; text: StringKey }[][] = [
  [
    { icon: 'icon-wind', text: 'guide.tip1' },
    { icon: 'icon-mute', text: 'guide.tip2' },
  ],
  [
    { icon: 'icon-phone', text: 'guide.tip3' },
    { icon: 'icon-micoff', text: 'guide.tip4' },
  ],
];

const NECK_TIPS: { icon: ArtworkName; text: StringKey }[][] = [
  [
    { icon: 'icon-wind', text: 'guide.neckTip1' },
    { icon: 'icon-mute', text: 'guide.tip2' },
  ],
  [
    { icon: 'icon-phone', text: 'guide.neckTip3' },
    { icon: 'icon-micoff', text: 'guide.neckTip4' },
  ],
];

const ORDINALS: StringKey[] = ['guide.ordinal1', 'guide.ordinal2', 'guide.ordinal3', 'guide.ordinal4'];

export default function GuideScreen() {
  const { t, lang, session, source, setSource } = useScreening();
  const params = useLocalSearchParams<{ location?: string }>();

  if (!session || !isSpot(params.location)) return <Redirect href="/" />;

  const location = params.location;
  const spot = Spots[location][lang];
  const neck = location === 'NK';
  // Optional spots only show up here once the person chooses to record one.
  const spots: Location[] = session.required_locations.includes(location)
    ? session.required_locations
    : [...session.required_locations, location];

  async function start() {
    const permission = await requestRecordingPermissionsAsync();
    if (permission.granted) {
      router.push({ pathname: '/record', params: { location } });
    } else {
      router.push({ pathname: '/mic-access', params: { location } });
    }
  }

  return (
    <Screen
      title={t('guide.title')}
      gap={18}
      footer={
        <>
          <Button label={t('guide.start')} onPress={start} />
          {neck && hasAcceptedChest(session) && (
            <Button
              label={t('guide.skipNeck')}
              variant="ghost"
              onPress={() => router.push('/reports')}
            />
          )}
        </>
      }>
      <StepProgress step={3} name={t('guide.step')} />

      <View style={styles.spots}>
        {spots.map((option, i) => {
          const current = option === location;
          const recorded = Boolean(session.recordings[option]?.accepted);
          const status = current
            ? t(ORDINALS[i])
            : recorded
              ? t('guide.recorded')
              : t('guide.next');
          return (
            <Pressable
              key={option}
              accessibilityRole="tab"
              accessibilityState={{ selected: current }}
              onPress={() => router.setParams({ location: option })}
              style={[styles.spot, current && styles.spotCurrent]}>
              <View style={[styles.spotNumber, current && styles.spotNumberCurrent]}>
                <AppText size={13} weight="semibold" color={current ? Palette.onDark : Palette.ink2}>
                  {i + 1}
                </AppText>
              </View>
              <View>
                <AppText size={15} weight="medium" color={current ? Palette.ink : Palette.ink2}>
                  {Spots[option][lang].name}
                </AppText>
                <AppText
                  size={12}
                  color={current ? Palette.brand : recorded ? Palette.ok : Palette.ink3}>
                  {status}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ChestPlacement current={location} />

      <View style={styles.copy}>
        <AppText size={26} weight="medium" tracking={-0.416}>
          {t('guide.spot', { name: spot.name })}
        </AppText>
        <AppText size={15} leading={22} color={Palette.ink2}>
          {spot.where}
        </AppText>
      </View>

      {neck && <Note tone="alert" text={t('guide.neckSafety')} />}

      <View style={styles.group}>
        <AppText size={14} weight="medium">
          {t('guide.source')}
        </AppText>
        <Segmented
          value={source}
          onChange={setSource}
          options={SOURCES.map((option) => ({
            value: option.value,
            label: t(`guide.${option.value}`),
            icon: <Art name={option.icon} box={18} />,
          }))}
        />
      </View>

      <View style={styles.group}>
        <AppText size={14} weight="medium">
          {t('guide.tips')}
        </AppText>
        {(neck ? NECK_TIPS : TIPS).map((row, i) => (
          <View key={i} style={styles.tipRow}>
            {row.map((tip) => (
              <View key={tip.text} style={styles.tip}>
                <IconTile icon={tip.icon} size={34} iconBox={18} />
                <AppText size={13} leading={17} weight="medium" style={styles.flex}>
                  {t(tip.text)}
                </AppText>
              </View>
            ))}
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  spots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  spot: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Palette.line,
    backgroundColor: Palette.surface,
  },
  spotCurrent: {
    borderColor: Palette.ink,
  },
  spotNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surface2,
  },
  spotNumberCurrent: {
    backgroundColor: Palette.brand,
  },
  copy: {
    gap: 6,
  },
  group: {
    gap: 8,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: Palette.surface,
  },
  flex: {
    flex: 1,
  },
});
