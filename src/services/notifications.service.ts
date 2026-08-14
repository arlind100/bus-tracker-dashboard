// Notifications data layer — broadcast service alerts to the passenger app.
//
// The passenger Notifications screen sorts on a numeric `createdAt` and renders
// by `kind` (delay/arrive/update) with a matching `color`. This service sets
// those automatically so dashboard-created alerts render correctly on mobile.

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
import { toDoc } from '@/lib/firestore';
import type { Notification, NotificationKind } from '@/types';

// kind → color the passenger screen already understands (matches admin.service).
const NOTIFICATION_COLORS: Record<NotificationKind, string> = {
  delay: '#F59E0B',
  arrive: '#16A34A',
  update: '#4F46E5',
};

export interface NotificationInput {
  kind: NotificationKind;
  title: string;
  body: string;
  /**
   * Agency that owns this alert. A super admin may broadcast platform-wide by
   * leaving it empty; an agency admin must supply their own agency, because the
   * rules only let them write documents their agency owns.
   */
  agencyId?: string;
}

export const notificationsService = {
  /** All notifications, newest first. */
  async list(): Promise<Notification[]> {
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.notifications), orderBy('createdAt', 'desc')),
    );
    return snap.docs.map(d => toDoc<Notification>(d));
  },

  /** Broadcasts a new alert with auto color/time/createdAt. */
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
