import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { Card } from './card';

import type { HealthSummary } from '@/api/types';
import { Palette } from '@/constants/theme';
import { useScreening } from '@/state/screening';

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.fact}>
      <AppText size={13} color={Palette.ink2}>
        {label}
      </AppText>
      <AppText size={15} leading={21} weight="medium">
        {value}
      </AppText>
      {note && (
        <AppText size={12} leading={17} color={Palette.ink2}>
          {note}
        </AppText>
      )}
    </View>
  );
}

/** BMI and general advice beside the result. Nothing here changes the result. */
export function HealthSummaryCard({ summary }: { summary: HealthSummary }) {
  const { t, lang } = useScreening();
  const { bmi, bmi_category, symptoms, known_conditions, suggestions } = summary;

  const listOrNone = (items: string[]) =>
    items.length > 0 ? items.join(', ') : t('result.health.none');

  return (
    <Card title={t('result.health')}>
      {bmi !== null && (
        <Fact
          label={t('result.health.bmi')}
          value={bmi.toFixed(1)}
          note={bmi_category ? t(`result.health.bmi.${bmi_category}`) : undefined}
        />
      )}
      <Fact
        label={t('result.health.symptoms')}
        value={listOrNone(symptoms.map((symptom) => t(`symptom.${symptom}`)))}
      />
      <Fact
        label={t('patient.conditions')}
        value={listOrNone(known_conditions.map((condition) => t(`condition.${condition}`)))}
      />

      {suggestions[lang].length > 0 && (
        <View style={styles.suggestions}>
          <AppText size={14} weight="semibold">
            {t('result.health.suggestions')}
          </AppText>
          {suggestions[lang].map((suggestion) => (
            <View key={suggestion} style={styles.suggestion}>
              <AppText size={14} leading={20}>
                {'•'}
              </AppText>
              <AppText size={14} leading={20} style={styles.flex}>
                {suggestion}
              </AppText>
            </View>
          ))}
          <AppText size={12} leading={17} color={Palette.ink3}>
            {t('result.health.note')}
          </AppText>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  fact: {
    gap: 2,
  },
  suggestions: {
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Palette.line,
  },
  suggestion: {
    flexDirection: 'row',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
});
