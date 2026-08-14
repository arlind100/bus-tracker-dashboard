import { createContext } from 'react';
import type { AppUser } from '@/types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  user: AppUser | null;
  status: AuthStatus;
  /** Signs in and verifies admin access. Throws on bad creds / non-admin. */
  login: (email: string, password: string) => Promise<AppUser>;
  /**
   * Signs in with Google and applies the same authorization gate. Throws when
   * the Google account has no active admins/{uid} record — it is never
   * provisioned one automatically.
   */
  loginWithGoogle: () => Promise<AppUser>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
