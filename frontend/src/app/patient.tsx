import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { api } from '@/api/client';
import type {
  Consent,
  KnownCondition,
  Patient,
  PatientDetails,
  Sex,
  Symptom,
  UpdatePatientRequest,
} from '@/api/types';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ChoiceChip } from '@/components/choice-chip';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { StepProgress } from '@/components/step-progress';
import { FontFamily, Palette } from '@/constants/theme';
import { useScreening } from '@/state/screening';

const CONSENT: Consent = { accepted: true, version: 'v1' };
const SEXES: Sex[] = ['male', 'female', 'other'];
const SYMPTOMS: Symptom[] = [
  'chest_pain',
  'breathlessness',
  'palpitations',
  'fatigue',
  'fainting',
  'swelling',
];
const CONDITIONS: KnownCondition[] = ['hypertension', 'diabetes', 'known_heart_disease', 'other'];

export default function PatientScreen() {
  const { t, lang, startSession } = useScreening();
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();

  // The profile on the server. Kept after creating one, so a retry never adds it twice.
  const [saved, setSaved] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(Boolean(patientId));
  const [loadFailed, setLoadFailed] = useState(false);
  const [label, setLabel] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [conditions, setConditions] = useState<KnownCondition[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ageYears = Number(age);
  const ageValid = age.trim() !== '' && Number.isInteger(ageYears) && ageYears >= 0 && ageYears <= 110;

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    api
      .getPatient(patientId)
      .then((patient) => {
        if (cancelled) return;
        setSaved(patient);
        setLabel(patient.label);
        setAge(String(patient.age_years));
        setSex(patient.sex);
        setHeight(patient.height_cm?.toString() ?? '');
        setWeight(patient.weight_kg?.toString() ?? '');
        setConditions(patient.known_conditions);
      })
      .catch(() => !cancelled && setLoadFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  async function savePatient(details: PatientDetails) {
    if (!saved) return api.createPatient({ consent: CONSENT, ...details });

    const changes: UpdatePatientRequest = Object.fromEntries(
      Object.entries(details).filter(
        ([key, value]) =>
          JSON.stringify(value) !== JSON.stringify(saved[key as keyof PatientDetails])
      )
    );
    return Object.keys(changes).length > 0 ? api.updatePatient(saved.patient_id, changes) : saved;
  }

  async function submit() {
    const trimmedLabel = label.trim();
    if (!trimmedLabel || !ageValid || !sex) {
      setShowErrors(true);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const patient = await savePatient({
        label: trimmedLabel,
        age_years: ageYears,
        sex,
        height_cm: toNumber(height) ?? null,
        weight_kg: toNumber(weight) ?? null,
        known_conditions: conditions,
      });
      setSaved(patient);
      const created = await api.createScreening({
        language: lang,
        consent: CONSENT,
        patient_id: patient.patient_id,
        symptoms,
      });
      startSession(created, patient, symptoms);
      router.push({ pathname: '/guide', params: { location: created.required_locations[0] } });
    } catch {
      setError(t('genericError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || loadFailed) {
    return (
      <Screen title={t('patient.title')} centered>
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={Palette.brand} />
          ) : (
            <AppText color={Palette.ink2} align="center">
              {t('genericError')}
            </AppText>
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title={t('patient.title')}
      gap={20}
      footer={<Button label={t('continue')} loading={submitting} onPress={submit} />}>
      <StepProgress step={2} name={t('patient.title')} />

      <View style={styles.heading}>
        <AppText size={28} leading={34} weight="medium" tracking={-0.448}>
          {t('patient.heading')}
        </AppText>
        <AppText size={15} leading={22} color={Palette.ink2}>
          {t('patient.sub')}
        </AppText>
      </View>

      <View style={styles.group}>
        <FieldLabel label={t('patient.label')} required />
        <View style={[styles.input, showErrors && !label.trim() && styles.inputError]}>
          <TextInput
            value={label}
            onChangeText={setLabel}
            maxLength={40}
            autoCorrect={false}
            accessibilityLabel={t('patient.label')}
            placeholder={t('patient.labelHint')}
            placeholderTextColor={Palette.ink3}
            style={styles.inputText}
          />
        </View>
        {showErrors && !label.trim() && <ErrorText text={t('patient.labelError')} />}
      </View>

      <Field
        label={t('patient.age')}
        required
        unit={t('patient.years')}
        value={age}
        onChangeText={setAge}
        integer
        error={showErrors && !ageValid ? t('patient.ageError') : undefined}
      />

      <View style={styles.group}>
        <FieldLabel label={t('patient.sex')} required />
        <Segmented
          tone="brand"
          value={sex}
          onChange={setSex}
          options={SEXES.map((option) => ({ value: option, label: t(`patient.${option}`) }))}
        />
        {showErrors && !sex && <ErrorText text={t('patient.sexError')} />}
      </View>

      <View style={styles.row}>
        <Field
          label={t('patient.height')}
          unit={t('patient.cm')}
          value={height}
          onChangeText={setHeight}
        />
        <Field
          label={t('patient.weight')}
          unit={t('patient.kg')}
          value={weight}
          onChangeText={setWeight}
        />
      </View>

      <View style={styles.chipGroup}>
        <FieldLabel label={t('patient.symptoms')} />
        <View style={styles.chips}>
          {SYMPTOMS.map((option) => (
            <ChoiceChip
              key={option}
              label={t(`symptom.${option}`)}
              selected={symptoms.includes(option)}
              onPress={() => setSymptoms(toggle(symptoms, option))}
            />
          ))}
        </View>
      </View>

      <View style={styles.chipGroup}>
        <FieldLabel label={t('patient.conditions')} />
        <View style={styles.chips}>
          {CONDITIONS.map((option) => (
            <ChoiceChip
              key={option}
              label={t(`condition.${option}`)}
              selected={conditions.includes(option)}
              onPress={() => setConditions(toggle(conditions, option))}
            />
          ))}
        </View>
      </View>

      {error && <ErrorText text={error} />}
    </Screen>
  );
}

function FieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  const { t } = useScreening();
  return (
    <View style={styles.label}>
      <AppText size={14} weight="medium">
        {label}
      </AppText>
      <AppText size={12} weight="medium" color={required ? Palette.brand : Palette.ink3}>
        {t(required ? 'required' : 'optional')}
      </AppText>
    </View>
  );
}

function Field({
  label,
  unit,
  value,
  onChangeText,
  required = false,
  integer = false,
  error,
}: {
  label: string;
  unit: string;
  value: string;
  onChangeText: (text: string) => void;
  required?: boolean;
  integer?: boolean;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <FieldLabel label={label} required={required} />
      <View style={[styles.input, error && styles.inputError]}>
        <TextInput
          value={value}
          onChangeText={(text) => onChangeText(text.replace(integer ? /[^0-9]/g : /[^0-9.]/g, ''))}
          keyboardType={integer ? 'number-pad' : 'decimal-pad'}
          maxLength={5}
          accessibilityLabel={`${label} (${unit})`}
          placeholderTextColor={Palette.ink3}
          style={styles.inputText}
        />
        <AppText size={15} color={Palette.ink3}>
          {unit}
        </AppText>
      </View>
      {error && <ErrorText text={error} />}
    </View>
  );
}

function ErrorText({ text }: { text: string }) {
  return (
    <AppText size={13} color={Palette.brand}>
      {text}
    </AppText>
  );
}

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function toNumber(text: string) {
  const value = Number(text);
  return text.trim() !== '' && Number.isFinite(value) && value > 0 ? value : undefined;
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
  heading: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  group: {
    gap: 8,
  },
  chipGroup: {
    gap: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  field: {
    flex: 1,
    gap: 8,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Palette.line,
    backgroundColor: Palette.surface,
  },
  inputError: {
    borderColor: Palette.brand,
  },
  inputText: {
    flex: 1,
    height: '100%',
    fontFamily: FontFamily.medium,
    fontSize: 17,
    color: Palette.ink,
  },
});
