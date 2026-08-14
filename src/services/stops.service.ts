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
  writeBatch,
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

  /**
   * Creates a stop AND registers its name in the route's ordered `stops[]`,
   * atomically. Both sides are required: the dashboard lists stops from this
   * collection, while the passenger app reads the route's `stops[]` names — a
   * stop written to only one of them would be invisible in the other app.
   */
  async create(input: StopInput, actorUid?: string): Promise<string> {
    const now = Date.now();
    const routeId = input.routeId ?? '';
    const name = input.name.trim();

    // The owning route is read once, up front: it supplies both the ordered
    // stops[] array to update and the agencyId this stop inherits. Ownership is
    // never taken from the caller — it is whatever the route says — so a scoped
    // admin cannot stamp another agency onto a stop.
    const routeSnap = routeId ? await getDoc(doc(db, COLLECTIONS.routes, routeId)) : null;
    const agencyId = (routeSnap?.data()?.agencyId as string | undefined) ?? '';

    const siblings = routeId ? await this.listForRoute(routeId) : [];
    const order = input.order ?? siblings.length + 1;
    // `stop_<routeId>_<order>` collides if that position already exists, so fall
    // back to a timestamped id rather than overwriting an existing stop.
    const preferredId = routeId ? `stop_${routeId}_${order}` : `stop_gen_${now}`;
    const id = siblings.some(s => s.id === preferredId) ? `stop_gen_${now}` : preferredId;

    const batch = writeBatch(db);
    batch.set(doc(db, COLLECTIONS.stops, id), {
      id,
      stopId: id,
      agencyId,
      routeId,
      routes: routeId ? [routeId] : [],
      name,
      order,
      city: input.city?.trim() ?? '',
      ...(input.lat !== undefined ? { lat: input.lat } : {}),
      ...(input.lng !== undefined ? { lng: input.lng } : {}),
      source: 'dashboard-created',
      createdAt: now,
      updatedAt: now,
      ...(actorUid ? { createdBy: actorUid, updatedBy: actorUid } : {}),
    });

    if (routeSnap?.exists()) {
      const names = (routeSnap.data()?.stops as string[] | undefined) ?? [];
      if (!names.includes(name)) {
        // Insert at the stop's position so route.stops[] stays in travel order.
        const next = [...names];
        next.splice(Math.min(order - 1, next.length), 0, name);
        batch.update(doc(db, COLLECTIONS.routes, routeId), {
          stops: next,
          updatedAt: now,
          ...(actorUid ? { updatedBy: actorUid } : {}),
        });
      }
    }

    await batch.commit();
    return id;
  },

  /**
   * Updates a stop. Renaming one also rewrites the name inside its route's
   * ordered `stops[]` array, because routes reference stops BY NAME — without
   * this the route would keep listing a stop that no longer exists.
   */
  async update(id: string, patch: Partial<StopInput>, actorUid?: string): Promise<void> {
    const current = await this.get(id);
    const newName = patch.name?.trim();
    const renaming = !!newName && !!current?.name && newName !== current.name;

    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTIONS.stops, id), {
      ...patch,
      ...(newName ? { name: newName } : {}),
      updatedAt: Date.now(),
      ...(actorUid ? { updatedBy: actorUid } : {}),
    });

    if (renaming && current?.routeId) {
      const routeSnap = await getDoc(doc(db, COLLECTIONS.routes, current.routeId));
      const names = (routeSnap.data()?.stops as string[] | undefined) ?? [];
      if (names.includes(current.name)) {
        batch.update(doc(db, COLLECTIONS.routes, current.routeId), {
          stops: names.map(n => (n === current.name ? newName : n)),
          updatedAt: Date.now(),
          ...(actorUid ? { updatedBy: actorUid } : {}),
        });
      }
    }

    await batch.commit();
  },

  /**
   * Deletes a stop and removes its name from the owning route's `stops[]`, so
   * the route never advertises a stop that has been deleted.
   */
  async remove(id: string, actorUid?: string): Promise<void> {
    const current = await this.get(id);
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.stops, id));

    if (current?.routeId && current.name) {
      const routeSnap = await getDoc(doc(db, COLLECTIONS.routes, current.routeId));
      const names = (routeSnap.data()?.stops as string[] | undefined) ?? [];
      if (names.includes(current.name)) {
        batch.update(doc(db, COLLECTIONS.routes, current.routeId), {
          stops: names.filter(n => n !== current.name),
          updatedAt: Date.now(),
          ...(actorUid ? { updatedBy: actorUid } : {}),
        });
      }
    }

    await batch.commit();
  },

  /**
   * Rewrites the order of a route's stops: renumbers the stop documents and
   * rewrites the route's ordered `stops[]` names to match, atomically, so the
   * two representations can never disagree.
   */
  async reorderForRoute(routeId: string, orderedStopIds: string[], actorUid?: string): Promise<void> {
    const stops = await this.listForRoute(routeId);
    const byId = new Map(stops.map(s => [s.id, s]));
    const batch = writeBatch(db);
    const now = Date.now();

    orderedStopIds.forEach((stopId, i) => {
      if (!byId.has(stopId)) return;
      batch.update(doc(db, COLLECTIONS.stops, stopId), {
        order: i + 1,
        updatedAt: now,
        ...(actorUid ? { updatedBy: actorUid } : {}),
      });
    });

    batch.update(doc(db, COLLECTIONS.routes, routeId), {
      stops: orderedStopIds.map(sid => byId.get(sid)?.name).filter((n): n is string => !!n),
      updatedAt: now,
      ...(actorUid ? { updatedBy: actorUid } : {}),
    });

    await batch.commit();
  },
};
