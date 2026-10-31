import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { Art } from './art';

import type { Location } from '@/api/types';
import { Palette } from '@/constants/theme';
import { useScreening } from '@/state/screening';

// Marker centres on the 342 x 236 Figma canvas. The torso faces the viewer,
// so the person's left side is on the right of the drawing.
const MARKERS: Record<Location, { x: number; y: number }> = {
  AV: { x: 148.35, y: 117.35 },
  PV: { x: 192.35, y: 117.35 },
  TV: { x: 180.35, y: 171.35 },
  MV: { x: 224.35, y: 187.35 },
};

const CANVAS_WIDTH = 342;
const CANVAS_HEIGHT = 236;

/** Front-of-chest illustration with the phone drawn on the current spot. */
export function ChestPlacement({ current }: { current: Location }) {
  const { t } = useScreening();
  const active = MARKERS[current];

  return (
    <View style={styles.card}>
      <View style={styles.canvas}>
        <Art name="torso" style={styles.torso} />

        {(Object.keys(MARKERS) as Location[])
          .filter((location) => location !== current)
          .map((location) => {
            const { x, y } = MARKERS[location];
            return (
              <View key={location}>
                <Art name="marker-dot" style={[styles.abs, { left: x - 6, top: y - 6 }]} />
                <AppText
                  size={11}
                  weight="medium"
                  color={Palette.ink3}
                  style={[styles.abs, styles.markerLabel, { left: x + 9, top: y - 8 }]}>
                  {location}
                </AppText>
              </View>
            );
          })}

        <Art name="marker-halo" style={[styles.abs, { left: active.x - 20, top: active.y - 20 }]} />
        <Art name="marker-active" style={[styles.abs, { left: active.x - 9, top: active.y - 9 }]} />
        {/* The phone's bottom microphone sits on the marker. */}
        <Art
          name="phone-on-chest"
          style={[styles.abs, { left: active.x - 17, top: active.y - 66 }]}
        />
        <View style={[styles.abs, styles.tag, { left: active.x + 25, top: active.y - 6 }]}>
          <AppText size={12} weight="medium" color={Palette.onDark}>
            {t('guide.placeHere')}
          </AppText>
        </View>

        <AppText size={11} color={Palette.ink3} style={[styles.abs, styles.sideLeft]}>
          {t('guide.personRight')}
        </AppText>
        <AppText size={11} color={Palette.ink3} style={[styles.abs, styles.sideRight]}>
          {t('guide.personLeft')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: CANVAS_HEIGHT,
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 0.65,
    borderColor: Palette.line,
    backgroundImage: 'linear-gradient(137.38deg, rgb(255, 255, 255) 0%, rgb(246, 236, 238) 71.429%)',
  },
  canvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  },
  abs: {
    position: 'absolute',
  },
  torso: {
    position: 'absolute',
    left: 20.35,
    top: 23.35,
  },
  markerLabel: {
    opacity: 0.65,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Palette.brandDeep,
  },
  sideLeft: {
    left: 15.35,
    top: 11.35,
  },
  sideRight: {
    right: 15.35,
    top: 11.35,
  },
});
