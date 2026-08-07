// Dashboard aggregate data layer — cross-collection KPIs for the Overview page.
//
// Mirrors the mobile admin.service.getDashboardStats: fetches whole collections
// and computes counts client-side (the client SDK has no server aggregation).
//
// A read that fails or times out THROWS. It must not resolve to an empty result:
// "0 agencies, 0 routes, 0 buses" is exactly what a brand-new backend looks like,
// so returning zeros on failure tells an operator their platform is empty when
// the truth is that we could not read it. The Overview catches the throw and
// renders a retryable error instead.

import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { COLLECTIONS } from '@/firebase/collections';
import { withTimeout, toDoc, buildNameMap, TIMEOUT } from '@/lib/firestore';
import { isOpen } from '@/services/issues.service';
import { ISSUE_KINDS } from '@/lib/domain';
import type {
  DashboardStats,
  IssueReport,
  AdminUpdate,
  Notification,
  IssueKind,
} from '@/types';

function zeroIssuesByCategory(): Record<IssueKind, number> {
  return ISSUE_KINDS.reduce(
    (acc, k) => ({ ...acc, [k]: 0 }),
    {} as Record<IssueKind, number>,
  );
}

async function fetchStats(): Promise<DashboardStats> {
  const [agenciesSnap, routesSnap, busesSnap, stopsSnap, notifSnap, issuesSnap, updatesSnap] =
    await Promise.all([
      getDocs(collection(db, COLLECTIONS.agencies)),
      getDocs(collection(db, COLLECTIONS.routes)),
      getDocs(collection(db, COLLECTIONS.buses)),
      getDocs(collection(db, COLLECTIONS.stops)),
      getDocs(query(collection(db, COLLECTIONS.notifications), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, COLLECTIONS.issueReports), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, COLLECTIONS.adminUpdates), orderBy('createdAt', 'desc'), limit(6))),
    ]);

  const issueReports = issuesSnap.docs.map(d => toDoc<IssueReport>(d));
  const notifications = notifSnap.docs.map(d => toDoc<Notification>(d));

  // Fleet status breakdown.
  let activeBuses = 0;
  let offlineBuses = 0;
  let maintenanceBuses = 0;
  const busesByAgency: Record<string, number> = {};
  busesSnap.docs.forEach(d => {
    const data = d.data() as { status?: string; agencyId?: string };
    if (data.status === 'Active') activeBuses++;
    else if (data.status === 'Maintenance') maintenanceBuses++;
    else offlineBuses++;
    const aid = data.agencyId || 'unassigned';
    busesByAgency[aid] = (busesByAgency[aid] ?? 0) + 1;
  });

  // Routes per agency + active route count.
  let activeRoutes = 0;
  const routesByAgency: Record<string, number> = {};
  routesSnap.docs.forEach(d => {
    const data = d.data() as { st?: string; agencyId?: string };
    if (data.st !== 'off') activeRoutes++;
    const aid = data.agencyId || 'unassigned';
    routesByAgency[aid] = (routesByAgency[aid] ?? 0) + 1;
  });

  // Issues by category + open/resolved counts.
  const issuesByCategory = zeroIssuesByCategory();
  let resolvedIssueReports = 0;
  issueReports.forEach(r => {
    if (r.kind in issuesByCategory) issuesByCategory[r.kind]++;
    if (r.status === 'resolved' || r.status === 'closed') resolvedIssueReports++;
  });

  return {
    totalAgencies: agenciesSnap.size,
    totalRoutes: routesSnap.size,
    activeRoutes,
    totalBuses: busesSnap.size,
    activeBuses,
    offlineBuses,
    maintenanceBuses,
    totalStops: stopsSnap.size,
    totalNotifications: notifSnap.size,
    openIssueReports: issueReports.filter(isOpen).length,
    totalIssueReports: issueReports.length,
    resolvedIssueReports,
    issuesByCategory,
    routesByAgency,
    busesByAgency,
    agencyNames: buildNameMap(agenciesSnap.docs),
    recentIssueReports: issueReports.slice(0, 5),
    recentAdminUpdates: updatesSnap.docs.map(d => toDoc<AdminUpdate>(d)),
    recentNotifications: notifications.slice(0, 5),
  };
}

export const dashboardService = {
  /**
   * Fetches KPI stats. Throws on failure or after FETCH_TIMEOUT_MS so the caller
   * can show a retryable error — never resolves to zeros, which would be
   * indistinguishable from an empty backend.
   */
  async getStats(): Promise<DashboardStats> {
    const result = await withTimeout(fetchStats());
    if (result === TIMEOUT) {
      throw new Error('Timed out reading the dashboard data. Check your connection and retry.');
    }
    return result;
  },
};
