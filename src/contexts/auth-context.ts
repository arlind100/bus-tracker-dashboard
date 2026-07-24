import { createContext } from 'react';
import type { AppUser } from '@/types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  user: AppUser | null;
  status: AuthStatus;
  /** Signs in and verifies admin access. Throws on bad creds / non-admin. */
  login: (email: string, password: string) => Promise<AppUser>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
