import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { api, errorMessage, requiresLogin } from '@/api/client';
import type { Patient } from '@/api/types';
import { logOut } from '@/auth/phone-auth';
import { AppText } from '@/components/app-text';
import { Art } from '@/components/art';
import { Button } from '@/components/button';
import { IconTile } from '@/components/icon-tile';
import { Screen } from '@/components/screen';
import { FontFamily, Palette, Shadow } from '@/constants/theme';
import { useSignedIn } from '@/state/auth';
import { useScreening } from '@/state/screening';

export default function PatientsScreen() {
  const { t, lang, endSession } = useScreening();
  const signedIn = useSignedIn();
  const [items, setItems] = useState<Patient[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const firstLoadRef = useRef(true);

  const load = useCallback(() => {
    if (!signedIn) return;
    setError(null);
    api
      .listPatients()
      .then((list) => {
        // First launch goes straight to adding a patient.
        if (firstLoadRef.current && list.length === 0) router.replace('/consent');
        firstLoadRef.current = false;
        setItems(list);
      })
      .catch((cause) => setError(errorMessage(cause, lang)));
  }, [signedIn, lang]);

  useFocusEffect(load);

  if (signedIn === false) return <Redirect href="/login" />;

  // There is no server search; the list is filtered on the device.
  const search = query.trim().toLocaleLowerCase();
  const visible = items?.filter((p) => p.label.toLocaleLowerCase().includes(search)) ?? [];
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';

  function renderItem(patient: Patient) {
    const last = patient.last_screening_at
      ? t('patients.lastScreening', {
          date: new Date(patient.last_screening_at).toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
        })
      : t('patients.noScreening');

    return (
      <View key={patient.patient_id} style={styles.item}>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/consent', params: { patientId: patient.patient_id } })
          }
          style={({ pressed }) => [styles.itemMain, pressed && styles.pressed]}>
          <IconTile icon="icon-heart-brand" size={40} iconBox={20} background={Palette.brandSoft} />
          <View style={styles.itemText}>
            <AppText size={15} weight="medium">
              {patient.label}
            </AppText>
            <AppText size={12} color={Palette.ink2}>
              {`${patient.age_years} ${t('patient.years')}  ·  ${t(`patient.${patient.sex}`)}`}
            </AppText>
            <AppText size={12} color={Palette.ink3}>
              {last}
            </AppText>
          </View>
          <Art name="icon-chevron" box={18} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() =>
            router.push({ pathname: '/history', params: { patientId: patient.patient_id } })
          }
          style={({ pressed }) => [styles.history, pressed && styles.pressed]}>
          <AppText size={13} weight="medium" color={Palette.ink2}>
            {t('patients.history')}
          </AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <Screen
      title={t('patients.title')}
      footer={
        <>
          <Button label={t('patients.add')} onPress={() => router.push('/consent')} />
          {requiresLogin && (
            <Button
              label={t('login.logout')}
              variant="ghost"
              onPress={() => {
                endSession();
                void logOut();
              }}
            />
          )}
        </>
      }>
      <View style={styles.heading}>
        <AppText size={28} leading={34} weight="medium" tracking={-0.448}>
          {t('patients.heading')}
        </AppText>
        <AppText size={15} leading={22} color={Palette.ink2}>
          {t('patients.sub')}
        </AppText>
      </View>

      {error ? (
        <View style={styles.center}>
          <AppText color={Palette.ink2} align="center">
            {error}
          </AppText>
          <Button label={t('retry')} variant="ghost" onPress={load} />
        </View>
      ) : items === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.brand} />
        </View>
      ) : (
        <>
          {items.length > 0 && (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('patients.search')}
              accessibilityLabel={t('patients.search')}
              placeholderTextColor={Palette.ink3}
              autoCorrect={false}
              style={styles.search}
            />
          )}
          {visible.map(renderItem)}
          {items.length > 0 && visible.length === 0 && (
            <View style={styles.center}>
              <AppText color={Palette.ink2}>{t('patients.none')}</AppText>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: 8,
  },
  center: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  search: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Palette.line,
    backgroundColor: Palette.surface,
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: Palette.ink,
  },
  item: {
    borderRadius: 18,
    borderWidth: 0.65,
    borderColor: Palette.line,
    backgroundColor: Palette.surface,
    boxShadow: Shadow.card,
  },
  itemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  itemText: {
    flex: 1,
    gap: 2,
  },
  history: {
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 0.65,
    borderTopColor: Palette.line,
  },
  pressed: {
    opacity: 0.7,
  },
});
