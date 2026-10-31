import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { Art } from './art';

const BAR_COLOR = '#d62b40';
const FUTURE_COLOR = 'rgba(214, 43, 64, 0.2)';
const MIN_HEIGHT = 6;
const MAX_HEIGHT = 48;

type LevelBarsProps = {
  /** Peak input level (0-1) per time slice so far; later slices are empty. */
  history: (number | null)[];
  caption: string;
};

/** Live microphone level: one bar per slice of the recording, faint for slices still to come. */
export function LevelBars({ history, caption }: LevelBarsProps) {
  return (
    <View style={styles.card}>
      <View style={styles.bars}>
        {history.map((value, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              value === null
                ? { height: MIN_HEIGHT, backgroundColor: FUTURE_COLOR }
                : {
                    height: MIN_HEIGHT + value * (MAX_HEIGHT - MIN_HEIGHT),
                    backgroundColor: BAR_COLOR,
                  },
            ]}
          />
        ))}
      </View>
      <View style={styles.caption}>
        <Art name="dot-live" />
        <AppText size={14} weight="medium" color="#58434a">
          {caption}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#fffdfc',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 56,
  },
  bar: {
    width: 4,
    borderRadius: 2,
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
