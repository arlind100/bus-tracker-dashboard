// Buses data layer — CRUD over `buses`, with best-effort route/agency name joins.
//
// The mobile app writes BOTH `route` and `routeId` with the assigned route id;
// this service keeps them in sync. Status enum is fixed:
// status ∈ {Active, Offline, Maintenance}. Drivers are a free-text field
// (there is no drivers collection). agencyId links a bus to its operator.

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
  /** Driver NAME — denormalized for the mobile app, which renders this string. */
  driver?: string;
  /** Reference into `drivers`. Written alongside `driver`, never instead of it. */
  driverId?: string;
  status?: BusStatus;
  capacity?: number;
}

export const busesService = {
  /** All buses (sorted by id) plus route/agency name maps for display. */
  async list(): Promise<BusesResult> {
    const busSnap = await getDocs(collection(db, COLLECTIONS.buses));
    const buses = busSnap.docs
      .map(d => toDoc<Bus>(d))
      .sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''));
    // Name joins are best-effort display sugar — a failure falls back to raw ids.
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
      route: routeId, // mobile keeps both in sync
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
    // Keep the legacy `route` field mirrored to routeId.
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

  /**
   * Deletes the bus together with its last-known checkpoint, then frees any
   * driver assigned to it.
   *
   * The checkpoint MUST go with the bus. The passenger map builds its markers
   * from `busLocations`, so an orphaned checkpoint keeps drawing a live vehicle
   * that no longer exists in the fleet — labelled with a raw document id,
   * because there is no bus left to name it. Both deletes go in one batch so a
   * failure can never leave exactly that state behind.
   */
  async remove(id: string): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.buses, id));
    batch.delete(doc(db, COLLECTIONS.busLocations, id));
    await batch.commit();
    await driversService.releaseBus(id);
  },
};
