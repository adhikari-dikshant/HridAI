import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';

import { api, errorMessage } from '@/api/client';
import type { AnalyzeResponse, Label, Lang } from '@/api/types';
import { AppText } from '@/components/app-text';
import { Art, type ArtworkName } from '@/components/art';
import { Button } from '@/components/button';
import { Card, CardRow } from '@/components/card';
import { HealthSummaryCard } from '@/components/health-summary';
import { IconTile } from '@/components/icon-tile';
import { Note } from '@/components/note';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { Tag } from '@/components/tag';
import { ChestLocations } from '@/constants/chest-locations';
import { Outcomes } from '@/constants/outcomes';
import { Palette } from '@/constants/theme';
import { translate, type StringKey } from '@/i18n/strings';
import { useScreening } from '@/state/screening';

type ResultView = Pick<
  AnalyzeResponse,
  'result' | 'explanation' | 'health_summary' | 'disclaimer' | 'completed_at'
>;

// Above this, a chest spot is flagged as having an unusual sound.
const SPOT_FLAG_THRESHOLD = 0.5;

const NEXT_STEPS: Record<Exclude<Label, 'unclear'>, { icon: ArtworkName; soft: string; text: StringKey }[]> = {
  needs_checkup: [
    { icon: 'icon-steth-warn', soft: Palette.warnSoft, text: 'result.next.needs_checkup1' },
    { icon: 'icon-share', soft: Palette.surface2, text: 'result.next.needs_checkup2' },
  ],
  normal: [
    { icon: 'icon-check-ok', soft: Palette.okSoft, text: 'result.next.normal1' },
    { icon: 'icon-heart-ink', soft: Palette.surface2, text: 'result.next.normal2' },
  ],
};

