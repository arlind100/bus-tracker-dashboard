import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/firebase/config';
import { authService } from '@/services/auth.service';
import { AuthContext, type AuthStatus } from '@/contexts/auth-context';
import type { AppUser } from '@/types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async fbUser => {
      if (!fbUser) {
        setUser(null);
        setStatus('unauthenticated');
        return;
      }
      let appUser: AppUser | null = null;
      try {
        appUser = await authService.resolveUser(fbUser);
      } catch (err) {
        console.error('[AuthProvider] could not verify admin access:', err);
      }

      if (!appUser) {
        await signOut(auth);
        setUser(null);
        setStatus('unauthenticated');
        return;
      }
      setUser(appUser);
      setStatus('authenticated');
    });
    return unsub;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    return authService.login(email, password);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
