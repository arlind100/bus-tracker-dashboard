// Human-friendly messages for the Firebase errors the dashboard can surface.

interface CodedError {
  code?: string;
  message?: string;
}

/**
 * Maps a Firebase/Firestore error to a clear message, so an operator is never
 * left staring at a raw "permission-denied". The security rules are deployed and
 * verified, so a denial now means the ACCOUNT lacks the tier or agency scope —
 * the message says which.
 */
export function describeFirebaseError(err: unknown, context?: 'admins' | 'schedules' | 'agency'): string {
  const e = err as CodedError;
  const code = e?.code ?? '';

  if (code === 'permission-denied' || /permission/i.test(e?.message ?? '')) {
    if (context === 'admins') {
      return 'Permission denied. Only a super admin can manage the administrator registry, and no one may deactivate or demote their own account.';
    }
    if (context === 'schedules') {
      return 'Permission denied. Editing timetables requires an active administrator account.';
    }
    if (context === 'agency') {
      return "Permission denied. Your account is scoped to one agency and cannot change another agency's data.";
    }
    return 'Permission denied. Your account does not have access to this operation.';
  }

  if (code === 'unavailable') return 'Firestore is temporarily unavailable. Check your connection and try again.';
  if (code === 'not-found') return 'The requested record no longer exists.';

  return e?.message || 'Something went wrong. Please try again.';
}
