// Live operations data layer — fleet ⨝ routes ⨝ busLocations, plus checkpoint
// overrides and an optional realtime subscription for a live map.
//
// ⚠️ busLocations is a CHECKPOINT doc (one per bus, overwritten via setDoc merge
// at meaningful moments). NEVER write it on a fast interval — the mobile app
// animates locally between checkpoints and per-second writes would fight that
// animation and blow up costs. updateBusLocation is a one-shot manual override.

import {
  collection,
  doc,
  getDocs,
  setDoc,
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
  async updateBusLocation(busId: string, update: BusLocationUpdate): Promise<void> {
    const payload: Record<string, unknown> = { busId, id: busId, updatedAt: Date.now() };
    if (update.status !== undefined) payload.status = update.status;
    if (update.currentStop !== undefined) payload.currentStop = update.currentStop;
    if (update.nextStop !== undefined) payload.nextStop = update.nextStop;
    if (update.progress !== undefined) payload.progress = update.progress;
    if (update.lat !== undefined) payload.lat = update.lat;
    if (update.lng !== undefined) payload.lng = update.lng;
    await setDoc(doc(db, COLLECTIONS.busLocations, busId), payload, { merge: true });
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
