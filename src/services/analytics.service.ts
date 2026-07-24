// Analytics aggregation — cross-collection metrics for the Analytics page.
//
// Like dashboard.service, this fetches whole collections and computes everything
// client-side (no server aggregation in the client SDK). All values are REAL,
// derived from the same bus-tracker-capstone data the mobile app uses.

import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { COLLECTIONS } from '@/firebase/collections';
import { toDoc, buildNameMap } from '@/lib/firestore';
import { ISSUE_KINDS, ISSUE_KIND_LABEL } from '@/lib/domain';
import type { AdminUpdate, IssueReport, IssueKind } from '@/types';

export interface NamedValue {
  name: string;
  value: number;
}

export interface AnalyticsData {
  totalBuses: number;
  fleetStatus: { active: number; offline: number; maintenance: number };
  routesByAgency: NamedValue[];
  busesByAgency: NamedValue[];
  issuesByCategory: NamedValue[];
  totalIssues: number;
  openIssues: number;
  resolvedIssues: number;
  resolutionRate: number; // 0–100
  /** Admin actions per day for the last 14 days. */
  activityTimeline: NamedValue[];
  topActions: NamedValue[];
}

const OPEN = new Set(['new', 'open', 'pending', 'reviewing']);

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export const analyticsService = {
  async getAnalytics(): Promise<AnalyticsData> {
    const [agenciesSnap, routesSnap, busesSnap, issuesSnap, updatesSnap] = await Promise.all([
      getDocs(collection(db, COLLECTIONS.agencies)),
      getDocs(collection(db, COLLECTIONS.routes)),
      getDocs(collection(db, COLLECTIONS.buses)),
      getDocs(collection(db, COLLECTIONS.issueReports)),
      getDocs(query(collection(db, COLLECTIONS.adminUpdates), orderBy('createdAt', 'desc'), limit(500))),
    ]);

    const agencyNames = buildNameMap(agenciesSnap.docs);
    const label = (id: string) => (id === 'unassigned' ? 'Unassigned' : agencyNames[id] ?? id);

    // Fleet status + buses per agency.
    const fleetStatus = { active: 0, offline: 0, maintenance: 0 };
    const busesByAgencyMap: Record<string, number> = {};
    busesSnap.docs.forEach(d => {
      const data = d.data() as { status?: string; agencyId?: string };
      if (data.status === 'Active') fleetStatus.active++;
      else if (data.status === 'Maintenance') fleetStatus.maintenance++;
      else fleetStatus.offline++;
      const aid = data.agencyId || 'unassigned';
      busesByAgencyMap[aid] = (busesByAgencyMap[aid] ?? 0) + 1;
    });

    // Routes per agency.
    const routesByAgencyMap: Record<string, number> = {};
    routesSnap.docs.forEach(d => {
      const aid = (d.data() as { agencyId?: string }).agencyId || 'unassigned';
      routesByAgencyMap[aid] = (routesByAgencyMap[aid] ?? 0) + 1;
    });

    // Issues by category + resolution.
    const issues = issuesSnap.docs.map(d => toDoc<IssueReport>(d));
    const byCat: Record<IssueKind, number> = ISSUE_KINDS.reduce(
      (acc, k) => ({ ...acc, [k]: 0 }),
      {} as Record<IssueKind, number>,
    );
    let openIssues = 0;
    let resolvedIssues = 0;
    issues.forEach(r => {
      if (r.kind in byCat) byCat[r.kind]++;
      const s = r.status ?? 'new';
      if (OPEN.has(s)) openIssues++;
      if (s === 'resolved' || s === 'closed') resolvedIssues++;
    });
    const totalIssues = issues.length;
    const resolutionRate = totalIssues === 0 ? 0 : Math.round((resolvedIssues / totalIssues) * 100);

    // Activity timeline (last 14 days) + top actions.
    const updates = updatesSnap.docs.map(d => toDoc<AdminUpdate>(d));
    const now = Date.now();
    const dayMs = 86_400_000;
    const timeline: NamedValue[] = [];
    for (let i = 13; i >= 0; i--) {
      const dayStart = now - i * dayMs;
      timeline.push({ name: dayKey(dayStart), value: 0 });
    }
    const idxByKey: Record<string, number> = {};
    timeline.forEach((t, i) => { idxByKey[t.name] = i; });
    const actionCounts: Record<string, number> = {};
    updates.forEach(u => {
      if (u.createdAt >= now - 14 * dayMs) {
        const key = dayKey(u.createdAt);
        if (key in idxByKey) timeline[idxByKey[key]].value++;
      }
      actionCounts[u.action] = (actionCounts[u.action] ?? 0) + 1;
    });
    const topActions = Object.entries(actionCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const toNamedSorted = (map: Record<string, number>): NamedValue[] =>
      Object.entries(map)
        .map(([id, value]) => ({ name: label(id), value }))
        .sort((a, b) => b.value - a.value);

    return {
      totalBuses: busesSnap.size,
      fleetStatus,
      routesByAgency: toNamedSorted(routesByAgencyMap),
      busesByAgency: toNamedSorted(busesByAgencyMap),
      issuesByCategory: ISSUE_KINDS.map(k => ({ name: ISSUE_KIND_LABEL[k], value: byCat[k] })),
      totalIssues,
      openIssues,
      resolvedIssues,
      resolutionRate,
      activityTimeline: timeline,
      topActions,
    };
  },
};
