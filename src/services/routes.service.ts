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
import type { PathPoint, Route, RouteStatus, RouteSt } from '@/types';

const ST_BY_STATUS: Record<RouteStatus, RouteSt> = {
  'On time': 'ok',
  Delayed: 'warn',
  Offline: 'off',
};

export interface RouteInput {
  agencyId?: string;
  routeNumber?: string;
  name: string;
  color?: string;
  from?: string;
  to?: string;
  city?: string;
  freq?: string;
  duration?: string;
  description?: string;
  status?: RouteStatus;
  stops?: string[];
  routePath?: PathPoint[];
}

export interface StopSeed {
  name: string;
  lat: number;
  lng: number;
}

export const routesService = {
  async list(): Promise<Route[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.routes));
    return snap.docs
      .map(d => d.data() as Route)
      .sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''));
  },

  async get(id: string): Promise<Route | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.routes, id));
    return snap.exists() ? (snap.data() as Route) : null;
  },

  async create(input: RouteInput, actorUid?: string): Promise<string> {
    const now = Date.now();
    const id = `route_admin_${now}`;
    const status: RouteStatus = input.status ?? 'On time';
    await setDoc(doc(db, COLLECTIONS.routes, id), {
      id,
      agencyId: input.agencyId?.trim() ?? '',
      routeNumber: input.routeNumber?.trim() ?? '',
      name: input.name.trim(),
      color: input.color ?? '#2563EB',
      from: input.from?.trim() ?? '',
      to: input.to?.trim() ?? '',
      city: input.city?.trim() ?? input.from?.trim() ?? '',
      isActive: status !== 'Offline',
      status,
      st: ST_BY_STATUS[status],
      freq: input.freq?.trim() ?? '',
      duration: input.duration?.trim() ?? '',
      description: input.description?.trim() ?? '',
      stops: input.stops ?? [],
      ...(input.routePath ? { routePath: input.routePath } : {}),
      source: 'dashboard-created',
      createdAt: now,
      updatedAt: now,
      ...(actorUid ? { createdBy: actorUid, updatedBy: actorUid } : {}),
    });
    return id;
  },

  async createWithStops(
    input: RouteInput & { stopSeeds: StopSeed[] },
    actorUid?: string,
  ): Promise<{ routeId: string; stopCount: number }> {
    const now = Date.now();
    const routeId = `route_admin_${now}`;
    const status: RouteStatus = input.status ?? 'On time';
    const stopNames = input.stopSeeds.map(s => s.name.trim());

    const batch = writeBatch(db);

    batch.set(doc(db, COLLECTIONS.routes, routeId), {
      id: routeId,
      agencyId: input.agencyId?.trim() ?? '',
      routeNumber: input.routeNumber?.trim() ?? '',
      name: input.name.trim(),
      color: input.color ?? '#2563EB',
      from: input.from?.trim() ?? '',
      to: input.to?.trim() ?? '',
      city: input.city?.trim() ?? input.from?.trim() ?? '',
      isActive: status !== 'Offline',
      status,
      st: ST_BY_STATUS[status],
      freq: input.freq?.trim() ?? '',
      duration: input.duration?.trim() ?? '',
      description: input.description?.trim() ?? '',
      stops: stopNames,
      ...(input.routePath ? { routePath: input.routePath } : {}),
      source: 'dashboard-created',
      createdAt: now,
      updatedAt: now,
      ...(actorUid ? { createdBy: actorUid, updatedBy: actorUid } : {}),
    });

    input.stopSeeds.forEach((stop, i) => {
      const order = i + 1;
      const stopId = `stop_${routeId}_${order}`;
      batch.set(doc(db, COLLECTIONS.stops, stopId), {
        id: stopId,
        stopId,
        agencyId: input.agencyId?.trim() ?? '',
        routeId,
        routes: [routeId],
        name: stop.name.trim(),
        order,
        city: input.city?.trim() ?? '',
        lat: stop.lat,
        lng: stop.lng,
        source: 'dashboard-created',
        createdAt: now,
        updatedAt: now,
        ...(actorUid ? { createdBy: actorUid, updatedBy: actorUid } : {}),
      });
    });

    await batch.commit();
    return { routeId, stopCount: input.stopSeeds.length };
  },

  async update(id: string, patch: Partial<RouteInput>, actorUid?: string): Promise<void> {
    const data: Record<string, unknown> = { ...patch, updatedAt: Date.now() };
    if (patch.status) {
      data.st = ST_BY_STATUS[patch.status];
      data.isActive = patch.status !== 'Offline';
    }
    if (actorUid) data.updatedBy = actorUid;
    await updateDoc(doc(db, COLLECTIONS.routes, id), data);
  },

  async setStatus(id: string, status: RouteStatus, actorUid?: string): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.routes, id), {
      status,
      st: ST_BY_STATUS[status],
      isActive: status !== 'Offline',
      updatedAt: Date.now(),
      ...(actorUid ? { updatedBy: actorUid } : {}),
    });
  },

  async countDependents(id: string): Promise<{ stops: number; schedules: number; buses: number }> {
    const [stopsSnap, schedulesSnap, busesSnap] = await Promise.all([
      getDocs(query(collection(db, COLLECTIONS.stops), where('routeId', '==', id))),
      getDocs(query(collection(db, COLLECTIONS.schedules), where('routeId', '==', id))),
      getDocs(query(collection(db, COLLECTIONS.buses), where('routeId', '==', id))),
    ]);
    return { stops: stopsSnap.size, schedules: schedulesSnap.size, buses: busesSnap.size };
  },

  async remove(id: string, actorUid?: string): Promise<void> {
    const [stopsSnap, schedulesSnap, busesSnap, locationsSnap] = await Promise.all([
      getDocs(query(collection(db, COLLECTIONS.stops), where('routeId', '==', id))),
      getDocs(query(collection(db, COLLECTIONS.schedules), where('routeId', '==', id))),
      getDocs(query(collection(db, COLLECTIONS.buses), where('routeId', '==', id))),
      getDocs(query(collection(db, COLLECTIONS.busLocations), where('routeId', '==', id))),
    ]);

    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.routes, id));
    stopsSnap.docs.forEach(d => batch.delete(d.ref));
    schedulesSnap.docs.forEach(d => batch.delete(d.ref));
    busesSnap.docs.forEach(d =>
      batch.update(d.ref, {
        routeId: '',
        route: '',
        updatedAt: Date.now(),
        ...(actorUid ? { updatedBy: actorUid } : {}),
      }),
    );
    locationsSnap.docs.forEach(d => batch.update(d.ref, { routeId: '' }));
    await batch.commit();
  },
};
