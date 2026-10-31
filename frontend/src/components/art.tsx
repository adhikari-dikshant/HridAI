import { Image, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';
import { View } from 'react-native';

// Exported from the HridAI Figma file. Colours are baked in, so each tint is its own file.
const Artwork = {
  'countdown-ring-1': { source: require('@/assets/figma/countdown-ring-1.svg'), width: 260, height: 260 },
  'countdown-ring-2': { source: require('@/assets/figma/countdown-ring-2.svg'), width: 200, height: 200 },
  'countdown-ring-3': { source: require('@/assets/figma/countdown-ring-3.svg'), width: 144, height: 144 },
  'dot-brand': { source: require('@/assets/figma/dot-brand.svg'), width: 7, height: 7 },
  'dot-listening': { source: require('@/assets/figma/dot-listening.svg'), width: 5, height: 5 },
  'dot-live': { source: require('@/assets/figma/dot-live.svg'), width: 8, height: 8 },
  'dot-recording': { source: require('@/assets/figma/dot-recording.svg'), width: 8, height: 8 },
  'dot-white': { source: require('@/assets/figma/dot-white.svg'), width: 7, height: 7 },
  'icon-alert-brand': { source: require('@/assets/figma/icon-alert-brand.svg'), width: 17.012, height: 15.5105 },
  'icon-alert-warn-list': { source: require('@/assets/figma/icon-alert-warn-list.svg'), width: 18.43, height: 16.7616 },
  'icon-alert-warn-seal': { source: require('@/assets/figma/icon-alert-warn-seal.svg'), width: 21.8316, height: 19.963 },
  'icon-alert-warn': { source: require('@/assets/figma/icon-alert-warn.svg'), width: 15.594, height: 14.2593 },
  'icon-back': { source: require('@/assets/figma/icon-back.svg'), width: 6.75, height: 11.75 },
  'icon-camera': { source: require('@/assets/figma/icon-camera.svg'), width: 16.75, height: 13.75 },
  'icon-check-brand-deep': { source: require('@/assets/figma/icon-check-brand-deep.svg'), width: 11.5833, height: 8.66667 },
  'icon-check-ok-badge': { source: require('@/assets/figma/icon-check-ok-badge.svg'), width: 12.9167, height: 9.58333 },
  'icon-check-ok-large': { source: require('@/assets/figma/icon-check-ok-large.svg'), width: 28.6667, height: 20.3333 },
  'icon-check-ok-list': { source: require('@/assets/figma/icon-check-ok-list.svg'), width: 15.0833, height: 10.9167 },
  'icon-check-ok-seal': { source: require('@/assets/figma/icon-check-ok-seal.svg'), width: 18.0833, height: 13.4167 },
  'icon-check-ok-tiny': { source: require('@/assets/figma/icon-check-ok-tiny.svg'), width: 11.8333, height: 8.91667 },
  'icon-check-ok': { source: require('@/assets/figma/icon-check-ok.svg'), width: 12.4167, height: 9.08333 },
  'icon-check-white': { source: require('@/assets/figma/icon-check-white.svg'), width: 13.1667, height: 9.83333 },
  'icon-chevron': { source: require('@/assets/figma/icon-chevron.svg'), width: 6.25, height: 10.75 },
  'icon-clock': { source: require('@/assets/figma/icon-clock.svg'), width: 15.3333, height: 15.3333 },
  'icon-close-white': { source: require('@/assets/figma/icon-close-white.svg'), width: 11.75, height: 11.75 },
  'icon-close': { source: require('@/assets/figma/icon-close.svg'), width: 9.75, height: 9.75 },
  'icon-dot-brand': { source: require('@/assets/figma/icon-dot-brand.svg'), width: 6, height: 6 },
  'icon-dot-muted': { source: require('@/assets/figma/icon-dot-muted.svg'), width: 6, height: 6 },
  'icon-file-small': { source: require('@/assets/figma/icon-file-small.svg'), width: 13.75, height: 16.75 },
  'icon-file': { source: require('@/assets/figma/icon-file.svg'), width: 15.0833, height: 18.4167 },
  'icon-heart-brand': { source: require('@/assets/figma/icon-heart-brand.svg'), width: 15.3333, height: 14 },
  'icon-heart-ink': { source: require('@/assets/figma/icon-heart-ink.svg'), width: 15.0833, height: 13.75 },
  'icon-heart-pulse-white': { source: require('@/assets/figma/icon-heart-pulse-white.svg'), width: 18.6667, height: 17 },
  'icon-help-badge': { source: require('@/assets/figma/icon-help-badge.svg'), width: 15.5833, height: 15.5833 },
  'icon-help-list': { source: require('@/assets/figma/icon-help-list.svg'), width: 18.4167, height: 18.4167 },
  'icon-help-seal': { source: require('@/assets/figma/icon-help-seal.svg'), width: 21.8167, height: 21.8167 },
  'icon-info-muted': { source: require('@/assets/figma/icon-info-muted.svg'), width: 16.75, height: 16.75 },
  'icon-info-small': { source: require('@/assets/figma/icon-info-small.svg'), width: 15.0833, height: 15.0833 },
  'icon-info': { source: require('@/assets/figma/icon-info.svg'), width: 20.3333, height: 20.3333 },
  'icon-lock': { source: require('@/assets/figma/icon-lock.svg'), width: 16.75, height: 18.4167 },
  'icon-map-muted': { source: require('@/assets/figma/icon-map-muted.svg'), width: 12.4167, height: 15.0833 },
  'icon-map': { source: require('@/assets/figma/icon-map.svg'), width: 12.4167, height: 15.0833 },
  'icon-mic': { source: require('@/assets/figma/icon-mic.svg'), width: 13.4167, height: 18.4167 },
  'icon-micoff-large': { source: require('@/assets/figma/icon-micoff-large.svg'), width: 32, height: 32 },
  'icon-micoff-small': { source: require('@/assets/figma/icon-micoff-small.svg'), width: 15.0833, height: 15.0833 },
  'icon-micoff-white': { source: require('@/assets/figma/icon-micoff-white.svg'), width: 18.4167, height: 18.4167 },
  'icon-micoff': { source: require('@/assets/figma/icon-micoff.svg'), width: 16.75, height: 16.75 },
  'icon-mute-small': { source: require('@/assets/figma/icon-mute-small.svg'), width: 15.0833, height: 11.0834 },
  'icon-mute-warn-large': { source: require('@/assets/figma/icon-mute-warn-large.svg'), width: 35.3333, height: 25.3334 },
  'icon-mute-white': { source: require('@/assets/figma/icon-mute-white.svg'), width: 18.4167, height: 13.4167 },
  'icon-mute': { source: require('@/assets/figma/icon-mute.svg'), width: 16.75, height: 12.25 },
  'icon-phone-small': { source: require('@/assets/figma/icon-phone-small.svg'), width: 11.0833, height: 15.0833 },
  'icon-phone-white': { source: require('@/assets/figma/icon-phone-white.svg'), width: 13.4167, height: 18.4167 },
  'icon-phone': { source: require('@/assets/figma/icon-phone.svg'), width: 12.25, height: 16.75 },
  'icon-share': { source: require('@/assets/figma/icon-share.svg'), width: 12.4167, height: 15.0833 },
  'icon-steth-ink': { source: require('@/assets/figma/icon-steth-ink.svg'), width: 16.75, height: 16.7627 },
  'icon-steth-warn': { source: require('@/assets/figma/icon-steth-warn.svg'), width: 15.0833, height: 15.0947 },
  'icon-steth': { source: require('@/assets/figma/icon-steth.svg'), width: 16.75, height: 16.7627 },
  'icon-trash-white': { source: require('@/assets/figma/icon-trash-white.svg'), width: 15.25, height: 16.75 },
  'icon-trash': { source: require('@/assets/figma/icon-trash.svg'), width: 16.75, height: 18.4167 },
  'icon-wind': { source: require('@/assets/figma/icon-wind.svg'), width: 16.75, height: 13.75 },
  'marker-active': { source: require('@/assets/figma/marker-active.svg'), width: 18, height: 18 },
  'marker-dot': { source: require('@/assets/figma/marker-dot.svg'), width: 12, height: 12 },
  'marker-halo': { source: require('@/assets/figma/marker-halo.svg'), width: 40, height: 40 },
  'phone-on-chest': { source: require('@/assets/figma/phone-on-chest.svg'), width: 34, height: 68 },
  'radio-off-dark': { source: require('@/assets/figma/radio-off-dark.svg'), width: 18, height: 18 },
  'radio-on': { source: require('@/assets/figma/radio-on.svg'), width: 18, height: 18 },
  'report-illustration': { source: require('@/assets/figma/report-illustration.svg'), width: 48, height: 48 },
  'sound-ribbons-neutral': { source: require('@/assets/figma/sound-ribbons-neutral.svg'), width: 301.5, height: 31.5 },
  'sound-ribbons-ok': { source: require('@/assets/figma/sound-ribbons-ok.svg'), width: 301.5, height: 31.5 },
  'sound-ribbons-warn': { source: require('@/assets/figma/sound-ribbons-warn.svg'), width: 301.5, height: 31.5 },
  'timer-inner': { source: require('@/assets/figma/timer-inner.svg'), width: 200, height: 200 },
  'timer-ticks': { source: require('@/assets/figma/timer-ticks.svg'), width: 250, height: 250 },
  'timer-track': { source: require('@/assets/figma/timer-track.svg'), width: 260, height: 260 },
  torso: { source: require('@/assets/figma/torso.svg'), width: 300, height: 200 },
} as const;

export type ArtworkName = keyof typeof Artwork;

type ArtProps = {
  name: ArtworkName;
  /** Size of the frame the vector sits centred in, as in Figma. Defaults to the vector's own size. */
  box?: number;
  style?: StyleProp<ImageStyle>;
};

/** Draws a Figma vector at its exported size, centred in an optional square frame. */
export function Art({ name, box, style }: ArtProps) {
  const { source, width, height } = Artwork[name];
  const image = <Image source={source} style={[{ width, height }, style]} contentFit="contain" />;
  if (box === undefined) return image;
  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      {image}
    </View>
  );
}
