import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, IdCard, Bus as BusIcon, Circle } from 'lucide-react';
import { driversService } from '@/services/drivers.service';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAuth } from '@/hooks/useAuth';
import { useDataTable } from '@/hooks/useDataTable';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Pagination } from '@/components/Pagination';
import { RowActions } from '@/components/RowActions';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/states';
import { DriverStatusBadge } from '@/components/StatusBadge';
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
import { DriverFormDialog } from '@/pages/drivers/DriverFormDialog';
import { AssignBusDialog } from '@/pages/drivers/AssignBusDialog';
import { DRIVER_STATUSES, DRIVER_STATUS_LABEL } from '@/lib/domain';
import { formatRelative } from '@/lib/utils';
import type { Driver, DriverStatus } from '@/types';

const STATUS_COLOR: Record<DriverStatus, string> = {
  active: '#16a34a',
  inactive: '#94a3b8',
  on_leave: '#f59e0b',
};

export function DriversPage() {
  const queryClient = useQueryClient();
  const audit = useAuditLog();
  const { user } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['drivers', user?.agencyId ?? 'all'],
    // Scoped so an agency admin's list query stays within what the rules allow.
    queryFn: () => driversService.list(user?.agencyId),
  });

  const drivers = useMemo(() => data?.drivers ?? [], [data]);
  const agencyNames = useMemo(() => data?.agencyNames ?? {}, [data]);
  const busLabels = useMemo(() => data?.busLabels ?? {}, [data]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [assigning, setAssigning] = useState<Driver | null>(null);
  const [deleting, setDeleting] = useState<Driver | null>(null);

  const searchText = useMemo(
    () => (d: Driver) =>
      `${d.name ?? ''} ${d.licenseNumber ?? ''} ${d.phone ?? ''} ${d.email ?? ''} ${
        d.agencyId ? agencyNames[d.agencyId] ?? '' : ''
      } ${d.assignedBusId ? busLabels[d.assignedBusId] ?? '' : ''}`,
    [agencyNames, busLabels],
  );

  const table = useDataTable({ items: drivers, searchText, pageSize: 10 });

  const deleteMutation = useMutation({
    mutationFn: (driver: Driver) => driversService.remove(driver.id, user?.uid),
    onSuccess: async (_r, driver) => {
      await audit('driver_delete', `Deleted driver ${driver.name}`, driver.id);
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['buses'] });
      toast.success('Driver deleted');
      setDeleting(null);
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Delete failed'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ driver, status }: { driver: Driver; status: DriverStatus }) =>
      driversService.setStatus(driver.id, status, user?.uid),
    onSuccess: async (_r, { driver, status }) => {
      await audit('driver_status', `Set ${driver.name} to ${DRIVER_STATUS_LABEL[status]}`, driver.id);
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success(`Driver marked ${DRIVER_STATUS_LABEL[status].toLowerCase()}`);
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Update failed'),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (driver: Driver) => {
    setEditing(driver);
    setFormOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Drivers"
        description="Personnel records for the people operating the fleet."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New driver
          </Button>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <SearchInput value={table.query} onChange={table.setQuery} placeholder="Search drivers…" className="max-w-xs" />
        <p className="text-sm text-muted-foreground">{drivers.length} drivers</p>
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
            icon={IdCard}
            title={table.query ? 'No drivers match your search' : 'No drivers yet'}
            description={
              table.query
                ? undefined
                : 'Add your first driver, then assign them to a vehicle.'
            }
            action={!table.query && (
              <Button onClick={openCreate} size="sm">
                <Plus className="size-4" />
                New driver
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
                  <TableHead>Driver</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Assigned bus</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.paged.map(driver => (
                  <TableRow key={driver.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                          <IdCard className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{driver.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {driver.licenseNumber || '—'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {driver.agencyId ? agencyNames[driver.agencyId] ?? driver.agencyId : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {driver.assignedBusId
                        ? busLabels[driver.assignedBusId] ?? driver.assignedBusId
                        : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {driver.phone || driver.email || '—'}
                    </TableCell>
                    <TableCell><DriverStatusBadge status={driver.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{formatRelative(driver.updatedAt)}</TableCell>
                    <TableCell>
                      <RowActions>
                        <DropdownMenuItem onSelect={() => openEdit(driver)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setAssigning(driver)}>
                          <BusIcon className="size-4" />
                          Assign bus
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Set status</DropdownMenuLabel>
                        {DRIVER_STATUSES.map(status => (
                          <DropdownMenuItem
                            key={status}
                            disabled={(driver.status ?? 'active') === status}
                            onSelect={() => statusMutation.mutate({ driver, status })}
                          >
                            <Circle className="size-3" style={{ fill: STATUS_COLOR[status], color: 'transparent' }} />
                            {DRIVER_STATUS_LABEL[status]}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(driver)}>
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

      <DriverFormDialog open={formOpen} onOpenChange={setFormOpen} driver={editing} />

      <AssignBusDialog
        open={!!assigning}
        onOpenChange={o => !o && setAssigning(null)}
        driver={assigning}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={o => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="This permanently deletes the driver record and clears them from any bus they are assigned to. This cannot be undone."
        confirmLabel="Delete driver"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </div>
  );
}
