import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';

import { Palette } from '@/constants/theme';
import { useScreening } from '@/state/screening';

const TOTAL = 4;

/** The four-segment bar and "STEP n OF 4 · NAME" caption above each flow screen. */
export function StepProgress({ step, name }: { step: number; name: string }) {
  const { t } = useScreening();

  return (
    <View style={styles.container}>
      <View style={styles.segments}>
        {Array.from({ length: TOTAL }, (_, i) => (
          <View
            key={i}
            style={[styles.segment, { backgroundColor: i < step ? Palette.brand : Palette.line }]}
          />
        ))}
      </View>
      <AppText size={12} weight="medium" color={Palette.ink3} tracking={0.72}>
        {`${t('step', { n: step, total: TOTAL })}  ·  ${name}`.toLocaleUpperCase()}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  segments: {
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
});
