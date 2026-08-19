import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { COLLECTIONS } from '@/firebase/collections';
import { toDoc, fetchNameMap } from '@/lib/firestore';
import { driversService } from '@/services/drivers.service';
import type { Bus, BusStatus } from '@/types';

export interface BusesResult {
  buses: Bus[];
  routeNames: Record<string, string>;
  agencyNames: Record<string, string>;
}

export interface BusInput {
  agencyId?: string;
  routeId?: string;
  plate?: string;
  busNumber?: string;
  driver?: string;
  driverId?: string;
  status?: BusStatus;
  capacity?: number;
}

export const busesService = {
  async list(): Promise<BusesResult> {
    const busSnap = await getDocs(collection(db, COLLECTIONS.buses));
    const buses = busSnap.docs
      .map(d => toDoc<Bus>(d))
      .sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''));
    const [routeNames, agencyNames] = await Promise.all([
      fetchNameMap(COLLECTIONS.routes),
      fetchNameMap(COLLECTIONS.agencies),
    ]);
    return { buses, routeNames, agencyNames };
  },

  async get(id: string): Promise<Bus | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.buses, id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Bus) : null;
  },

  async create(input: BusInput, actorUid?: string): Promise<string> {
    const now = Date.now();
    const id = `bus_${now}`;
    const routeId = input.routeId?.trim() ?? '';
    await setDoc(doc(db, COLLECTIONS.buses, id), {
      id,
      agencyId: input.agencyId?.trim() ?? '',
      routeId,
      route: routeId,
      plate: input.plate?.trim() ?? '',
      busNumber: input.busNumber?.trim() ?? '',
      driver: input.driver?.trim() ?? '',
      driverId: input.driverId?.trim() ?? '',
      status: input.status ?? 'Offline',
      capacity: input.capacity ?? 0,
      createdAt: now,
      updatedAt: now,
      ...(actorUid ? { createdBy: actorUid, updatedBy: actorUid } : {}),
    });
    return id;
  },

  async update(id: string, patch: Partial<BusInput>, actorUid?: string): Promise<void> {
    const data: Record<string, unknown> = { ...patch, updatedAt: Date.now() };
    if (patch.routeId !== undefined) data.route = patch.routeId;
    if (actorUid) data.updatedBy = actorUid;
    await updateDoc(doc(db, COLLECTIONS.buses, id), data);
  },

  async setStatus(id: string, status: BusStatus, actorUid?: string): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.buses, id), {
      status,
      updatedAt: Date.now(),
      ...(actorUid ? { updatedBy: actorUid } : {}),
    });
  },

  async remove(id: string): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.buses, id));
    batch.delete(doc(db, COLLECTIONS.busLocations, id));
    await batch.commit();
    await driversService.releaseBus(id);
  },
};
