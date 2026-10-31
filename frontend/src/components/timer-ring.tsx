import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText } from './app-text';
import { Art } from './art';

import { Palette } from '@/constants/theme';

const SIZE = 260;
const STROKE = 9.1;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type TimerRingProps = {
  /** 0-1 of the recording done. */
  progress: number;
  seconds: number;
  caption: string;
};

/** Ticked dial with a brand arc that fills clockwise from the top as recording runs. */
export function TimerRing({ progress, seconds, caption }: TimerRingProps) {
  const clamped = Math.min(Math.max(progress, 0), 1);

  return (
    <View style={styles.ring}>
      <Art name="timer-ticks" style={styles.ticks} />
      <Art name="timer-track" style={styles.fill} />
      <Svg width={SIZE} height={SIZE} style={styles.fill}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={Palette.brand}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <Art name="timer-inner" style={styles.inner} />
      <View style={styles.label}>
        <AppText
          size={84}
          weight="light"
          color={Palette.onDark}
          tracking={-3.36}
          style={styles.digits}>
          {String(seconds).padStart(2, '0')}
        </AppText>
        <AppText size={14} color="rgba(255, 255, 255, 0.6)">
          {caption}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  ticks: {
    position: 'absolute',
    left: 5,
    top: 5,
  },
  inner: {
    position: 'absolute',
    left: 30,
    top: 30,
  },
  label: {
    alignItems: 'center',
  },
  digits: {
    fontVariant: ['tabular-nums'],
  },
});
