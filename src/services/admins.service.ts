// Admins registry data layer — manage the access-control gate (admins/{uid}).
//
// ⚠️ TWO external prerequisites for the WRITE paths here:
//
//  1. Firestore rules currently deny ALL client writes to `admins`
//     (`allow write: if false`). Super-admin management requires deploying the
//     proposed rule change (see docs/PROPOSED_FIRESTORE_RULES.md) that allows
//     writes when isSuperAdmin(). Reads already work for any signed-in user.
//
//  2. A Firebase AUTH account cannot be created from the browser without signing
//     that user in. The doc id here is the Auth uid, so an admin's Auth user must
//     be provisioned first (Firebase Console or a trusted Admin-SDK backend);
//     this service then writes/updates their admins/{uid} record.
//
// The `active` + `role` fields MUST stay `true` / `'admin'` for a working admin
// (the mobile app + rules check them exactly). Super tier = additive superAdmin.

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
   * Creates or overwrites an admin record for an existing Auth uid. Always sets
   * role: 'admin' + active (default true) so the mobile gate keeps working.
   */
  async upsert(input: AdminInput): Promise<void> {
    await setDoc(
      doc(db, COLLECTIONS.admins, input.uid),
      {
        role: 'admin',
        active: input.active ?? true,
        ...(input.email ? { email: input.email.trim() } : {}),
        ...(input.displayName ? { displayName: input.displayName.trim() } : {}),
        ...(input.superAdmin !== undefined ? { superAdmin: input.superAdmin } : {}),
        ...(input.agencyId ? { agencyId: input.agencyId } : {}),
        ...(input.createdBy ? { createdBy: input.createdBy } : {}),
        createdAt: Date.now(),
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
