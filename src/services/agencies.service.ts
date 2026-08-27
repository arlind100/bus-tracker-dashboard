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
import type {
  Agency,
  Route,
  Bus,
  Stop,
  AdminRecord,
  IssueReport,
  Notification,
} from '@/types';

export interface AgencyInput {
  name: string;
  city?: string;
  phone?: string;
  email?: string;
  active?: boolean;
}

export interface AgencyWithCounts extends Agency {
  routeCount: number;
  busCount: number;
}

export interface AgencyReferences {
  routes: number;
  buses: number;
  drivers: number;
  admins: number;
  total: number;
}

export interface AgencyDetail {
  agency: Agency;
  routes: Route[];
  buses: Bus[];
  stops: Stop[];
  admins: AdminRecord[];
  issues: IssueReport[];
  notifications: Notification[];
  routeNames: Record<string, string>;
}

export const agenciesService = {
  // An agency is keyed by its own document id, so the scope matches `id`, not `agencyId`.
  async list(scopeAgencyId?: string): Promise<Agency[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.agencies));
    return snap.docs
      .map(d => toDoc<Agency>(d))
      .filter(a => !scopeAgencyId || a.id === scopeAgencyId)
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  },

  async listWithCounts(scopeAgencyId?: string): Promise<AgencyWithCounts[]> {
    const [agenciesSnap, routesSnap, busesSnap] = await Promise.all([
      getDocs(collection(db, COLLECTIONS.agencies)),
      getDocs(collection(db, COLLECTIONS.routes)),
      getDocs(collection(db, COLLECTIONS.buses)),
    ]);

    const routeCounts: Record<string, number> = {};
    routesSnap.docs.forEach(d => {
      const aid = (d.data() as { agencyId?: string }).agencyId;
      if (aid) routeCounts[aid] = (routeCounts[aid] ?? 0) + 1;
    });
    const busCounts: Record<string, number> = {};
    busesSnap.docs.forEach(d => {
      const aid = (d.data() as { agencyId?: string }).agencyId;
      if (aid) busCounts[aid] = (busCounts[aid] ?? 0) + 1;
    });

    return agenciesSnap.docs
      .map(d => {
        const agency = toDoc<Agency>(d);
        return {
          ...agency,
          routeCount: routeCounts[agency.id] ?? 0,
          busCount: busCounts[agency.id] ?? 0,
        };
      })
      .filter(a => !scopeAgencyId || a.id === scopeAgencyId)
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  },

  async get(id: string): Promise<Agency | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.agencies, id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Agency) : null;
  },

  async getDetail(id: string): Promise<AgencyDetail | null> {
    const [agencySnap, routesSnap, busesSnap, stopsSnap, adminsSnap, issuesSnap, notifSnap] =
      await Promise.all([
        getDoc(doc(db, COLLECTIONS.agencies, id)),
        getDocs(collection(db, COLLECTIONS.routes)),
        getDocs(collection(db, COLLECTIONS.buses)),
        getDocs(collection(db, COLLECTIONS.stops)),
        getDocs(collection(db, COLLECTIONS.admins)),
        getDocs(collection(db, COLLECTIONS.issueReports)),
        getDocs(collection(db, COLLECTIONS.notifications)),
      ]);

    if (!agencySnap.exists()) return null;
    const agency = { id: agencySnap.id, ...agencySnap.data() } as Agency;

    const routes = routesSnap.docs
      .map(d => d.data() as Route)
      .filter(r => r.agencyId === id);
    const routeIds = new Set(routes.map(r => r.id));
    const routeNames: Record<string, string> = {};
    routes.forEach(r => { routeNames[r.id] = r.name ?? r.id; });
    const routeNameSet = new Set(routes.map(r => (r.name ?? '').toLowerCase()).filter(Boolean));

    const buses = busesSnap.docs
      .map(d => toDoc<Bus>(d))
      .filter(b => b.agencyId === id);
    const stops = stopsSnap.docs
      .map(d => toDoc<Stop>(d))
      .filter(s => s.routeId && routeIds.has(s.routeId));
    const admins = adminsSnap.docs
      .map(d => ({ uid: d.id, ...d.data() } as AdminRecord))
      .filter(a => a.agencyId === id);
    const issues = issuesSnap.docs
      .map(d => toDoc<IssueReport>(d))
      .filter(i => i.routeId && routeIds.has(i.routeId));
    const notifications = notifSnap.docs
      .map(d => toDoc<Notification>(d))
      .filter(n => {
        const text = `${n.title ?? ''} ${n.body ?? ''}`.toLowerCase();
        return [...routeNameSet].some(name => text.includes(name));
      });

    return { agency, routes, buses, stops, admins, issues, notifications, routeNames };
  },

  async create(input: AgencyInput, actorUid?: string): Promise<string> {
    const now = Date.now();
    const id = `agency_${now}`;
    await setDoc(doc(db, COLLECTIONS.agencies, id), {
      id,
      agencyId: id,
      name: input.name.trim(),
      city: input.city?.trim() ?? '',
      phone: input.phone?.trim() ?? '',
      email: input.email?.trim() ?? '',
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
      ...(actorUid ? { createdBy: actorUid, updatedBy: actorUid } : {}),
    });
    return id;
  },

  async update(id: string, patch: Partial<AgencyInput>, actorUid?: string): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.agencies, id), {
      ...patch,
      updatedAt: Date.now(),
      ...(actorUid ? { updatedBy: actorUid } : {}),
    });
  },

  async setActive(id: string, active: boolean, actorUid?: string): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.agencies, id), {
      active,
      updatedAt: Date.now(),
      ...(actorUid ? { updatedBy: actorUid } : {}),
    });
  },

  async countReferences(id: string): Promise<AgencyReferences> {
    const [routesSnap, busesSnap, driversSnap, adminsSnap] = await Promise.all([
      getDocs(query(collection(db, COLLECTIONS.routes), where('agencyId', '==', id))),
      getDocs(query(collection(db, COLLECTIONS.buses), where('agencyId', '==', id))),
      getDocs(query(collection(db, COLLECTIONS.drivers), where('agencyId', '==', id))),
      getDocs(query(collection(db, COLLECTIONS.admins), where('agencyId', '==', id))),
    ]);
    const routes = routesSnap.size;
    const buses = busesSnap.size;
    const drivers = driversSnap.size;
    const admins = adminsSnap.size;
    return { routes, buses, drivers, admins, total: routes + buses + drivers + admins };
  },

  async remove(id: string): Promise<void> {
    const refs = await this.countReferences(id);
    if (refs.total > 0) {
      const parts = [
        refs.routes && `${refs.routes} route(s)`,
        refs.buses && `${refs.buses} bus(es)`,
        refs.drivers && `${refs.drivers} driver(s)`,
        refs.admins && `${refs.admins} admin(s)`,
      ].filter(Boolean);
      throw new Error(
        `This agency still owns ${parts.join(', ')}. Reassign or delete them first, or deactivate the agency instead.`,
      );
    }
    await deleteDoc(doc(db, COLLECTIONS.agencies, id));
  },
};
