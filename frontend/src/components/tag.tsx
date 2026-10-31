import { View } from 'react-native';

import { AppText } from './app-text';

/** Small status pill, e.g. "Sounds typical" next to a chest spot. */
export function Tag({ label, color, background }: { label: string; color: string; background: string }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: background }}>
      <AppText size={12} weight="medium" color={color}>
        {label}
      </AppText>
    </View>
  );
}
