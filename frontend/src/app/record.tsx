import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { AppText } from '@/components/app-text';
import { Art, type ArtworkName } from '@/components/art';
import { Button } from '@/components/button';
import { LevelBars } from '@/components/level-bars';
import { Screen } from '@/components/screen';
import { TimerRing } from '@/components/timer-ring';
import { Spots, isSpot } from '@/constants/chest-locations';
import { Palette } from '@/constants/theme';
import { useHeartRecorder } from '@/hooks/use-heart-recorder';
import type { StringKey } from '@/i18n/strings';
import { useScreening } from '@/state/screening';

const COUNTDOWN_S = 3;

const READY_TIPS: { icon: ArtworkName; text: StringKey }[] = [
  { icon: 'icon-micoff-white', text: 'record.quiet' },
  { icon: 'icon-phone-white', text: 'record.still' },
  { icon: 'icon-mute-white', text: 'record.fan' },
];

export default function RecordScreen() {
  const { t, lang, session, source, saveRecording } = useScreening();
  const params = useLocalSearchParams<{ location?: string }>();

  const rec = useHeartRecorder();
  const [countdown, setCountdown] = useState<number | null>(COUNTDOWN_S);
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState(false);
  // Bumped on cancel so a running countdown knows to stop.
  const countdownIdRef = useRef(0);
  // Guards against effects running twice in development.
  const startedRef = useRef(false);
  const handledUriRef = useRef<string | null>(null);

  const location = isSpot(params.location) ? params.location : null;
  const recording = rec.status === 'done' ? rec.recording : null;

  useEffect(() => {
    if (!location || startedRef.current) return;
    startedRef.current = true;
    void begin();
  });

  // A finished recording goes straight to the quality check.
  useEffect(() => {
    if (!recording || handledUriRef.current === recording.uri) return;
    handledUriRef.current = recording.uri;
    void finish();
  });

  if (!session || !location) return <Redirect href="/" />;

  const spot = Spots[location][lang];
  const neck = location === 'NK';
  const spotIndex = session.required_locations.indexOf(location);
  const totalSpots = session.required_locations.length;
  const isRecording = rec.status === 'recording' || rec.status === 'stopping';

  async function begin() {
    setFailed(false);
    const id = ++countdownIdRef.current;
    for (let n = COUNTDOWN_S; n > 0; n--) {
      setCountdown(n);
      await sleep(1000);
      if (countdownIdRef.current !== id) return;
    }
    setCountdown(null);
    if (!(await rec.start())) setFailed(true);
  }

  async function finish() {
    if (!recording || !location || !session) return;
    if (recording.issues.length > 0) {
      router.replace({ pathname: '/quality', params: { location, issue: recording.issues[0] } });
      return;
    }

    setUploading(true);
    try {
      const response = await api.uploadRecording(session.screening_id, {
        uri: recording.uri,
        location,
        source,
        durationMs: recording.duration * 1000,
      });
      saveRecording(response);
      router.replace({ pathname: '/quality', params: { location } });
    } catch {
      setUploading(false);
      setFailed(true);
    }
  }

  function stopEverything() {
    countdownIdRef.current++;
    setCountdown(null);
    if (isRecording) rec.cancel();
  }

  function close() {
    stopEverything();
    router.back();
  }

  function startOver() {
    stopEverything();
    void begin();
  }

  const header = (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('record.close')}
        onPress={close}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
        <Art name="icon-close-white" box={20} />
      </Pressable>
      <View style={styles.headerText}>
        <AppText size={17} weight="medium" color={Palette.onDark}>
          {t('guide.spot', { name: spot.name })}
        </AppText>
        {spotIndex >= 0 && (
          <AppText size={12} color="rgba(255, 255, 255, 0.6)">
            {t('record.spotOf', { n: spotIndex + 1, total: totalSpots })}
          </AppText>
        )}
      </View>
      <View style={styles.headerSlot} />
    </View>
  );

  let body;
  let footer;

  if (uploading) {
    body = (
      <View style={styles.status}>
        <ActivityIndicator color={Palette.onDark} size="large" />
        <AppText size={17} weight="medium" color={Palette.onDark} align="center">
          {t('record.uploading')}
        </AppText>
      </View>
    );
  } else if (failed) {
    body = (
      <View style={styles.status}>
        <AppText size={17} weight="medium" color={Palette.onDark} align="center">
          {rec.error ? t('record.failed') : t('genericError')}
        </AppText>
      </View>
    );
    footer = (
      <>
        <Button
          label={t('retry')}
          variant="light"
          onPress={recording ? () => void finish() : startOver}
        />
        <Button label={t('cancel')} variant="glass" onPress={close} />
      </>
    );
  } else if (isRecording) {
    const secondsLeft = Math.ceil((rec.durationMs - rec.elapsedMs) / 1000);
    body = (
      <>
        <View style={[styles.pill, styles.recordingPill]}>
          <Art name="dot-recording" />
          <AppText size={13} weight="medium" color={Palette.onDark}>
            {t('record.recording')}
          </AppText>
        </View>
        <TimerRing
          progress={rec.elapsedMs / rec.durationMs}
          seconds={secondsLeft}
          caption={t('record.secondsLeft')}
        />
        <LevelBars history={rec.levelHistory} caption={t('record.live')} />
        <View style={styles.hint}>
          <Art name="icon-micoff-white" box={20} />
          <AppText size={14} leading={20} color="rgba(255, 255, 255, 0.85)" style={styles.flex}>
            {t(neck ? 'record.stayQuietNeck' : 'record.stayQuiet')}
          </AppText>
        </View>
      </>
    );
    footer = <Button label={t('record.cancelOver')} variant="glass" onPress={startOver} />;
  } else {
    body = (
      <>
        <View style={styles.pill}>
          <AppText size={13} weight="medium" color="rgba(255, 255, 255, 0.85)">
            {t('record.getReady')}
          </AppText>
        </View>
        <View style={styles.countdown}>
          <Art name="countdown-ring-1" style={styles.abs} />
          <Art name="countdown-ring-2" style={[styles.abs, styles.ring2]} />
          <Art name="countdown-ring-3" style={[styles.abs, styles.ring3]} />
          <AppText size={110} weight="light" color={Palette.onDark} tracking={-4.4}>
            {countdown ?? COUNTDOWN_S}
          </AppText>
        </View>
        <View style={styles.copy}>
          <AppText size={24} weight="medium" color={Palette.onDark} tracking={-0.24} align="center">
            {t(neck ? 'record.restNeck' : 'record.press')}
          </AppText>
          <AppText size={15} leading={22} color="rgba(255, 255, 255, 0.7)" align="center">
            {t(neck ? 'record.hintNeck' : 'record.hint', { placement: spot.placement })}
          </AppText>
        </View>
        <View style={styles.tips}>
          {READY_TIPS.map((tip) => (
            <View key={tip.text} style={styles.tip}>
              <Art name={tip.icon} box={20} />
              <AppText size={13} weight="medium" color="rgba(255, 255, 255, 0.85)">
                {t(tip.text)}
              </AppText>
            </View>
          ))}
        </View>
      </>
    );
    footer = <Button label={t('cancel')} variant="glass" onPress={close} />;
  }

  return (
    <Screen night header={header} footer={footer} gap={28} centered>
      <View style={styles.body}>{body}</View>
    </Screen>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 6,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  pressed: {
    opacity: 0.6,
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
  },
  headerSlot: {
    width: 44,
    height: 44,
  },
  body: {
    alignItems: 'center',
    gap: 28,
    paddingTop: 16,
  },
  status: {
    alignItems: 'center',
    gap: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  recordingPill: {
    backgroundColor: 'rgba(224, 38, 60, 0.18)',
  },
  countdown: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abs: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  ring2: {
    left: 30,
    top: 30,
  },
  ring3: {
    left: 58,
    top: 58,
  },
  copy: {
    alignSelf: 'stretch',
    gap: 8,
  },
  tips: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 8,
  },
  tip: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  hint: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  flex: {
    flex: 1,
  },
});
