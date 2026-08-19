import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase/config';
import { COLLECTIONS } from '@/firebase/collections';
import type { AdminRecord, AppUser } from '@/types';

async function getAdminRecord(uid: string): Promise<AdminRecord | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.admins, uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as AdminRecord;
}

function recordGrantsAdmin(record: AdminRecord | null): boolean {
  if (!record || record.active !== true) return false;
  if (record.role === 'super_admin') return true;
  return record.role === 'agency_admin' && !!record.agencyId?.trim();
}

function toAppUser(fbUser: FirebaseUser, record: AdminRecord): AppUser {
  const isSuperAdmin = record.role === 'super_admin';
  return {
    uid:          fbUser.uid,
    email:        fbUser.email,
    displayName:  record.displayName ?? fbUser.displayName,
    photoURL:     fbUser.photoURL,
    role:         record.role,
    isSuperAdmin,
    agencyId:     isSuperAdmin ? undefined : record.agencyId,
  };
}

export const authService = {
  getAdminRecord,

  async checkIsAdmin(uid: string): Promise<boolean> {
    try {
      return recordGrantsAdmin(await getAdminRecord(uid));
    } catch (err) {
      console.error('[authService] checkIsAdmin:', err);
      return false;
    }
  },

  async resolveUser(fbUser: FirebaseUser): Promise<AppUser | null> {
    const record = await getAdminRecord(fbUser.uid);
    if (!record || !recordGrantsAdmin(record)) return null;
    return toAppUser(fbUser, record);
  },

  async login(email: string, password: string): Promise<AppUser> {
    const { user: fbUser } = await signInWithEmailAndPassword(auth, email.trim(), password);

    let appUser: AppUser | null;
    try {
      appUser = await this.resolveUser(fbUser);
    } catch (err) {
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

  async logout(): Promise<void> {
    if (auth.currentUser) await firebaseSignOut(auth);
  },
};
