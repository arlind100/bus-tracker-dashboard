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
  async getLiveData(): Promise<LiveData> {
    const busSnap = await getDocs(collection(db, COLLECTIONS.buses));
    const buses = busSnap.docs
      .map(d => toDoc<Bus>(d))
      .sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''));

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

  async updateBusLocation(
    busId: string,
    update: BusLocationUpdate,
    actorUid?: string,
  ): Promise<void> {
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

  async setManualOverride(busId: string, held: boolean, actorUid?: string): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.buses, busId), {
      manualOverride: held,
      updatedAt: Date.now(),
      ...(actorUid ? { updatedBy: actorUid } : {}),
    });
  },

  subscribeToLocations(onData: (locations: BusLocation[]) => void): () => void {
    return onSnapshot(
      collection(db, COLLECTIONS.busLocations),
      snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as BusLocation))),
      err => console.error('[liveService] location subscription error:', err),
    );
  },
};
