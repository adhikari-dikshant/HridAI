import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopBar } from './top-bar';

import { MaxContentWidth, NightGradient, Palette } from '@/constants/theme';

type ScreenProps = {
  children: ReactNode;
  /** Title for the top bar with the back button. Omit for no top bar. */
  title?: string;
  onBack?: () => void;
  hideBack?: boolean;
  /** Replaces the standard top bar, e.g. the close bar on dark screens. */
  header?: ReactNode;
  /** Pinned below the scrolling content, e.g. the main action button. */
  footer?: ReactNode;
  /** Gap between content blocks. */
  gap?: number;
  /** Centres the content vertically when it is shorter than the screen. */
  centered?: boolean;
  /** Dark gradient background used while recording. */
  night?: boolean;
};

export function Screen({
  children,
  title,
  onBack,
  hideBack,
  header,
  footer,
  gap = 16,
  centered = false,
  night = false,
}: ScreenProps) {
  return (
    <View style={[styles.container, night ? styles.night : styles.day]}>
      <StatusBar style={night ? 'light' : 'dark'} />
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safeArea}>
        {header ?? (title !== undefined && <TopBar title={title} onBack={onBack} hideBack={hideBack} />)}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.content, { gap }, centered && styles.centered]}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer && <View style={styles.footer}>{footer}</View>}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  day: {
    backgroundColor: Palette.bg,
  },
  night: {
    backgroundColor: Palette.night,
    backgroundImage: NightGradient,
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  centered: {
    justifyContent: 'center',
  },
  footer: {
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
  },
});
