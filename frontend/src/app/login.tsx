import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { sendCode, type CheckCode } from '@/auth/phone-auth';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Note } from '@/components/note';
import { Screen } from '@/components/screen';
import { FontFamily, Palette } from '@/constants/theme';
import type { StringKey } from '@/i18n/strings';
import { useSignedIn } from '@/state/auth';
import { useScreening } from '@/state/screening';

const COUNTRY_CODE = '+91';
const PHONE_LENGTH = 10;
const CODE_LENGTH = 6;

const LOGIN_ERRORS: Record<string, StringKey> = {
  'auth/invalid-phone-number': 'login.badPhone',
  'auth/too-many-requests': 'login.tooMany',
  'auth/invalid-verification-code': 'login.badCode',
  'auth/code-expired': 'login.expired',
  'auth/session-expired': 'login.expired',
  'auth/network-request-failed': 'error.offline',
};

export default function LoginScreen() {
  const { t } = useScreening();
  const signedIn = useSignedIn();

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  // Wrapped in an object because useState would call a bare function.
  const [pending, setPending] = useState<{ check: CheckCode } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Android can read the SMS itself and finish the login without a typed code.
  if (signedIn) return <Redirect href="/patients" />;

  function showError(cause: unknown) {
    const key = LOGIN_ERRORS[(cause as { code?: string }).code ?? ''];
    setError(t(key ?? 'genericError'));
  }

  async function requestCode() {
    if (phone.length !== PHONE_LENGTH) {
      setError(t('login.badPhone'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      setPending({ check: await sendCode(`${COUNTRY_CODE}${phone}`) });
      setCode('');
    } catch (cause) {
      showError(cause);
    } finally {
      setBusy(false);
    }
  }

  async function checkCode() {
    if (!pending) return;
    if (code.length !== CODE_LENGTH) {
      setError(t('login.badCode'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await pending.check(code);
    } catch (cause) {
      showError(cause);
      setBusy(false);
    }
  }

  function changeNumber() {
    setPending(null);
    setCode('');
    setError(null);
  }

  return (
    <Screen
      title={t('login.title')}
      gap={20}
      footer={
        pending ? (
          <>
            <Button label={t('login.verify')} loading={busy} onPress={checkCode} />
            <Button label={t('login.resend')} variant="ghost" disabled={busy} onPress={requestCode} />
            <Button label={t('login.changeNumber')} variant="ghost" disabled={busy} onPress={changeNumber} />
          </>
        ) : (
          <Button label={t('login.sendCode')} loading={busy} onPress={requestCode} />
        )
      }>
      <View style={styles.heading}>
        <AppText size={28} leading={34} weight="medium" tracking={-0.448}>
          {t(pending ? 'login.codeHeading' : 'login.heading')}
        </AppText>
        <AppText size={15} leading={22} color={Palette.ink2}>
          {pending ? t('login.codeSub', { phone: `${COUNTRY_CODE} ${phone}` }) : t('login.sub')}
        </AppText>
      </View>

      {pending ? (
        <View style={styles.input}>
          <TextInput
            value={code}
            onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={CODE_LENGTH}
            accessibilityLabel={t('login.code')}
            placeholder={t('login.code')}
            placeholderTextColor={Palette.ink3}
            style={styles.inputText}
          />
        </View>
      ) : (
        <View style={styles.input}>
          <AppText size={17} weight="medium" color={Palette.ink2}>
            {COUNTRY_CODE}
          </AppText>
          <TextInput
            value={phone}
            onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ''))}
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={PHONE_LENGTH}
            accessibilityLabel={t('login.phone')}
            placeholder={t('login.phone')}
            placeholderTextColor={Palette.ink3}
            style={styles.inputText}
          />
        </View>
      )}

      {error && (
        <AppText size={13} color={Palette.brand}>
          {error}
        </AppText>
      )}

      <Note text={t('login.privacy')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: 8,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Palette.line,
    backgroundColor: Palette.surface,
  },
  inputText: {
    flex: 1,
    height: '100%',
    fontFamily: FontFamily.medium,
    fontSize: 17,
    color: Palette.ink,
  },
});
