import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { requiresLogin } from '@/api/client';
import { watchLogin } from '@/auth/phone-auth';

/** null until the saved login has been read. */
const AuthContext = createContext<boolean | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(requiresLogin ? null : true);

  useEffect(() => (requiresLogin ? watchLogin(setSignedIn) : undefined), []);

  return <AuthContext value={signedIn}>{children}</AuthContext>;
}

export function useSignedIn() {
  return use(AuthContext);
}
