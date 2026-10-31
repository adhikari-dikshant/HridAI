import type { Lang, Location } from '@/api/types';

// Same codes as the CirCor dataset and the API.
export type ChestLocation = Location;

type LocationInfo = {
  name: string;
  /** One line under the name in lists, e.g. "Left chest, lower". */
  short: string;
  /** Full placement instruction on the guide screen. */
  where: string;
  /** Fills "Bottom mic on bare skin, {placement}" on the countdown. */
  placement: string;
};

export const ChestLocations: Record<ChestLocation, Record<Lang, LocationInfo>> = {
  MV: {
    en: {
      name: 'Mitral',
      short: 'Left chest, lower',
      where: 'Left chest, below the nipple line. Press the phone’s bottom mic firmly on bare skin.',
      placement: 'below the left nipple line',
    },
    hi: {
      name: 'माइट्रल',
      short: 'बाईं छाती, नीचे',
      where: 'बाईं छाती, निप्पल की रेखा के नीचे। फ़ोन का नीचे का माइक खुली त्वचा पर कसकर दबाएँ।',
      placement: 'बाएँ निप्पल की रेखा के नीचे',
    },
  },
  AV: {
    en: {
      name: 'Aortic',
      short: 'Right of breastbone, upper',
      where:
        'Right of the breastbone, 2nd rib space. Press the phone’s bottom mic firmly on bare skin.',
      placement: 'right of the breastbone, 2nd rib space',
    },
    hi: {
      name: 'एओर्टिक',
      short: 'छाती की हड्डी के दाईं ओर, ऊपर',
      where:
        'छाती की हड्डी के दाईं ओर, दूसरी पसली के बीच। फ़ोन का नीचे का माइक खुली त्वचा पर कसकर दबाएँ।',
      placement: 'छाती की हड्डी के दाईं ओर, दूसरी पसली के बीच',
    },
  },
  PV: {
    en: {
      name: 'Pulmonic',
      short: 'Left of breastbone, upper',
      where:
        'Left of the breastbone, 2nd rib space. Press the phone’s bottom mic firmly on bare skin.',
      placement: 'left of the breastbone, 2nd rib space',
    },
    hi: {
      name: 'पल्मोनिक',
      short: 'छाती की हड्डी के बाईं ओर, ऊपर',
      where:
        'छाती की हड्डी के बाईं ओर, दूसरी पसली के बीच। फ़ोन का नीचे का माइक खुली त्वचा पर कसकर दबाएँ।',
      placement: 'छाती की हड्डी के बाईं ओर, दूसरी पसली के बीच',
    },
  },
  TV: {
    en: {
      name: 'Tricuspid',
      short: 'Left of breastbone, lower',
      where:
        'Lower left edge of the breastbone, 4th–5th rib space. Press the phone’s bottom mic firmly on bare skin.',
      placement: 'at the lower left edge of the breastbone',
    },
    hi: {
      name: 'ट्राइकसपिड',
      short: 'छाती की हड्डी के बाईं ओर, नीचे',
      where:
        'छाती की हड्डी का बायाँ निचला किनारा, 4–5वीं पसली के बीच। फ़ोन का नीचे का माइक खुली त्वचा पर कसकर दबाएँ।',
      placement: 'छाती की हड्डी के बाएँ निचले किनारे पर',
    },
  },
};

export function isChestLocation(value: unknown): value is ChestLocation {
  return typeof value === 'string' && value in ChestLocations;
}
