// Stops data layer — CRUD over `stops`.
//
// There is one stop document PER route-stop (a physically shared stop used by
// two routes has two docs). Stops link to a route by `routeId`; a route also
// references its stops by NAME in routes.stops[]. Doc stores both id + stopId.

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
import type { Stop } from '@/types';

export interface StopInput {
  routeId?: string;
  name: string;
  order?: number;
  city?: string;
  lat?: number;
  lng?: number;
}

export const stopsService = {
  /** All stops, grouped by route then order — matches the mobile admin view. */
  async list(): Promise<Stop[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.stops));
    return snap.docs
      .map(d => toDoc<Stop>(d))
      .sort(
        (a, b) =>
          (a.routeId ?? '').localeCompare(b.routeId ?? '') ||
          (a.order ?? 0) - (b.order ?? 0),
      );
  },

  /** Stops belonging to a single route, ordered. */
  async listForRoute(routeId: string): Promise<Stop[]> {
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.stops), where('routeId', '==', routeId)),
    );
    return snap.docs
      .map(d => toDoc<Stop>(d))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },

  async get(id: string): Promise<Stop | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.stops, id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Stop) : null;
  },

  async create(input: StopInput, actorUid?: string): Promise<string> {
    const now = Date.now();
    const routeId = input.routeId ?? '';
    const order = input.order ?? 1;
    const id = routeId ? `stop_${routeId}_${order}` : `stop_gen_${now}`;
    await setDoc(doc(db, COLLECTIONS.stops, id), {
      id,
      stopId: id,
      routeId,
      routes: routeId ? [routeId] : [],
      name: input.name.trim(),
      order,
      city: input.city?.trim() ?? '',
      ...(input.lat !== undefined ? { lat: input.lat } : {}),
      ...(input.lng !== undefined ? { lng: input.lng } : {}),
      base: 2,
      per: 15,
      source: 'dashboard-created',
      createdAt: now,
      updatedAt: now,
      ...(actorUid ? { createdBy: actorUid, updatedBy: actorUid } : {}),
    });
    return id;
  },

  async update(id: string, patch: Partial<StopInput>, actorUid?: string): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.stops, id), {
      ...patch,
      updatedAt: Date.now(),
      ...(actorUid ? { updatedBy: actorUid } : {}),
    });
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.stops, id));
  },
};
