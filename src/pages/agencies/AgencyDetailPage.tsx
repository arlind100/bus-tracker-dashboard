import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  Route as RouteIcon,
  Bus,
  ShieldCheck,
  TriangleAlert,
  Bell,
} from 'lucide-react';
import { agenciesService } from '@/services/agencies.service';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/ui/spinner';
import { ErrorState, EmptyState } from '@/components/states';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  RouteStatusBadge,
  BusStatusBadge,
  IssueStatusBadge,
  ActiveBadge,
  NotificationKindBadge,
} from '@/components/StatusBadge';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { ISSUE_KIND_LABEL } from '@/lib/domain';
import { formatRelative } from '@/lib/utils';

export function AgencyDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agency-detail', id],
    queryFn: () => agenciesService.getDetail(id),
  });

  if (isLoading) return <LoadingState label="Loading agency…" />;
  if (isError) {
    return (
      <Card>
        <ErrorState onRetry={() => refetch()} />
      </Card>
    );
  }
  if (!data) {
    return (
      <div>
        <BackLink />
        <Card>
          <EmptyState icon={Building2} title="Agency not found" description="It may have been deleted." />
        </Card>
      </div>
    );
  }

  const { agency, routes, buses, stops, admins, issues, notifications, routeNames } = data;

  return (
    <div>
      <BackLink />
      <PageHeader
        title={agency.name}
        description={agency.id}
        actions={<ActiveBadge active={agency.active} />}
      />

      {/* Contact + summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={MapPin} label="City" value={agency.city || '—'} />
        <InfoCard icon={Phone} label="Phone" value={agency.phone || '—'} />
        <InfoCard icon={Mail} label="Email" value={agency.email || '—'} />
        <InfoCard icon={RouteIcon} label="Routes / Buses" value={`${routes.length} / ${buses.length}`} />
      </div>

      <Tabs defaultValue="routes" className="mt-6">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="routes"><RouteIcon className="size-4" />Routes ({routes.length})</TabsTrigger>
            <TabsTrigger value="fleet"><Bus className="size-4" />Fleet ({buses.length})</TabsTrigger>
            <TabsTrigger value="stops"><MapPin className="size-4" />Stops ({stops.length})</TabsTrigger>
            <TabsTrigger value="admins"><ShieldCheck className="size-4" />Admins ({admins.length})</TabsTrigger>
            <TabsTrigger value="issues"><TriangleAlert className="size-4" />Issues ({issues.length})</TabsTrigger>
            <TabsTrigger value="notifications"><Bell className="size-4" />Alerts ({notifications.length})</TabsTrigger>
          </TabsList>
        </div>

        {/* Routes */}
        <TabsContent value="routes">
          {routes.length === 0 ? (
            <EmptyCard icon={RouteIcon} label="No routes for this agency." />
          ) : (
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Route</TableHead>
                    <TableHead>From → To</TableHead>
                    <TableHead className="text-center">Stops</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routes.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-xs font-semibold text-white"
                            style={{ background: r.color || '#2563eb' }}
                          >
                            {r.routeNumber || '—'}
                          </span>
                          <span className="font-medium">{r.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.from || '—'} → {r.to || '—'}
                      </TableCell>
                      <TableCell className="text-center">{r.stops?.length ?? 0}</TableCell>
                      <TableCell><RouteStatusBadge status={r.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabsContent>

        {/* Fleet */}
        <TabsContent value="fleet">
          {buses.length === 0 ? (
            <EmptyCard icon={Bus} label="No buses for this agency." />
          ) : (
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Bus</TableHead>
                    <TableHead>Plate</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buses.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.busNumber || b.id}</TableCell>
                      <TableCell className="text-muted-foreground">{b.plate || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {b.routeId ? routeNames[b.routeId] ?? b.routeId : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{b.driver || '—'}</TableCell>
                      <TableCell><BusStatusBadge status={b.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabsContent>

        {/* Stops */}
        <TabsContent value="stops">
          {stops.length === 0 ? (
            <EmptyCard icon={MapPin} label="No stops for this agency." />
          ) : (
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Stop</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead className="text-center">Order</TableHead>
                    <TableHead>Coordinates</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stops.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.routeId ? routeNames[s.routeId] ?? s.routeId : '—'}
                      </TableCell>
                      <TableCell className="text-center">{s.order ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.lat != null && s.lng != null ? `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabsContent>

        {/* Admins */}
        <TabsContent value="admins">
          {admins.length === 0 ? (
            <EmptyCard icon={ShieldCheck} label="No administrators assigned to this agency." />
          ) : (
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Email</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map(a => (
                    <TableRow key={a.uid}>
                      <TableCell className="font-medium">{a.email || a.uid}</TableCell>
                      <TableCell>
                        {a.role === 'super_admin'
                          ? <Badge>Super Admin</Badge>
                          : <Badge variant="neutral">Agency Admin</Badge>}
                      </TableCell>
                      <TableCell><ActiveBadge active={a.active} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabsContent>

        {/* Issues */}
        <TabsContent value="issues">
          {issues.length === 0 ? (
            <EmptyCard icon={TriangleAlert} label="No issue reports linked to this agency’s routes." />
          ) : (
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reported</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{ISSUE_KIND_LABEL[i.kind] ?? i.kind}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">{i.description}</TableCell>
                      <TableCell><IssueStatusBadge status={i.status} /></TableCell>
                      <TableCell className="text-muted-foreground">{formatRelative(i.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          {notifications.length === 0 ? (
            <EmptyCard
              icon={Bell}
              label="No alerts reference this agency’s routes. Notifications are not agency-scoped in the data model."
            />
          ) : (
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map(n => (
                    <TableRow key={n.id}>
                      <TableCell>
                        <p className="font-medium">{n.title}</p>
                        <p className="max-w-md truncate text-xs text-muted-foreground">{n.body}</p>
                      </TableCell>
                      <TableCell><NotificationKindBadge kind={n.kind} /></TableCell>
                      <TableCell className="text-muted-foreground">{formatRelative(n.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/agencies"
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to agencies
    </Link>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-medium text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyCard({ icon, label }: { icon: typeof MapPin; label: string }) {
  return (
    <Card>
      <EmptyState icon={icon} title={label} />
    </Card>
  );
}
