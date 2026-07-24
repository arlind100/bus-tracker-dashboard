// Drivers data layer — CRUD over `drivers`, the dashboard-only personnel
// collection introduced to replace the free-text `buses.driver` string.
//
// COMPATIBILITY CONTRACT (do not break):
// The mobile app renders `buses.driver` as a plain name string and knows
// nothing about this collection. So every assignment writes BOTH sides:
//   buses.driverId → the reference (dashboard truth)
//   buses.driver   → the driver's NAME (what mobile renders)
// Assignment is 1:1 in both directions and is done in a writeBatch so a bus and
// a driver can never disagree about who is driving what.
//
// This collection holds PII (licence, phone) and is admin-only in the rules.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { COLLECTIONS } from '@/firebase/collections';
import { toDoc, fetchNameMap } from '@/lib/firestore';
import type { Driver, DriverStatus } from '@/types';

export interface DriversResult {
  drivers: Driver[];
  agencyNames: Record<string, string>;
  /** busId → display label ("Bus 01 · SK-1234-AB"), for the assignment column. */
  busLabels: Record<string, string>;
}

export interface DriverInput {
  name: string;
  agencyId?: string;
  licenseNumber?: string;
  phone?: string;
  email?: string;
  status?: DriverStatus;
  notes?: string;
}

/** Builds the human label shown for an assigned bus. */
function busLabel(data: { busNumber?: string; plate?: string }, id: string): string {
  const primary = data.busNumber?.trim() || id;
  const plate = data.plate?.trim();
  return plate ? `${primary} · ${plate}` : primary;
}

