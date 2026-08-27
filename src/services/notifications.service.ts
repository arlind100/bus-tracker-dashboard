import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { COLLECTIONS } from '@/firebase/collections';
import { scopeOwnedOrGlobal } from '@/lib/scope';
import { toDoc } from '@/lib/firestore';
import type { Notification, NotificationKind } from '@/types';

const NOTIFICATION_COLORS: Record<NotificationKind, string> = {
  delay: '#F59E0B',
  arrive: '#16A34A',
  update: '#4F46E5',
};

export interface NotificationInput {
  kind: NotificationKind;
  title: string;
  body: string;
  agencyId?: string;
}

export const notificationsService = {
  async list(scopeAgencyId?: string): Promise<Notification[]> {
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.notifications), orderBy('createdAt', 'desc')),
    );
    // Broadcasts carry no agencyId, so a scoped admin sees those alongside their own.
    return scopeOwnedOrGlobal(snap.docs.map(d => toDoc<Notification>(d)), scopeAgencyId);
  },

  async create(input: NotificationInput, actorUid?: string): Promise<string> {
    const ref = await addDoc(collection(db, COLLECTIONS.notifications), {
      agencyId: input.agencyId?.trim() ?? '',
      kind: input.kind,
      title: input.title.trim(),
      body: input.body.trim(),
      time: 'just now',
      color: NOTIFICATION_COLORS[input.kind],
      source: 'dashboard-console',
      createdAt: Date.now(),
      ...(actorUid ? { createdBy: actorUid, updatedBy: actorUid } : {}),
    });
    return ref.id;
  },

  async update(id: string, patch: Partial<NotificationInput>, actorUid?: string): Promise<void> {
    const data: Record<string, unknown> = {};
    if (patch.kind) {
      data.kind = patch.kind;
      data.color = NOTIFICATION_COLORS[patch.kind];
    }
    if (patch.title !== undefined) data.title = patch.title.trim();
    if (patch.body !== undefined) data.body = patch.body.trim();
    if (actorUid) data.updatedBy = actorUid;
    await updateDoc(doc(db, COLLECTIONS.notifications, id), data);
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.notifications, id));
  },
};
