// Admins registry data layer — manage the access-control gate (admins/{uid}).
//
// Writes here are gated on isSuperAdmin() in firestore.rules (deployed); reads
// work for any signed-in user, because the gate check itself needs them.
//
// The doc id IS the Firebase Auth uid. Two ways to obtain one:
//   - adminProvisioningService.createAuthAccount() creates the Auth account from
//     the dashboard (on an isolated secondary app, so the super admin's own
//     session is untouched), then this service writes the record; or
//   - paste the uid of an account created in the Firebase Console.
//
// The `active` + `role` fields MUST stay `true` / `'admin'` for a working admin
// (the mobile app + rules check them exactly). Super tier = additive superAdmin.
//
// DEACTIVATE vs DELETE: `setActive(false)` is the safe removal — it revokes
// access in both apps and in the rules immediately. `remove()` deletes only the
// Firestore record; the Firebase Auth account survives and must be deleted from
// the Console (the Admin SDK required to do it from code must never be shipped
// to a browser).

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
import type { AdminRecord } from '@/types';

export interface AdminInput {
  /** The Firebase Auth uid — becomes the document id. */
  uid: string;
  email?: string;
  displayName?: string;
  active?: boolean;
  superAdmin?: boolean;
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
        const sa = Number(b.superAdmin ?? false) - Number(a.superAdmin ?? false);
        if (sa !== 0) return sa;
        return (a.email ?? a.uid).localeCompare(b.email ?? b.uid);
      });
  },

  async get(uid: string): Promise<AdminRecord | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.admins, uid));
    return snap.exists() ? ({ uid: snap.id, ...snap.data() } as AdminRecord) : null;
  },

  /**
   * Creates or updates an admin record for an existing Auth uid. Always sets
   * role: 'admin' + active (default true) so the mobile gate keeps working.
   * `createdAt`/`createdBy` are written only on first creation — editing an
   * admin must not rewrite when they were onboarded.
   */
  async upsert(input: AdminInput): Promise<void> {
    const ref = doc(db, COLLECTIONS.admins, input.uid);
    const existing = await getDoc(ref);
    await setDoc(
      ref,
      {
        role: 'admin',
        active: input.active ?? true,
        ...(input.email ? { email: input.email.trim() } : {}),
        ...(input.displayName ? { displayName: input.displayName.trim() } : {}),
        ...(input.superAdmin !== undefined ? { superAdmin: input.superAdmin } : {}),
        // '' clears the scope; undefined leaves it untouched.
        ...(input.agencyId !== undefined ? { agencyId: input.agencyId } : {}),
        ...(existing.exists()
          ? {}
          : { createdAt: Date.now(), ...(input.createdBy ? { createdBy: input.createdBy } : {}) }),
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  },

  /** Activate / deactivate an admin (keeps role: 'admin'). */
  async setActive(uid: string, active: boolean): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.admins, uid), { active });
  },

  /** Grant / revoke the super-admin tier via the additive flag. */
  async setSuperAdmin(uid: string, superAdmin: boolean): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.admins, uid), { superAdmin });
  },

  /** Scope an admin to an agency (foundation for future company-admin tier). */
  async assignAgency(uid: string, agencyId: string | null): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.admins, uid), { agencyId: agencyId ?? '' });
  },

  /** Removes the admin record (does NOT delete the Firebase Auth user). */
  async remove(uid: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.admins, uid));
  },
};
