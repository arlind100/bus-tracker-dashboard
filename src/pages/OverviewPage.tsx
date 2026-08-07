import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Building2,
  Route as RouteIcon,
  Bus,
  MapPin,
  Bell,
  TriangleAlert,
  CircleCheck,
  Activity,
  Wrench,
  Power,
} from 'lucide-react';
import { dashboardService } from '@/services/dashboard.service';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { DonutChart } from '@/components/charts/DonutChart';
import { BarChart } from '@/components/charts/BarChart';
import { NotificationKindBadge, IssueStatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/spinner';
import { ErrorState, EmptyState } from '@/components/states';
import { formatRelative } from '@/lib/utils';
import { ISSUE_KIND_LABEL, STATUS_CHART_COLOR, CHART_COLORS } from '@/lib/domain';
import type { IssueKind } from '@/types';

export function OverviewPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardService.getStats(),
  });

  const firstName = (user?.displayName || user?.email || 'there').split(/[\s@]/)[0];

  if (isLoading) return <LoadingState label="Loading dashboard…" />;
  if (isError || !data) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <Card>
          <ErrorState onRetry={() => refetch()} />
        </Card>
      </div>
    );
  }

  const fleetData = [
    { name: 'Active', value: data.activeBuses, color: STATUS_CHART_COLOR.active },
    { name: 'Offline', value: data.offlineBuses, color: STATUS_CHART_COLOR.offline },
    { name: 'Maintenance', value: data.maintenanceBuses, color: STATUS_CHART_COLOR.maintenance },
  ];

  const issueData = (Object.keys(data.issuesByCategory) as IssueKind[]).map(k => ({
    name: ISSUE_KIND_LABEL[k],
    value: data.issuesByCategory[k],
  }));

  const agencyName = (id: string) => (id === 'unassigned' ? 'Unassigned' : data.agencyNames[id] ?? id);
  const busesByAgencyData = Object.entries(data.busesByAgency)
    .map(([id, value]) => ({ name: agencyName(id), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  const routesByAgencyData = Object.entries(data.routesByAgency)
    .map(([id, value], i) => ({ name: agencyName(id), value, color: CHART_COLORS[i % CHART_COLORS.length] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="A live overview of your transit platform."
        actions={
          // Reaching this render means the aggregate read succeeded — a failed
          // or timed-out read throws and is handled by the isError branch above.
          <Badge variant="success">
            <CircleCheck className="size-3.5" />
            Connected to Firestore
          </Badge>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Agencies" value={data.totalAgencies} icon={Building2} />
        <StatCard label="Routes" value={data.totalRoutes} sublabel={`${data.activeRoutes} active`} icon={RouteIcon} />
        <StatCard label="Buses" value={data.totalBuses} icon={Bus} />
        <StatCard label="Active buses" value={data.activeBuses} icon={CircleCheck} tone="success" />
        <StatCard label="Offline buses" value={data.offlineBuses} icon={Power} />
        <StatCard label="Maintenance" value={data.maintenanceBuses} icon={Wrench} tone="warning" />
        <StatCard label="Stops" value={data.totalStops} icon={MapPin} />
        <StatCard
          label="Open issues"
          value={data.openIssueReports}
          sublabel={`${data.totalIssueReports} total`}
          icon={TriangleAlert}
          tone={data.openIssueReports > 0 ? 'warning' : 'default'}
        />
        <StatCard label="Notifications" value={data.totalNotifications} icon={Bell} />
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Fleet status</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={fleetData} centerLabel="buses" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Issues by category</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={issueData} layout="vertical" color={STATUS_CHART_COLOR.open} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fleet size by agency</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={busesByAgencyData} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Routes by agency</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={routesByAgencyData} layout="vertical" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.recentAdminUpdates.length === 0 ? (
              <EmptyState icon={Activity} title="No activity yet" />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {data.recentAdminUpdates.map(update => (
                  <li key={update.id} className="flex items-start gap-3 py-3 first:pt-0">
                    <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <Activity className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{update.action}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{update.detail}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatRelative(update.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent lists */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent issue reports</CardTitle>
            <Link to="/issues" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {data.recentIssueReports.length === 0 ? (
              <EmptyState icon={TriangleAlert} title="No issue reports yet" />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {data.recentIssueReports.map(report => (
                  <li key={report.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {ISSUE_KIND_LABEL[report.kind] ?? report.kind}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {report.description || '—'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <IssueStatusBadge status={report.status} />
                      <span className="text-[11px] text-muted-foreground">{formatRelative(report.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent notifications</CardTitle>
            <Link to="/notifications" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {data.recentNotifications.length === 0 ? (
              <EmptyState icon={Bell} title="No notifications yet" />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {data.recentNotifications.map(n => (
                  <li key={n.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{n.body}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <NotificationKindBadge kind={n.kind} />
                      <span className="text-[11px] text-muted-foreground">{formatRelative(n.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
