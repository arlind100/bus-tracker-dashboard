import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Route as RouteIcon, Circle } from 'lucide-react';
import { routesService } from '@/services/routes.service';
import { agenciesService } from '@/services/agencies.service';
import { useAuth } from '@/hooks/useAuth';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useDataTable } from '@/hooks/useDataTable';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Pagination } from '@/components/Pagination';
import { RowActions } from '@/components/RowActions';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/states';
import { RouteStatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/ui/skeleton';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { RouteFormDialog } from '@/pages/routes/RouteFormDialog';
import { ROUTE_STATUSES, ROUTE_STATUS_COLOR } from '@/lib/domain';
import type { Route, RouteStatus } from '@/types';

export function RoutesPage() {
  const queryClient = useQueryClient();
  const audit = useAuditLog();
  const { user } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['routes'],
    queryFn: () => routesService.list(),
  });
  const { data: agencies } = useQuery({
    queryKey: ['agencies'],
    queryFn: () => agenciesService.list(),
  });

  const agencyNames = useMemo(() => {
    const map: Record<string, string> = {};
    agencies?.forEach(a => { map[a.id] = a.name; });
    return map;
  }, [agencies]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Route | null>(null);
  const [deleting, setDeleting] = useState<Route | null>(null);

  const { data: dependents, isLoading: countingDependents } = useQuery({
    queryKey: ['route-dependents', deleting?.id],
    queryFn: () => routesService.countDependents(deleting!.id),
    enabled: !!deleting,
  });

  const table = useDataTable({
    items: data ?? [],
    searchText: r => `${r.routeNumber ?? ''} ${r.name} ${r.from ?? ''} ${r.to ?? ''} ${r.city ?? ''}`,
    pageSize: 10,
  });

  const deleteMutation = useMutation({
    mutationFn: (route: Route) => routesService.remove(route.id, user?.uid),
    onSuccess: async (_r, route) => {
      await audit('route_delete', `Deleted route "${route.name}" with its stops and schedules`, route.id);
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['stops'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['buses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Route deleted');
      setDeleting(null);
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Delete failed'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ route, status }: { route: Route; status: RouteStatus }) =>
      routesService.setStatus(route.id, status, user?.uid),
    onSuccess: async (_r, { route, status }) => {
      await audit('route_status', `Set route "${route.name}" to ${status}`, route.id);
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(`Route marked ${status}`);
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Update failed'),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (route: Route) => {
    setEditing(route);
    setFormOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Routes"
        description="Create and manage routes across all agencies."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New route
          </Button>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <SearchInput value={table.query} onChange={table.setQuery} placeholder="Search routes…" className="max-w-xs" />
        {data && <p className="text-sm text-muted-foreground">{data.length} total</p>}
      </div>

      {isLoading ? (
        <TableSkeleton cols={6} />
      ) : isError ? (
        <TableContainer>
          <ErrorState onRetry={() => refetch()} />
        </TableContainer>
      ) : table.total === 0 ? (
        <TableContainer>
          <EmptyState
            icon={RouteIcon}
            title={table.query ? 'No routes match your search' : 'No routes yet'}
            description={table.query ? undefined : 'Create your first route to get started.'}
            action={!table.query && (
              <Button onClick={openCreate} size="sm">
                <Plus className="size-4" />
                New route
              </Button>
            )}
          />
        </TableContainer>
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Route</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-center">Stops</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.paged.map(route => (
                  <TableRow key={route.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-semibold text-white shadow-sm"
                          style={{ background: route.color || '#2563eb' }}
                        >
                          {route.routeNumber || '—'}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{route.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {route.from || '—'} → {route.to || '—'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {route.agencyId ? agencyNames[route.agencyId] ?? route.agencyId : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{route.city || '—'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="neutral">{route.stops?.length ?? 0}</Badge>
                    </TableCell>
                    <TableCell><RouteStatusBadge status={route.status} /></TableCell>
                    <TableCell>
                      <RowActions>
                        <DropdownMenuItem onSelect={() => openEdit(route)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Set status</DropdownMenuLabel>
                        {ROUTE_STATUSES.map(status => (
                          <DropdownMenuItem
                            key={status}
                            disabled={route.status === status}
                            onSelect={() => statusMutation.mutate({ route, status })}
                          >
                            <Circle
                              className="size-3"
                              style={{ fill: ROUTE_STATUS_COLOR[status], color: 'transparent' }}
                            />
                            {status}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(route)}>
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Pagination
            page={table.page}
            pageCount={table.pageCount}
            total={table.total}
            pageSize={table.pageSize}
            onPageChange={table.setPage}
          />
        </>
      )}

      <RouteFormDialog open={formOpen} onOpenChange={setFormOpen} route={editing} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={o => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description={
          countingDependents ? (
            'Checking what depends on this route…'
          ) : (
            <>
              This permanently deletes the route
              {dependents && (dependents.stops > 0 || dependents.schedules > 0) && (
                <>
                  {', '}
                  <strong className="text-foreground">
                    {[
                      dependents.stops > 0 && `${dependents.stops} stop${dependents.stops === 1 ? '' : 's'}`,
                      dependents.schedules > 0 &&
                        `${dependents.schedules} timetable row${dependents.schedules === 1 ? '' : 's'}`,
                    ]
                      .filter(Boolean)
                      .join(' and ')}
                  </strong>
                </>
              )}
              .{' '}
              {dependents && dependents.buses > 0
                ? `${dependents.buses} bus${dependents.buses === 1 ? '' : 'es'} assigned to it will be kept but become unassigned. `
                : ''}
              Passengers stop seeing it immediately. This cannot be undone.
            </>
          )
        }
        confirmLabel="Delete route"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </div>
  );
}
