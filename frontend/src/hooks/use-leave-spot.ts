import { router } from 'expo-router';

import { reportsEnabled } from '@/api/client';
import type { Location } from '@/api/types';
import { nextSpot, useScreening } from '@/state/screening';

/** Moves past a spot that was skipped or could not be recorded. */
export function useLeaveSpot() {
  const { session, skipSpot } = useScreening();

  return (location: Location) => {
    if (!session) return;
    skipSpot(location);

    const next = nextSpot(session, location);
    if (next) {
      router.replace({ pathname: '/guide', params: { location: next } });
    } else {
      router.push(reportsEnabled ? '/reports' : '/analyzing');
    }
  };
}
