// Auth abstraction for the Super Admin Dashboard.
//
// AUTHENTICATION vs AUTHORIZATION — the distinction this file exists to keep:
//   - Firebase Auth (email + password) proves WHO you are. It grants nothing.
//   - admins/{uid} decides WHAT you may do. It is the only authoritative signal,
//     and only a super admin can write it (enforced in firestore.rules).
//
// Access therefore requires: the record exists AND active === true AND role is
// one of 'super_admin' | 'agency_admin' (an agency_admin additionally needs a
// non-empty agencyId). Every sign-in path in this file funnels through the same
// resolveUser() gate, and every path signs the user back out when it fails, so
// an unauthorized identity never holds a half-authenticated session.
//
// No sign-in path provisions anything. An authenticated account with no admin
// record is simply not an administrator.
//
// There is exactly ONE way in: email + password, against an account a super
// admin created on the Administrators page. Federated sign-in was removed
// deliberately — it let anyone with a Google account reach the password-less
// half of the gate, and every identity that matters here is one the super
// admin issued in the first place. Fewer doors, and each one has a known key.
//
// Components never call the Firebase auth SDK directly — they go through here
// (and the AuthContext, which owns the onAuthStateChanged subscription).

import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase/config';
import { COLLECTIONS } from '@/firebase/collections';
import type { AdminRecord, AppUser } from '@/types';

/**
 * Reads admins/{uid}. Returns null when the document genuinely does not exist,
 * and THROWS when the read itself failed.
 *
 * The distinction matters: "there is no admin record for you" and "we could not
 * check" are different answers, and collapsing them told a real admin their
 * account lacked access whenever the network hiccuped. Callers still deny access
 * in both cases — this only lets them say which one happened.
 */
async function getAdminRecord(uid: string): Promise<AdminRecord | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.admins, uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as AdminRecord;
}

/**
 * The exact authorization gate, mirroring firestore.rules isActiveAdmin():
 * the record must exist, be active, and carry one of the two real tiers.
 *
 * An agency_admin additionally MUST carry a non-empty agencyId. A scoped admin
 * without an agency would be denied every agency-owned write by the rules
 * anyway, so admitting them to the dashboard would only produce a session that
 * silently fails on everything it touches.
 */
function recordGrantsAdmin(record: AdminRecord | null): boolean {
  if (!record || record.active !== true) return false;
  if (record.role === 'super_admin') return true;
  return record.role === 'agency_admin' && !!record.agencyId?.trim();
}

/** Maps a Firebase user + their admin record into the dashboard's AppUser. */
function toAppUser(fbUser: FirebaseUser, record: AdminRecord): AppUser {
  const isSuperAdmin = record.role === 'super_admin';
  return {
    uid:          fbUser.uid,
    email:        fbUser.email,
    displayName:  record.displayName ?? fbUser.displayName,
    photoURL:     fbUser.photoURL,
    role:         record.role,
    isSuperAdmin,
    // A super admin is global and deliberately carries no agency.
    agencyId:     isSuperAdmin ? undefined : record.agencyId,
  };
}

export const authService = {
  getAdminRecord,

  /**
   * True only if admins/{uid} exists, is active, and carries a valid tier.
   * Denies access if the record cannot be read — this fails closed on purpose.
   */
  async checkIsAdmin(uid: string): Promise<boolean> {
    try {
      return recordGrantsAdmin(await getAdminRecord(uid));
    } catch (err) {
      console.error('[authService] checkIsAdmin:', err);
      return false;
    }
  },

  /**
   * Resolves a signed-in Firebase user into a fully-formed AppUser by reading
   * their admin record. Returns null if the user is NOT a valid admin — the
   * caller should then sign them out and reject access. Propagates a read
   * failure so the caller can tell "not an admin" from "could not check".
   */
  async resolveUser(fbUser: FirebaseUser): Promise<AppUser | null> {
    const record = await getAdminRecord(fbUser.uid);
    if (!record || !recordGrantsAdmin(record)) return null;
    return toAppUser(fbUser, record);
  },

  /**
   * Signs in with email/password, then verifies admin status. The user is signed
   * back out unless the verification positively grants admin access, so a failed
   * check never leaves a half-authenticated session behind.
   */
  async login(email: string, password: string): Promise<AppUser> {
    const { user: fbUser } = await signInWithEmailAndPassword(auth, email.trim(), password);

    let appUser: AppUser | null;
    try {
      appUser = await this.resolveUser(fbUser);
    } catch (err) {
      // The credentials were fine; we simply could not read admins/{uid}.
      // Saying "no admin access" here would send a real admin chasing a
      // permissions problem that does not exist.
      console.error('[authService] login verification failed:', err);
      await firebaseSignOut(auth);
      throw new Error('Could not verify your access. Check your connection and try again.', {
        cause: err,
      });
    }

    if (!appUser) {
      await firebaseSignOut(auth);
      throw new Error('This account does not have admin access.');
    }
    return appUser;
  },

  /** Signs out the current user. Safe to call when not signed in. */
  async logout(): Promise<void> {
    if (auth.currentUser) await firebaseSignOut(auth);
  },
};
