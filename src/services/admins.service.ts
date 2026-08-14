// Admins registry data layer — the access-control gate (admins/{uid}).
//
// This collection IS the authorization system. Writing a record here is what
// turns an authenticated identity into an administrator; nothing else does.
// Writes are gated on isSuperAdmin() in firestore.rules, so only a super admin
// can provision anyone — including through Google sign-in, which resolves
// against these records and provisions nothing on its own.
//
// The doc id IS the Firebase Auth uid. Two ways to obtain one:
//   - adminProvisioningService.createAuthAccount() creates the Auth account from
//     the dashboard (on an isolated secondary app, so the super admin's own
//     session is untouched), then this service writes the record; or
//   - paste the uid of an account created in the Firebase Console (this is how
//     you authorize an existing Google account).
//
// `role` is the single source of truth for the tier, and the rules validate it:
//   super_admin  — platform-wide; must NOT carry an agencyId
//   agency_admin — must carry a non-empty agencyId
//
// DEACTIVATE vs DELETE: `setActive(false)` is the safe removal — it revokes
// access in the dashboard and in the rules immediately. `remove()` deletes only
// the Firestore record; the Firebase Auth account survives and must be deleted
// from the Console (the Admin SDK required to do it from code must never be
// shipped to a browser).

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { COLLECTIONS } from '@/firebase/collections';
import type { AdminRecord, AdminRole } from '@/types';

export interface AdminInput {
  /** The Firebase Auth uid — becomes the document id. */
  uid: string;
  role: AdminRole;
  email?: string;
  displayName?: string;
  active?: boolean;
  /** Required when role is 'agency_admin'; ignored for a super admin. */
  agencyId?: string;
  /** uid of the super admin performing the creation (attribution). */
  createdBy?: string;
}

export const adminsService = {
  /** All admin records, super admins first, then by email. */
  async list(): Promise<AdminRecord[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.admins));
    return snap.docs
      .map(d => ({ uid: d.id, ...d.data() } as AdminRecord))
      .sort((a, b) => {
        const sa = Number(b.role === 'super_admin') - Number(a.role === 'super_admin');
        if (sa !== 0) return sa;
        return (a.email ?? a.uid).localeCompare(b.email ?? b.uid);
      });
  },

  async get(uid: string): Promise<AdminRecord | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.admins, uid));
    return snap.exists() ? ({ uid: snap.id, ...snap.data() } as AdminRecord) : null;
  },

  /**
   * Creates or updates an admin record for an existing Auth uid.
   *
   * The two tier invariants the rules enforce are applied here too, so the UI
   * cannot even attempt an invalid write: an agency_admin always carries its
   * agencyId, and a super_admin always carries '' (they are global by
   * definition, and a stale agency on a super admin would be misleading).
   *
   * `createdAt`/`createdBy` are written only on first creation — editing an
   * admin must not rewrite when they were onboarded.
   */
  async upsert(input: AdminInput): Promise<void> {
    const agencyId = input.role === 'agency_admin' ? (input.agencyId ?? '').trim() : '';
    if (input.role === 'agency_admin' && !agencyId) {
      throw new Error('An agency administrator must be assigned to an agency.');
    }

    const ref = doc(db, COLLECTIONS.admins, input.uid);
    const existing = await getDoc(ref);
    await setDoc(
      ref,
      {
        role: input.role,
        active: input.active ?? true,
        agencyId,
        ...(input.email ? { email: input.email.trim() } : {}),
        ...(input.displayName ? { displayName: input.displayName.trim() } : {}),
        ...(existing.exists()
          ? {}
          : { createdAt: Date.now(), ...(input.createdBy ? { createdBy: input.createdBy } : {}) }),
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  },

  /**
   * Activate / deactivate an admin. Deactivating is the safe way to remove
   * access: the rules stop honouring the record immediately.
   */
  async setActive(uid: string, active: boolean): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.admins, uid), { active, updatedAt: Date.now() });
  },

  /** Removes the admin record (does NOT delete the Firebase Auth user). */
  async remove(uid: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.admins, uid));
  },
};
