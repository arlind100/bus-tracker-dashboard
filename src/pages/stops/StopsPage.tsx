import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, MapPin, ArrowUp, ArrowDown } from 'lucide-react';
import { stopsService } from '@/services/stops.service';
import { routesService } from '@/services/routes.service';
import { useAuth } from '@/hooks/useAuth';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useDataTable } from '@/hooks/useDataTable';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Pagination } from '@/components/Pagination';
import { RowActions } from '@/components/RowActions';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { StopFormDialog } from '@/pages/stops/StopFormDialog';
import type { Stop } from '@/types';

const ALL = '__all__';

export function StopsPage() {
  const queryClient = useQueryClient();
  const audit = useAuditLog();
  const { user } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['stops'],
    queryFn: () => stopsService.list(),
  });
  const { data: routes } = useQuery({
    queryKey: ['routes'],
    queryFn: () => routesService.list(),
  });

  const routeNames = useMemo(() => {
    const map: Record<string, string> = {};
    routes?.forEach(r => { map[r.id] = r.name; });
    return map;
  }, [routes]);

  const [routeFilter, setRouteFilter] = useState<string>(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Stop | null>(null);
  const [deleting, setDeleting] = useState<Stop | null>(null);

  const filteredByRoute = useMemo(
    () => (routeFilter === ALL ? data ?? [] : (data ?? []).filter(s => s.routeId === routeFilter)),
    [data, routeFilter],
  );

  const table = useDataTable({
    items: filteredByRoute,
    searchText: s => `${s.name} ${s.city ?? ''} ${s.routeId ? routeNames[s.routeId] ?? '' : ''}`,
    pageSize: 12,
  });

  const deleteMutation = useMutation({
    mutationFn: (stop: Stop) => stopsService.remove(stop.id, user?.uid),
    onSuccess: async (_r, stop) => {
      await audit('stop_delete', `Deleted stop "${stop.name}"`, stop.id);
      queryClient.invalidateQueries({ queryKey: ['stops'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Stop deleted');
      setDeleting(null);
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Delete failed'),
  });

  const reorder = useMutation({
    mutationFn: ({ routeId, ids }: { routeId: string; ids: string[] }) =>
      stopsService.reorderForRoute(routeId, ids, user?.uid),
    onSuccess: async (_r, vars) => {
      await audit('stop_reorder', `Reordered stops on route ${vars.routeId}`, vars.routeId);
      queryClient.invalidateQueries({ queryKey: ['stops'] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast.success('Stop order updated');
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Reorder failed'),
  });

  const move = (stop: Stop, delta: number) => {
    if (!stop.routeId) return;
    const siblings = (data ?? [])
      .filter(s => s.routeId === stop.routeId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const from = siblings.findIndex(s => s.id === stop.id);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= siblings.length) return;
    const ids = siblings.map(s => s.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    reorder.mutate({ routeId: stop.routeId, ids });
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (stop: Stop) => {
    setEditing(stop);
    setFormOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Stops"
        description="Manage stops and their route assignments."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New stop
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput value={table.query} onChange={table.setQuery} placeholder="Search stops…" className="max-w-xs" />
          <Select value={routeFilter} onValueChange={setRouteFilter}>
            <SelectTrigger className="max-w-[220px]">
              <SelectValue placeholder="All routes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All routes</SelectItem>
              {routes?.map(r => (
                <SelectItem key={r.id} value={r.id}>
                  {r.routeNumber ? `${r.routeNumber} · ` : ''}{r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">{table.total} stops</p>
      </div>

      {isLoading ? (
        <TableSkeleton cols={5} />
      ) : isError ? (
        <TableContainer>
          <ErrorState onRetry={() => refetch()} />
        </TableContainer>
      ) : table.total === 0 ? (
        <TableContainer>
          <EmptyState
            icon={MapPin}
            title={table.query || routeFilter !== ALL ? 'No stops match your filters' : 'No stops yet'}
            description={table.query || routeFilter !== ALL ? undefined : 'Create your first stop.'}
            action={!table.query && routeFilter === ALL && (
              <Button onClick={openCreate} size="sm">
                <Plus className="size-4" />
                New stop
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
                  <TableHead>Stop</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-center">Order</TableHead>
                  <TableHead>Coordinates</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.paged.map(stop => (
                  <TableRow key={stop.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                          <MapPin className="size-4" />
                        </div>
                        <span className="font-medium text-foreground">{stop.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {stop.routeId ? routeNames[stop.routeId] ?? stop.routeId : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{stop.city || '—'}</TableCell>
                    <TableCell className="text-center">
                      {stop.order != null ? <Badge variant="neutral">{stop.order}</Badge> : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {stop.lat != null && stop.lng != null
                        ? `${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <RowActions>
                        <DropdownMenuItem onSelect={() => openEdit(stop)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!stop.routeId || reorder.isPending}
                          onSelect={() => move(stop, -1)}
                        >
                          <ArrowUp className="size-4" />
                          Move earlier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!stop.routeId || reorder.isPending}
                          onSelect={() => move(stop, 1)}
                        >
                          <ArrowDown className="size-4" />
                          Move later
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(stop)}>
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

      <StopFormDialog open={formOpen} onOpenChange={setFormOpen} stop={editing} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={o => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="This permanently deletes the stop record. This cannot be undone."
        confirmLabel="Delete stop"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </div>
  );
}