export default function ResultScreen() {
  const { t, lang, session, result: latest } = useScreening();
  // Opened from history with an id; otherwise shows the screening just analyzed.
  const { id } = useLocalSearchParams<{ id?: string }>();
  const fromHistory = Boolean(id);

  const [loaded, setLoaded] = useState<ResultView | null>(null);
  const [loadedLabel, setLoadedLabel] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [explanationLang, setExplanationLang] = useState<Lang>(lang);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api
      .getScreening(id)
      .then((detail) => {
        if (cancelled) return;
        if (detail.analysis) setLoaded(detail.analysis);
        else setLoadFailed(true);
        // Snapshots never hold the nickname. The result still shows without it.
        api
          .getPatient(detail.patient_id)
          .then((patient) => !cancelled && setLoadedLabel(patient.label))
          .catch(() => {});
      })
      .catch((cause) => {
        if (cancelled) return;
        setLoadFailed(true);
        setLoadError(errorMessage(cause, lang));
      });
    return () => {
      cancelled = true;
    };
  }, [id, lang]);

  const view: ResultView | null = fromHistory ? loaded : latest;
  const patientLabel = fromHistory ? loadedLabel : (session?.patient.label ?? null);
  const goHome = () => router.dismissTo('/');
  const back = fromHistory ? () => router.back() : goHome;

  if (!view) {
    return (
      <Screen
        title={t('result.title')}
        onBack={back}
        centered
        footer={<Button label={t('result.done')} variant="ghost" onPress={goHome} />}>
        <View style={styles.center}>
          {fromHistory && !loadFailed ? (
            <ActivityIndicator color={Palette.brand} />
          ) : (
            <AppText color={Palette.ink2} align="center">
              {loadError ?? t('result.notReady')}
            </AppText>
          )}
        </View>
      </Screen>
    );
  }

  const { label, confidence, heart_rate_bpm, per_location } = view.result;
  const outcome = Outcomes[label];
  const otherLang: Lang = lang === 'hi' ? 'en' : 'hi';
  const confidenceLevel = confidence >= 0.8 ? 3 : confidence >= 0.6 ? 2 : 1;
  const confidenceKey = (['result.low', 'result.medium', 'result.high'] as const)[confidenceLevel - 1];
  const completed = new Date(view.completed_at);
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const date = completed.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const time = completed.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });

  function share() {
    // No patient identifiers: label, heart rate, date and the disclaimer only.
    const lines = [
      `${t('appName')} · ${date}`,
      t(`result.${label}`),
      heart_rate_bpm !== null ? `${t('result.heartRate')}: ${heart_rate_bpm} ${t('result.bpm')}` : null,
      '',
      view!.disclaimer[lang],
    ];
    void Share.share({ message: lines.filter((line) => line !== null).join('\n') });
  }

  function recordAgain() {
    if (!fromHistory && session) {
      router.replace({ pathname: '/guide', params: { location: session.required_locations[0] } });
    } else {
      router.dismissTo('/');
      router.push('/patients');
    }
  }

  return (
    <Screen
      title={t('result.title')}
      onBack={back}
      gap={12}
      footer={
        <>
          {label === 'unclear' ? (
            <Button label={t('result.recordAgain')} onPress={recordAgain} />
          ) : (
            <Button label={t('result.share')} onPress={share} />
          )}
          <Button label={t('result.done')} variant="ghost" onPress={goHome} />
        </>
      }>
      <AppText size={13} color={Palette.ink3}>
        {[patientLabel, date, time].filter(Boolean).join('  ·  ')}
      </AppText>

      <View
        style={[styles.outcome, { backgroundImage: outcome.gradient, borderColor: outcome.border }]}>
        <View style={styles.badge}>
          <Art name={outcome.badgeIcon} box={16} />
          <AppText size={13} weight="semibold" color={outcome.color}>
            {t(`result.badge.${label}`)}
          </AppText>
        </View>
        <AppText size={30} leading={36} weight="medium" tracking={-0.48} style={styles.headline}>
          {t(`result.${label}`)}
        </AppText>
        <AppText size={15} leading={24} color={Palette.ink2}>
          {translate(otherLang, `result.${label}`)}
        </AppText>
        {/* Decorative only, not a measured recording. */}
        <View style={styles.ribbons}>
          <Art name={outcome.ribbons} />
        </View>
        <View style={styles.disclaimer}>
          <Art name="icon-info-small" box={16} />
          <AppText size={12} leading={17} color={Palette.ink2} style={styles.flex}>
            {view.disclaimer[lang]}
          </AppText>
        </View>
        <View style={[styles.seal, { borderColor: outcome.border }]}>
          <Art name={outcome.sealIcon} box={22.4} />
        </View>
      </View>

      {label !== 'unclear' && (
        <View style={styles.stats}>
          <View style={styles.heartRate}>
            <AppText size={12} color="rgba(255, 255, 255, 0.88)">
              {t('result.heartRate')}
            </AppText>
            <View style={styles.baseline}>
              <AppText size={54} leading={60} weight="light" color={Palette.onDark} tracking={-2.16}>
                {heart_rate_bpm !== null ? String(heart_rate_bpm) : '–'}
              </AppText>
              <AppText size={14} color="rgba(255, 255, 255, 0.8)">
                {t('result.bpm')}
              </AppText>
            </View>
          </View>
          <View style={styles.confidence}>
            <AppText size={13} color={Palette.ink2}>
              {t('result.confidence')}
            </AppText>
            <View style={styles.confidenceValue}>
              <AppText size={32} leading={40} weight="medium" tracking={-0.64}>
                {t(confidenceKey)}
              </AppText>
              <View style={styles.bars}>
                {[10, 15, 20].map((height, i) => (
                  <View
                    key={height}
                    style={[
                      styles.bar,
                      { height, backgroundColor: i < confidenceLevel ? Palette.ink : Palette.line },
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>
      )}

      <Card>
        <View style={styles.explanationHeader}>
          <AppText size={16} weight="semibold" style={styles.flex}>
            {t('result.explanation')}
          </AppText>
          <Segmented
            size="small"
            value={explanationLang}
            onChange={setExplanationLang}
            options={[
              { value: 'en', label: 'EN' },
              { value: 'hi', label: 'हिं' },
            ]}
          />
        </View>
        <AppText size={15} leading={23}>
          {view.explanation[explanationLang]}
        </AppText>
      </Card>

      {per_location.length > 0 && (
        <Card variant="list" title={t('result.bySpot')}>
          {per_location.map((spot, i) => {
            const status =
              label === 'unclear'
                ? { key: 'result.spot.unclear', color: Palette.neutral, soft: Palette.neutralSoft }
                : spot.abnormal_probability >= SPOT_FLAG_THRESHOLD
                  ? { key: 'result.spot.unusual', color: Palette.warn, soft: Palette.warnSoft }
                  : { key: 'result.spot.typical', color: Palette.ok, soft: Palette.okSoft };
            return (
              <CardRow
                key={spot.location}
                leading={<IconTile icon="icon-steth-ink" size={36} iconBox={18} />}
                title={ChestLocations[spot.location][lang].name}
                subtitle={ChestLocations[spot.location][lang].short}
                divider={i < per_location.length - 1}
                trailing={
                  <Tag label={t(status.key as StringKey)} color={status.color} background={status.soft} />
                }
              />
            );
          })}
        </Card>
      )}

      <HealthSummaryCard summary={view.health_summary} />

      {label === 'unclear' ? (
        <Note tone="alert" text={t('result.urgent')} />
      ) : (
        <Card title={t('result.next')}>
          {NEXT_STEPS[label].map((step) => (
            <View key={step.text} style={styles.nextRow}>
              <IconTile icon={step.icon} background={step.soft} />
              <AppText size={14} leading={19} style={styles.flex}>
                {t(step.text)}
              </AppText>
            </View>
          ))}
          <Note tone="alert" text={t('result.urgent')} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  outcome: {
    gap: 10,
    padding: 20,
    overflow: 'hidden',
    borderRadius: 25,
    borderWidth: 0.7,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Palette.surface,
  },
  headline: {
    // Leaves room for the seal in the top-right corner.
    paddingRight: 32,
  },
  ribbons: {
    height: 36,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  seal: {
    position: 'absolute',
    right: 15.3,
    top: 15.3,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  stats: {
    flexDirection: 'row',
    gap: 10,
    height: 128,
  },
  heartRate: {
    flex: 1,
    gap: 10,
    padding: 16,
    borderRadius: 23,
    backgroundImage: 'linear-gradient(180deg, #e52d42 0%, #b71f35 100%)',
  },
  baseline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  confidence: {
    flex: 1,
    gap: 12,
    padding: 16,
    borderRadius: 23,
    borderWidth: 0.65,
    borderColor: Palette.line,
    backgroundColor: Palette.surface,
  },
  confidenceValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  bar: {
    width: 5,
    borderRadius: 2,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
