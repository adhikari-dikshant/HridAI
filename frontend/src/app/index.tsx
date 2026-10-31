import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isMockApi } from '@/api/client';
import type { Lang } from '@/api/types';
import { AppText } from '@/components/app-text';
import { Art } from '@/components/art';
import { Button } from '@/components/button';
import { MaxContentWidth, Palette } from '@/constants/theme';
import { useScreening } from '@/state/screening';

// Each card is written in its own language so either reader can find theirs.
const LANGUAGES: { lang: Lang; label: string; hint: string }[] = [
  { lang: 'en', label: 'English', hint: 'Results in English' },
  { lang: 'hi', label: 'हिंदी', hint: 'परिणाम हिंदी में' },
];

export default function WelcomeScreen() {
  const { t, lang, setLang } = useScreening();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.hero}>
            <Image
              source={require('@/assets/figma/hero-heart.png')}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
            <View style={styles.brandRow}>
              <View style={styles.logo}>
                <Art name="icon-heart-pulse-white" box={20} />
              </View>
              <AppText size={24} weight="semibold" color={Palette.onDark} tracking={-0.24}>
                {t('appName')}
              </AppText>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/history')}
                hitSlop={8}
                style={({ pressed }) => [styles.glassPill, styles.historyPill, pressed && styles.pressed]}>
                <AppText size={12} weight="medium" color={Palette.onDark}>
                  {t('welcome.history')}
                </AppText>
              </Pressable>
            </View>
            <View style={[styles.glassPill, styles.badge]}>
              <Art name="dot-white" />
              <AppText size={10} weight="medium" color={Palette.onDark} tracking={0.9}>
                {t('welcome.badge').toLocaleUpperCase()}
              </AppText>
            </View>
            <View style={styles.spots}>
              <Art name="dot-brand" />
              <AppText size={12} weight="medium" color="#372028">
                {t('welcome.spots')}
              </AppText>
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.headline}>
              <AppText size={38} leading={44} weight="light" color="#fff7fa" tracking={-0.608}>
                {t('welcome.title1')}
              </AppText>
              <AppText size={38} leading={44} weight="medium" color="#fff7fa" tracking={-0.608}>
                {t('welcome.title2')}
              </AppText>
              <AppText size={15} leading={22} color="#d4bdc7" style={styles.tagline}>
                {t('welcome.tagline')}
              </AppText>
            </View>

            <View style={styles.languages}>
              <View style={styles.languageLabel}>
                <AppText size={13} weight="medium" color="rgba(255, 255, 255, 0.6)">
                  {'Choose language  ·  '}
                </AppText>
                <AppText size={13} weight="medium" color="rgba(255, 255, 255, 0.6)">
                  भाषा चुनें
                </AppText>
              </View>
              <View accessibilityRole="radiogroup" style={styles.languageRow}>
                {LANGUAGES.map((option) => {
                  const selected = lang === option.lang;
                  return (
                    <Pressable
                      key={option.lang}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setLang(option.lang)}
                      style={[styles.languageCard, selected ? styles.languageOn : styles.languageOff]}>
                      <View style={styles.languageTop}>
                        <AppText
                          size={17}
                          weight="medium"
                          color={selected ? Palette.ink : Palette.onDark}>
                          {option.label}
                        </AppText>
                        <Art name={selected ? 'radio-on' : 'radio-off-dark'} />
                      </View>
                      <AppText size={13} color={selected ? Palette.ink2 : 'rgba(255, 255, 255, 0.6)'}>
                        {option.hint}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button label={t('welcome.start')} variant="light" onPress={() => router.push('/patients')} />
          <AppText size={12} color="rgba(255, 255, 255, 0.5)" align="center">
            {isMockApi ? `${t('welcome.note')} · ${t('mockBanner')}` : t('welcome.note')}
          </AppText>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: Palette.night,
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  scroll: {
    flexGrow: 1,
  },
  hero: {
    height: 360,
    overflow: 'hidden',
  },
  brandRow: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.brand,
  },
  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 0.65,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  historyPill: {
    marginLeft: 'auto',
  },
  pressed: {
    opacity: 0.6,
  },
  badge: {
    position: 'absolute',
    left: 24,
    top: 68,
  },
  spots: {
    position: 'absolute',
    right: 24,
    bottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    boxShadow: '0px 8px 20px 0px rgba(0, 0, 0, 0.16)',
  },
  body: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: 24,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  headline: {
    gap: 4,
  },
  tagline: {
    marginTop: 10,
  },
  languages: {
    gap: 10,
  },
  languageLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageRow: {
    flexDirection: 'row',
    gap: 10,
  },
  languageCard: {
    flex: 1,
    gap: 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  languageOn: {
    backgroundColor: Palette.onDark,
    borderColor: Palette.onDark,
  },
  languageOff: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  languageTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footer: {
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
  },
});
