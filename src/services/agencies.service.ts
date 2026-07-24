// Agencies data layer — CRUD over the `agencies` collection, plus aggregated
// views (counts, and a full per-agency detail) built with client-side joins
// (the client SDK has no server joins — mirrors the mobile denormalization).
//
// Document shape mirrors the mobile seeder: an agency stores BOTH `id` and
// `agencyId` (identical values), plus name/city/phone/email and epoch-ms
// timestamps. `routes` and `buses` reference an agency by `agencyId`.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
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

export interface AgencyDetail {
  agency: Agency;
  routes: Route[];
  buses: Bus[];
  stops: Stop[];
  admins: AdminRecord[];
  issues: IssueReport[];
  notifications: Notification[];
  /** routeId → name, for labeling related buses/issues. */
  routeNames: Record<string, string>;
}

export const agenciesService = {
  /** All agencies, sorted by name. */
  async list(): Promise<Agency[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.agencies));
    return snap.docs
      .map(d => toDoc<Agency>(d))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  },

  /** All agencies with their route + bus counts (one pass over both collections). */
  async listWithCounts(): Promise<AgencyWithCounts[]> {
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
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  },

  async get(id: string): Promise<Agency | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.agencies, id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Agency) : null;
  },

  /**
   * Full detail for one agency: its routes, fleet, stops, admins, related issue
   * reports, and best-effort matched notifications. Fetches whole collections and
   * filters client-side (data volume is small — same approach as the mobile app).
   */
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
    // Notifications aren't agency-scoped in the data model — best-effort match by
    // any of the agency's route names appearing in the title/body.
    const notifications = notifSnap.docs
      .map(d => toDoc<Notification>(d))
      .filter(n => {
        const text = `${n.title ?? ''} ${n.body ?? ''}`.toLowerCase();
        return [...routeNameSet].some(name => text.includes(name));
      });

    return { agency, routes, buses, stops, admins, issues, notifications, routeNames };
  },

  /**
   * Creates an agency. Uses a deterministic `agency_<epoch>` id and stores both
   * `id` and `agencyId` = that id, matching the seeded shape.
   */
  async create(input: AgencyInput): Promise<string> {
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
    });
    return id;
  },

  async update(id: string, patch: Partial<AgencyInput>): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.agencies, id), {
      ...patch,
      updatedAt: Date.now(),
    });
  },

  /** Soft-disable / enable an agency (additive `active` flag). */
  async setActive(id: string, active: boolean): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.agencies, id), { active, updatedAt: Date.now() });
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.agencies, id));
  },
};
