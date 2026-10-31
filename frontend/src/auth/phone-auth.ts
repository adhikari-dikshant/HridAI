import {
  getAuth,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signOut,
} from '@react-native-firebase/auth';

export type CheckCode = (code: string) => Promise<void>;

/** Firebase keeps the login on the device, so it survives app restarts. */
export function watchLogin(onChange: (signedIn: boolean) => void) {
  return onAuthStateChanged(getAuth(), (user) => onChange(Boolean(user)));
}

/** Sends the SMS. Firebase's test numbers skip it and use the code set in the console. */
export async function sendCode(phoneNumber: string): Promise<CheckCode> {
  const confirmation = await signInWithPhoneNumber(getAuth(), phoneNumber);
  return async (code) => {
    await confirmation.confirm(code);
  };
}

export async function getLoginToken() {
  return (await getAuth().currentUser?.getIdToken()) ?? null;
}

export function logOut() {
  return signOut(getAuth());
}
