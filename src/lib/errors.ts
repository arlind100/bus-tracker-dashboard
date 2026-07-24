// Human-friendly messages for the Firebase errors the dashboard can surface.

interface CodedError {
  code?: string;
  message?: string;
}

/**
 * Maps a Firebase/Firestore error to a clear message. Notably explains the two
 * permission cases that depend on the proposed rules (admins writes, schedules)
 * so an operator isn't left staring at a raw "permission-denied".
 */
export function describeFirebaseError(err: unknown, context?: 'admins' | 'schedules'): string {
  const e = err as CodedError;
  const code = e?.code ?? '';

  if (code === 'permission-denied' || /permission/i.test(e?.message ?? '')) {
    if (context === 'admins') {
      return 'Permission denied. Managing administrators requires deploying the proposed Firestore rule that allows super-admin writes to the admins collection (see docs/PROPOSED_FIRESTORE_RULES.md).';
    }
    if (context === 'schedules') {
      return 'Permission denied. Schedules require deploying the proposed Firestore rule (schedules are denied to clients by default — see docs/PROPOSED_FIRESTORE_RULES.md).';
    }
    return 'Permission denied. Your account may lack the required access, or a Firestore rule update is needed.';
  }

  if (code === 'unavailable') return 'Firestore is temporarily unavailable. Check your connection and try again.';
  if (code === 'not-found') return 'The requested record no longer exists.';

  return e?.message || 'Something went wrong. Please try again.';
}
