import { useQuery } from '@tanstack/react-query';
import { Bus, TriangleAlert, CircleCheck, Activity } from 'lucide-react';
import { analyticsService } from '@/services/analytics.service';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { DonutChart } from '@/components/charts/DonutChart';
import { BarChart } from '@/components/charts/BarChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/spinner';
import { ErrorState } from '@/components/states';
import { CHART_COLORS, STATUS_CHART_COLOR } from '@/lib/domain';

export function AnalyticsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => analyticsService.getAnalytics(),
  });

  if (isLoading) return <LoadingState label="Crunching analytics…" />;
  if (isError || !data) {
    return (
      <div>
        <PageHeader title="Analytics" description="Platform-wide performance and trends." />
        <Card>
          <ErrorState onRetry={() => refetch()} />
        </Card>
      </div>
    );
  }

  const fleetData = [
    { name: 'Active', value: data.fleetStatus.active, color: STATUS_CHART_COLOR.active },
    { name: 'Offline', value: data.fleetStatus.offline, color: STATUS_CHART_COLOR.offline },
    { name: 'Maintenance', value: data.fleetStatus.maintenance, color: STATUS_CHART_COLOR.maintenance },
  ];

  const withColors = (items: { name: string; value: number }[]) =>
    items.map((d, i) => ({ ...d, color: CHART_COLORS[i % CHART_COLORS.length] }));

  return (
    <div>
      <PageHeader title="Analytics" description="Platform-wide performance and trends." />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total buses" value={data.totalBuses} icon={Bus} />
        <StatCard label="Active buses" value={data.fleetStatus.active} icon={CircleCheck} tone="success" />
        <StatCard
          label="Open issues"
          value={data.openIssues}
          sublabel={`${data.totalIssues} total`}
          icon={TriangleAlert}
          tone={data.openIssues > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Resolution rate"
          value={`${data.resolutionRate}%`}
          sublabel={`${data.resolvedIssues} resolved`}
          icon={CircleCheck}
          tone={data.resolutionRate >= 50 ? 'success' : 'default'}
        />
      </div>

      {/* Fleet + issue mix */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
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
            <BarChart data={data.issuesByCategory} layout="vertical" color={STATUS_CHART_COLOR.open} />
          </CardContent>
        </Card>
      </div>

      {/* Agency breakdowns */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Routes by agency</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={withColors(data.routesByAgency)} layout="vertical" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fleet size by agency</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={withColors(data.busesByAgency)} layout="vertical" />
          </CardContent>
        </Card>
      </div>

      {/* Activity */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Admin activity · last 14 days</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={data.activityTimeline} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top actions</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topActions.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center gap-2 text-sm text-muted-foreground">
                <Activity className="size-4" />
                No admin activity yet
              </div>
            ) : (
              <BarChart data={withColors(data.topActions)} layout="vertical" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
