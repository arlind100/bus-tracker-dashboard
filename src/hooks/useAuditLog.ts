import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { logAdminUpdate } from '@/lib/firestore';

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