export const driversService = {
  /**
   * All drivers (name-sorted) plus agency names and assigned-bus labels.
   *
   * `scopeAgencyId` MUST be passed for an agency-scoped admin: the rules only
   * grant them read access to their own agency's driver documents, and a list
   * query that could return another agency's document is rejected wholesale.
   * A global/super admin passes nothing and reads the whole collection.
   */
  async list(scopeAgencyId?: string): Promise<DriversResult> {
    const driversRef = collection(db, COLLECTIONS.drivers);
    const driversQuery = scopeAgencyId
      ? query(driversRef, where('agencyId', '==', scopeAgencyId))
      : driversRef;

    const [driverSnap, agencyNames, busSnap] = await Promise.all([
      getDocs(driversQuery),
      fetchNameMap(COLLECTIONS.agencies),
      getDocs(collection(db, COLLECTIONS.buses)),
    ]);

    const drivers = driverSnap.docs
      .map(d => toDoc<Driver>(d))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

    const busLabels: Record<string, string> = {};
    for (const b of busSnap.docs) {
      busLabels[b.id] = busLabel(b.data() as { busNumber?: string; plate?: string }, b.id);
    }

    return { drivers, agencyNames, busLabels };
  },

  async get(id: string): Promise<Driver | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.drivers, id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Driver) : null;
  },

  async create(input: DriverInput, actorUid?: string): Promise<string> {
    const now = Date.now();
    const id = `driver_${now}`;
    await setDoc(doc(db, COLLECTIONS.drivers, id), {
      id,
      name: input.name.trim(),
      agencyId: input.agencyId?.trim() ?? '',
      licenseNumber: input.licenseNumber?.trim() ?? '',
      phone: input.phone?.trim() ?? '',
      email: input.email?.trim() ?? '',
      status: input.status ?? 'active',
      notes: input.notes?.trim() ?? '',
      assignedBusId: '',
      createdAt: now,
      updatedAt: now,
      ...(actorUid ? { createdBy: actorUid, updatedBy: actorUid } : {}),
    });
    return id;
  },

  /**
   * Updates driver details. If the name changes, the denormalized
   * `buses.driver` string on the assigned bus is refreshed too, so the mobile
   * app never shows a stale name.
   */
  async update(id: string, patch: Partial<DriverInput>, actorUid?: string): Promise<void> {
    const current = await this.get(id);
    const batch = writeBatch(db);

    batch.update(doc(db, COLLECTIONS.drivers, id), {
      ...patch,
      updatedAt: Date.now(),
      ...(actorUid ? { updatedBy: actorUid } : {}),
    });

    const newName = patch.name?.trim();
    if (newName && current?.assignedBusId && newName !== current.name) {
      batch.update(doc(db, COLLECTIONS.buses, current.assignedBusId), {
        driver: newName,
        updatedAt: Date.now(),
        ...(actorUid ? { updatedBy: actorUid } : {}),
      });
    }

    await batch.commit();
  },

  async setStatus(id: string, status: DriverStatus, actorUid?: string): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.drivers, id), {
      status,
      updatedAt: Date.now(),
      ...(actorUid ? { updatedBy: actorUid } : {}),
    });
  },

  /**
   * Assigns a driver to a bus (or clears the assignment when busId is null),
   * keeping both sides consistent in one batch:
   *   - releases whatever bus this driver held before
   *   - releases whatever driver the target bus held before
   *   - writes driverId + the denormalized driver NAME onto the bus
   */
  async assignToBus(driverId: string, busId: string | null, actorUid?: string): Promise<void> {
    const driver = await this.get(driverId);
    if (!driver) throw new Error('Driver not found');

    const now = Date.now();
    const batch = writeBatch(db);
    const stamp = actorUid ? { updatedBy: actorUid } : {};

    // Release the driver's previous bus, if it is not the new target.
    if (driver.assignedBusId && driver.assignedBusId !== busId) {
      batch.update(doc(db, COLLECTIONS.buses, driver.assignedBusId), {
        driverId: '',
        driver: '',
        updatedAt: now,
        ...stamp,
      });
    }

    if (busId) {
      // Release any OTHER driver currently holding the target bus.
      const holders = await getDocs(
        query(collection(db, COLLECTIONS.drivers), where('assignedBusId', '==', busId)),
      );
      for (const h of holders.docs) {
        if (h.id !== driverId) {
          batch.update(doc(db, COLLECTIONS.drivers, h.id), {
            assignedBusId: '',
            updatedAt: now,
            ...stamp,
          });
        }
      }

      batch.update(doc(db, COLLECTIONS.buses, busId), {
        driverId,
        driver: driver.name, // denormalized for the mobile app
        updatedAt: now,
        ...stamp,
      });
    }

    batch.update(doc(db, COLLECTIONS.drivers, driverId), {
      assignedBusId: busId ?? '',
      updatedAt: now,
      ...stamp,
    });

    await batch.commit();
  },

  /**
   * Deletes a driver and clears the assignment from their bus, so no bus is
   * left pointing at a driver that no longer exists.
   */
  async remove(id: string, actorUid?: string): Promise<void> {
    const driver = await this.get(id);
    const batch = writeBatch(db);

    if (driver?.assignedBusId) {
      batch.update(doc(db, COLLECTIONS.buses, driver.assignedBusId), {
        driverId: '',
        driver: '',
        updatedAt: Date.now(),
        ...(actorUid ? { updatedBy: actorUid } : {}),
      });
    }

    batch.delete(doc(db, COLLECTIONS.drivers, id));
    await batch.commit();
  },

  /** Best-effort cleanup used when a BUS is deleted: frees its driver. */
  async releaseBus(busId: string): Promise<void> {
    try {
      const holders = await getDocs(
        query(collection(db, COLLECTIONS.drivers), where('assignedBusId', '==', busId)),
      );
      await Promise.all(
        holders.docs.map(h =>
          updateDoc(doc(db, COLLECTIONS.drivers, h.id), {
            assignedBusId: '',
            updatedAt: Date.now(),
          }),
        ),
      );
    } catch (err) {
      console.warn('[drivers] failed to release bus assignment:', err);
    }
  },
};
