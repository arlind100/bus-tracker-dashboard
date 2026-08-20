import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { COLLECTIONS } from '@/firebase/collections';
import { scopeOwned, scopeOwnedOrGlobal } from '@/lib/scope';
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

async function fetchStats(scopeAgencyId?: string, currentUid?: string): Promise<DashboardStats> {
  const [agenciesSnap, routesSnap, busesSnap, stopsSnap, notifSnap, issuesSnap, updatesSnap] =
    await Promise.all([
      getDocs(collection(db, COLLECTIONS.agencies)),
      getDocs(collection(db, COLLECTIONS.routes)),
      getDocs(collection(db, COLLECTIONS.buses)),
      getDocs(collection(db, COLLECTIONS.stops)),
      getDocs(query(collection(db, COLLECTIONS.notifications), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, COLLECTIONS.issueReports), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, COLLECTIONS.adminUpdates), orderBy('createdAt', 'desc'), limit(24))),
    ]);

  // Everything below counts the SCOPED rows, so an agency admin's dashboard is
  // their own operation rather than the platform's.
  const agencies = scopeAgencyId
    ? agenciesSnap.docs.filter(d => d.id === scopeAgencyId)
    : agenciesSnap.docs;
  const routes = scopeOwned(routesSnap.docs.map(d => ({ ...(d.data() as Record<string, unknown>), id: d.id })) as Array<{ id: string; st?: string; agencyId?: string }>, scopeAgencyId);
  const buses = scopeOwned(busesSnap.docs.map(d => ({ ...(d.data() as Record<string, unknown>), id: d.id })) as Array<{ id: string; status?: string; agencyId?: string; routeId?: string }>, scopeAgencyId);
  const stops = scopeOwned(stopsSnap.docs.map(d => ({ ...(d.data() as Record<string, unknown>), id: d.id })) as Array<{ id: string; agencyId?: string }>, scopeAgencyId);

  const issueReports = issuesSnap.docs.map(d => toDoc<IssueReport>(d));
  const notifications = scopeOwnedOrGlobal(notifSnap.docs.map(d => toDoc<Notification>(d)), scopeAgencyId);

  let activeBuses = 0;
  let offlineBuses = 0;
  let maintenanceBuses = 0;
  const busesByAgency: Record<string, number> = {};
  const busesByRoute: Record<string, number> = {};
  buses.forEach(data => {
    if (data.status === 'Active') activeBuses++;
    else if (data.status === 'Maintenance') maintenanceBuses++;
    else offlineBuses++;
    const aid = data.agencyId || 'unassigned';
    busesByAgency[aid] = (busesByAgency[aid] ?? 0) + 1;
    const rid = data.routeId || 'unassigned';
    busesByRoute[rid] = (busesByRoute[rid] ?? 0) + 1;
  });

  let activeRoutes = 0;
  const routesByAgency: Record<string, number> = {};
  routes.forEach(data => {
    if (data.st !== 'off') activeRoutes++;
    const aid = data.agencyId || 'unassigned';
    routesByAgency[aid] = (routesByAgency[aid] ?? 0) + 1;
  });

  const issuesByCategory = zeroIssuesByCategory();
  let resolvedIssueReports = 0;
  issueReports.forEach(r => {
    if (r.kind in issuesByCategory) issuesByCategory[r.kind]++;
    if (r.status === 'resolved' || r.status === 'closed') resolvedIssueReports++;
  });

  // The audit trail carries no agencyId, so it cannot be filtered by agency.
  // A scoped admin therefore sees their OWN actions rather than the platform's —
  // showing every agency's activity on a scoped dashboard would leak exactly
  // what the scope exists to prevent.
  const adminUpdates = updatesSnap.docs.map(d => toDoc<AdminUpdate>(d));
  const recentAdminUpdates = (scopeAgencyId
    ? adminUpdates.filter(u => u.adminUid === currentUid)
    : adminUpdates
  ).slice(0, 6);

  return {
    totalAgencies: agencies.length,
    totalRoutes: routes.length,
    activeRoutes,
    totalBuses: buses.length,
    activeBuses,
    offlineBuses,
    maintenanceBuses,
    totalStops: stops.length,
    totalNotifications: notifications.length,
    openIssueReports: issueReports.filter(isOpen).length,
    totalIssueReports: issueReports.length,
    resolvedIssueReports,
    issuesByCategory,
    routesByAgency,
    busesByAgency,
    busesByRoute,
    agencyNames: buildNameMap(agenciesSnap.docs),
    routeNames: buildNameMap(routesSnap.docs),
    recentIssueReports: issueReports.slice(0, 5),
    recentAdminUpdates,
    recentNotifications: notifications.slice(0, 5),
  };
}

export const dashboardService = {
  /**
   * @param scopeAgencyId restricts every figure to one agency. Undefined for a
   *   super admin, whose dashboard is the whole platform.
   * @param currentUid    the caller, used to narrow the audit trail when scoped.
   */
  async getStats(scopeAgencyId?: string, currentUid?: string): Promise<DashboardStats> {
    const result = await withTimeout(fetchStats(scopeAgencyId, currentUid));
    if (result === TIMEOUT) {
      throw new Error('Timed out reading the dashboard data. Check your connection and retry.');
    }
    return result;
  },
};
