import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/firebase/config';
import { authService } from '@/services/auth.service';
import { AuthContext, type AuthStatus } from '@/contexts/auth-context';
import type { AppUser } from '@/types';

/**
 * Owns the single onAuthStateChanged subscription for the whole app. On every
 * auth-state change it re-verifies admin access against admins/{uid} (mirroring
 * the mobile (admin)/_layout guard): a signed-in user who is NOT a valid admin
 * is signed back out and treated as unauthenticated.
 */
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
      // resolveUser throws if admins/{uid} could not be READ (as opposed to
      // answering "not an admin"). Both outcomes revoke the session — the guard
      // fails closed — but only the first is an error worth logging.
      let appUser: AppUser | null = null;
      try {
        appUser = await authService.resolveUser(fbUser);
      } catch (err) {
        console.error('[AuthProvider] could not verify admin access:', err);
      }

      if (!appUser) {
        // Signed-in but not a verified admin — revoke the session.
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
    // resolveUser + state updates are driven by onAuthStateChanged above; we
    // return the resolved user here so the caller can react immediately.
    return authService.login(email, password);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    return authService.loginWithGoogle();
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
