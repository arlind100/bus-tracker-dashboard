import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Bus as BusIcon, Circle } from 'lucide-react';
import { busesService } from '@/services/buses.service';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useDataTable } from '@/hooks/useDataTable';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Pagination } from '@/components/Pagination';
import { RowActions } from '@/components/RowActions';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/states';
import { BusStatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
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
import { BusFormDialog } from '@/pages/buses/BusFormDialog';
import { BUS_STATUSES } from '@/lib/domain';
import { formatRelative } from '@/lib/utils';
import type { Bus, BusStatus } from '@/types';

const STATUS_COLOR: Record<BusStatus, string> = {
  Active: '#16a34a',
  Offline: '#94a3b8',
  Maintenance: '#f59e0b',
};

export function BusesPage() {
  const queryClient = useQueryClient();
  const audit = useAuditLog();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['buses'],
    queryFn: () => busesService.list(),
  });

  const buses = data?.buses ?? [];
  const routeNames = data?.routeNames ?? {};
  const agencyNames = data?.agencyNames ?? {};

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Bus | null>(null);
  const [deleting, setDeleting] = useState<Bus | null>(null);

  const searchText = useMemo(
    () => (b: Bus) =>
      `${b.busNumber ?? ''} ${b.plate ?? ''} ${b.driver ?? ''} ${b.routeId ? routeNames[b.routeId] ?? '' : ''} ${b.agencyId ? agencyNames[b.agencyId] ?? '' : ''}`,
    [routeNames, agencyNames],
  );

  const table = useDataTable({ items: buses, searchText, pageSize: 10 });

  const deleteMutation = useMutation({
    mutationFn: (bus: Bus) => busesService.remove(bus.id),
    onSuccess: async (_r, bus) => {
      await audit('bus_delete', `Deleted bus ${bus.busNumber || bus.id}`, bus.id);
      queryClient.invalidateQueries({ queryKey: ['buses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Bus deleted');
      setDeleting(null);
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Delete failed'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ bus, status }: { bus: Bus; status: BusStatus }) => busesService.setStatus(bus.id, status),
    onSuccess: async (_r, { bus, status }) => {
      await audit('bus_status', `Set bus ${bus.busNumber || bus.id} to ${status}`, bus.id);
      queryClient.invalidateQueries({ queryKey: ['buses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(`Bus marked ${status}`);
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Update failed'),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (bus: Bus) => {
    setEditing(bus);
    setFormOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Buses"
        description="Manage the vehicle fleet across all agencies."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New bus
          </Button>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <SearchInput value={table.query} onChange={table.setQuery} placeholder="Search buses…" className="max-w-xs" />
        <p className="text-sm text-muted-foreground">{buses.length} vehicles</p>
      </div>

      {isLoading ? (
        <TableSkeleton cols={7} />
      ) : isError ? (
        <TableContainer>
          <ErrorState onRetry={() => refetch()} />
        </TableContainer>
      ) : table.total === 0 ? (
        <TableContainer>
          <EmptyState
            icon={BusIcon}
            title={table.query ? 'No buses match your search' : 'No buses yet'}
            description={table.query ? undefined : 'Add your first vehicle to the fleet.'}
            action={!table.query && (
              <Button onClick={openCreate} size="sm">
                <Plus className="size-4" />
                New bus
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
                  <TableHead>Bus</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-center">Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.paged.map(bus => (
                  <TableRow key={bus.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                          <BusIcon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{bus.busNumber || bus.id}</p>
                          <p className="truncate text-xs text-muted-foreground">{bus.plate || '—'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {bus.agencyId ? agencyNames[bus.agencyId] ?? bus.agencyId : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {bus.routeId ? routeNames[bus.routeId] ?? bus.routeId : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{bus.driver || '—'}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{bus.capacity ?? '—'}</TableCell>
                    <TableCell><BusStatusBadge status={bus.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{formatRelative(bus.updatedAt)}</TableCell>
                    <TableCell>
                      <RowActions>
                        <DropdownMenuItem onSelect={() => openEdit(bus)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Set status</DropdownMenuLabel>
                        {BUS_STATUSES.map(status => (
                          <DropdownMenuItem
                            key={status}
                            disabled={bus.status === status}
                            onSelect={() => statusMutation.mutate({ bus, status })}
                          >
                            <Circle className="size-3" style={{ fill: STATUS_COLOR[status], color: 'transparent' }} />
                            {status}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(bus)}>
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

      <BusFormDialog open={formOpen} onOpenChange={setFormOpen} bus={editing} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={o => !o && setDeleting(null)}
        title={`Delete ${deleting?.busNumber || deleting?.id}?`}
        description="This permanently deletes the bus. Its live location record is left untouched. This cannot be undone."
        confirmLabel="Delete bus"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </div>
  );
}
