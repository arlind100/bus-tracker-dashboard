// Schedules data layer — CRUD over `schedules` (timetable rows).
//
// ⚠️ `schedules` has NO Firestore rule today, which means the client SDK is
// DENIED all access (read included). The dashboard's schedule features require
// deploying the proposed `schedules` rule (see docs/PROPOSED_FIRESTORE_RULES.md).
// Until then these calls will fail with a permission error — surface it clearly.
//
// dayType ∈ {weekday, weekend}; times are "HH:MM" strings; schedules link to a
// route by routeId. Doc stores both id + scheduleId.

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
  /** All schedules, grouped by route then departure time. */
  async list(): Promise<Schedule[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.schedules));
    return snap.docs
      .map(d => toDoc<Schedule>(d))
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

  async create(input: ScheduleInput): Promise<string> {
    const now = Date.now();
    const id = `sch_${now}`;
    await setDoc(doc(db, COLLECTIONS.schedules, id), {
      id,
      scheduleId: id,
      routeId: input.routeId,
      dayType: input.dayType,
      departureTime: input.departureTime,
      arrivalTime: input.arrivalTime,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  async update(id: string, patch: Partial<ScheduleInput>): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.schedules, id), { ...patch, updatedAt: Date.now() });
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.schedules, id));
  },
};
