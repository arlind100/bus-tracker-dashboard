// Auth abstraction for the Super Admin Dashboard.
//
// Mirrors the mobile app's auth.service.ts trust model exactly:
//   - the ONLY authoritative role signal is the admins/{uid} document
//   - admin access requires: doc exists AND active === true AND role === 'admin'
//     (identical to the mobile client + Firestore rules — do not diverge)
//   - super-admin powers are gated additionally on superAdmin === true
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
import type { AdminRecord, AppUser, UserRole } from '@/types';

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
 * The exact admin gate — matches mobile checkIsAdmin() and firestore.rules
 * isAdmin(): the doc must exist AND be active AND carry role 'admin'.
 */
function recordGrantsAdmin(record: AdminRecord | null): boolean {
  return !!record && record.active === true && record.role === 'admin';
}

/** Maps a Firebase user + their admin record into the dashboard's AppUser. */
function toAppUser(fbUser: FirebaseUser, record: AdminRecord | null): AppUser {
  const isSuperAdmin = recordGrantsAdmin(record) && record?.superAdmin === true;
  const role: UserRole = isSuperAdmin ? 'super_admin' : 'admin';
  return {
    uid:          fbUser.uid,
    email:        fbUser.email,
    displayName:  record?.displayName ?? fbUser.displayName,
    photoURL:     fbUser.photoURL,
    role,
    isSuperAdmin,
    agencyId:     record?.agencyId,
  };
}

export const authService = {
  getAdminRecord,

  /**
   * True only if admins/{uid} exists, is active, and has role 'admin'.
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
    if (!recordGrantsAdmin(record)) return null;
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
