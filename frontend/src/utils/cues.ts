import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

import type { Lang } from '@/api/types';

// The screen can't be seen with the phone on the chest, so recording is guided by touch and voice.
// Neither may run while the mic is recording. A phone without a Hindi voice simply stays silent.

const VOICES: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN' };

export function say(text: string, lang: Lang) {
  Speech.stop();
  Speech.speak(text, { language: VOICES[lang] });
}

export function stopSpeaking() {
  Speech.stop();
}

export function buzz() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
