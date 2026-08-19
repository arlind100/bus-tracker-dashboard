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
  uid: string;
  role: AdminRole;
  email?: string;
  displayName?: string;
  active?: boolean;
  agencyId?: string;
  createdBy?: string;
}

export const adminsService = {
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

  async setActive(uid: string, active: boolean): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.admins, uid), { active, updatedAt: Date.now() });
  },

  async remove(uid: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.admins, uid));
  },
};
