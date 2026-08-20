import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { COLLECTIONS } from '@/firebase/collections';
import { scopeOwned } from '@/lib/scope';
import { toDoc } from '@/lib/firestore';
import type { DayType, Schedule } from '@/types';

export interface ScheduleInput {
  routeId: string;
  dayType: DayType;
  departureTime: string;
  arrivalTime: string;
  isActive?: boolean;
}

export const schedulesService = {
  async list(scopeAgencyId?: string): Promise<Schedule[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.schedules));
    return scopeOwned(snap.docs.map(d => toDoc<Schedule>(d)), scopeAgencyId)
      .sort(
        (a, b) =>
          (a.routeId ?? '').localeCompare(b.routeId ?? '') ||
          (a.departureTime ?? '').localeCompare(b.departureTime ?? ''),
      );
  },

  async listForRoute(routeId: string): Promise<Schedule[]> {
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.schedules), where('routeId', '==', routeId)),
    );
    return snap.docs
      .map(d => toDoc<Schedule>(d))
      .sort((a, b) => (a.departureTime ?? '').localeCompare(b.departureTime ?? ''));
  },

  async get(id: string): Promise<Schedule | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.schedules, id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Schedule) : null;
  },

  async create(input: ScheduleInput, actorUid?: string): Promise<string> {
    const now = Date.now();
    const id = `sch_${now}`;
    const routeSnap = await getDoc(doc(db, COLLECTIONS.routes, input.routeId));
    const agencyId = (routeSnap.data()?.agencyId as string | undefined) ?? '';

    await setDoc(doc(db, COLLECTIONS.schedules, id), {
      id,
      scheduleId: id,
      agencyId,
      routeId: input.routeId,
      dayType: input.dayType,
      departureTime: input.departureTime,
      arrivalTime: input.arrivalTime,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
      ...(actorUid ? { createdBy: actorUid, updatedBy: actorUid } : {}),
    });
    return id;
  },

  async update(id: string, patch: Partial<ScheduleInput>, actorUid?: string): Promise<void> {
    let agency: { agencyId: string } | Record<string, never> = {};
    if (patch.routeId) {
      const routeSnap = await getDoc(doc(db, COLLECTIONS.routes, patch.routeId));
      agency = { agencyId: (routeSnap.data()?.agencyId as string | undefined) ?? '' };
    }

    await updateDoc(doc(db, COLLECTIONS.schedules, id), {
      ...patch,
      ...agency,
      updatedAt: Date.now(),
      ...(actorUid ? { updatedBy: actorUid } : {}),
    });
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.schedules, id));
  },
};
