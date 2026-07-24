import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { logAdminUpdate } from '@/lib/firestore';

/**
 * Returns a stable `log(action, detail, targetId?)` that appends an entry to the
 * adminUpdates audit trail attributed to the signed-in admin. Best-effort — a
 * failed audit write never blocks the primary mutation.
 */
export function useAuditLog() {
  const { user } = useAuth();
  return useCallback(
    (action: string, detail: string, targetId?: string) => {
      if (!user) return Promise.resolve();
      return logAdminUpdate({ adminUid: user.uid, action, detail, targetId });
    },
    [user],
  );
}
