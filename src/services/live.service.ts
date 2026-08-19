// Live operations data layer — fleet ⨝ routes ⨝ busLocations, plus checkpoint
// overrides and an optional realtime subscription for a live map.
//
// ⚠️ busLocations is a CHECKPOINT doc (one per bus, id == busId, overwritten via
// setDoc merge at meaningful moments). NEVER write it on a fast interval — it
// would blow up read/write costs for every passenger subscribed to the fleet.
// updateBusLocation is a one-shot manual override.
//
// The passenger app draws each bus at its checkpoint's exact coordinates and
// snaps on update — it does NOT animate or interpolate between checkpoints, and
// must not be changed to, because a smooth glide depicts travel no vehicle
// reported. A checkpoint older than 15 minutes is shown as stale, not moved.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { COLLECTIONS } from '@/firebase/collections';
import { toDoc } from '@/lib/firestore';
import type { Bus, BusLocation, BusLocationUpdate, Route } from '@/types';

export interface LiveData {
  buses: Bus[];
  routesById: Record<string, Route>;
  locationsByBusId: Record<string, BusLocation>;
}

export const liveService = {
  /** Buses joined with their route and live location docs for the live screen. */
  async getLiveData(): Promise<LiveData> {
    const busSnap = await getDocs(collection(db, COLLECTIONS.buses));
    const buses = busSnap.docs
      .map(d => toDoc<Bus>(d))
      .sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''));

    // Route + location joins are best-effort: a failure degrades to bus-level
    // fields rather than blanking the screen.
    const [routesById, locationsByBusId] = await Promise.all([
      getDocs(collection(db, COLLECTIONS.routes))
        .then(snap => {
          const map: Record<string, Route> = {};
          snap.docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() } as Route; });
          return map;
        })
        .catch(() => ({} as Record<string, Route>)),
      getDocs(collection(db, COLLECTIONS.busLocations))
        .then(snap => {
          const map: Record<string, BusLocation> = {};
          snap.docs.forEach(d => {
            const data = d.data() as BusLocation;
            const busId = data.busId ?? d.id;
            map[busId] = { ...data, id: d.id, busId };
          });
          return map;
        })
        .catch(() => ({} as Record<string, BusLocation>)),
    ]);

    return { buses, routesById, locationsByBusId };
  },

  /**
   * One-shot manual checkpoint override for a single bus. setDoc(merge) so a bus
   * with no existing busLocations doc is created rather than throwing. Requires
   * admin auth. Do NOT call on an interval.
   */
  async updateBusLocation(
    busId: string,
    update: BusLocationUpdate,
    actorUid?: string,
  ): Promise<void> {
    // A checkpoint belongs to whichever agency owns the bus. Read it from the
    // bus rather than trusting the caller, so a scoped admin cannot write a
    // checkpoint stamped with another agency.
    const busSnap = await getDoc(doc(db, COLLECTIONS.buses, busId));
    const agencyId = (busSnap.data()?.agencyId as string | undefined) ?? '';

    const payload: Record<string, unknown> = { busId, id: busId, agencyId, updatedAt: Date.now() };
    if (update.status !== undefined) payload.status = update.status;
    if (update.currentStop !== undefined) payload.currentStop = update.currentStop;
    if (update.nextStop !== undefined) payload.nextStop = update.nextStop;
    if (update.progress !== undefined) payload.progress = update.progress;
    if (update.lat !== undefined) payload.lat = update.lat;
    if (update.lng !== undefined) payload.lng = update.lng;
    if (actorUid) payload.updatedBy = actorUid;
    await setDoc(doc(db, COLLECTIONS.busLocations, busId), payload, { merge: true });
  },

  /**
   * Takes a vehicle off automatic control, or hands it back.
   *
   * The scheduled fleet simulator skips a bus with `manualOverride` set — it
   * neither moves it nor clears its checkpoint. Without this, a hand-entered
   * checkpoint survives only until the next tick (a minute at most), which makes
   * manual correction pointless precisely when an operator needs it.
   */
  async setManualOverride(busId: string, held: boolean, actorUid?: string): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.buses, busId), {
      manualOverride: held,
      updatedAt: Date.now(),
      ...(actorUid ? { updatedBy: actorUid } : {}),
    });
  },

  /**
   * Realtime subscription to all bus locations (for a live map). Returns the
   * unsubscribe function. Reads only — this does not write on any interval.
   */
  subscribeToLocations(onData: (locations: BusLocation[]) => void): () => void {
    return onSnapshot(
      collection(db, COLLECTIONS.busLocations),
      snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as BusLocation))),
      err => console.error('[liveService] location subscription error:', err),
    );
  },
};
