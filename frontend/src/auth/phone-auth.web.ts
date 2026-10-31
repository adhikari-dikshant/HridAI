import type { CheckCode } from './phone-auth';

// Firebase phone login has no web version here. This stand-in lets the login screen run in a
// browser against a local AUTH_MODE=dev backend. A production backend refuses its token.

const WEB_CODE = '123456';

const listeners = new Set<(signedIn: boolean) => void>();
let signedIn = false;

function setSignedIn(value: boolean) {
  signedIn = value;
  listeners.forEach((listener) => listener(value));
}

export function watchLogin(onChange: (signedIn: boolean) => void) {
  listeners.add(onChange);
  onChange(signedIn);
  return () => {
    listeners.delete(onChange);
  };
}

export async function sendCode(_phoneNumber: string): Promise<CheckCode> {
  return async (code) => {
    if (code !== WEB_CODE) throw Object.assign(new Error('Wrong code'), { code: 'auth/invalid-verification-code' });
    setSignedIn(true);
  };
}

export async function getLoginToken() {
  return signedIn ? 'dev:web_user' : null;
}

export async function logOut() {
  setSignedIn(false);
}
