import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAgencyFilter } from '@/hooks/useAgencyFilter';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, CalendarClock, Clock } from 'lucide-react';
import { schedulesService } from '@/services/schedules.service';
import { routesService } from '@/services/routes.service';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useDataTable } from '@/hooks/useDataTable';
import { describeFirebaseError } from '@/lib/errors';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Pagination } from '@/components/Pagination';
import { RowActions } from '@/components/RowActions';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/states';
import { ActiveBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ScheduleFormDialog } from '@/pages/schedules/ScheduleFormDialog';
import { DAY_TYPE_LABEL } from '@/lib/domain';
import type { Schedule } from '@/types';

function isPermissionError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === 'permission-denied' || /permission/i.test(e?.message ?? '');
}

export function SchedulesPage() {
  const queryClient = useQueryClient();
  const audit = useAuditLog();

  const { scopeAgencyId, scopeKey } = useAgencyFilter();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['schedules', scopeKey],
    queryFn: () => schedulesService.list(scopeAgencyId),
    retry: false,
  });
  const { data: routes } = useQuery({ queryKey: ['routes', scopeKey], queryFn: () => routesService.list(scopeAgencyId) });

  const routeNames = useMemo(() => {
    const map: Record<string, string> = {};
    routes?.forEach(r => { map[r.id] = r.routeNumber ? `${r.routeNumber} · ${r.name}` : r.name; });
    return map;
  }, [routes]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [deleting, setDeleting] = useState<Schedule | null>(null);

  const table = useDataTable({
    items: data ?? [],
    searchText: s => `${routeNames[s.routeId] ?? s.routeId} ${s.dayType} ${s.departureTime} ${s.arrivalTime}`,
    pageSize: 12,
  });

  const deleteMutation = useMutation({
    mutationFn: (s: Schedule) => schedulesService.remove(s.id),
    onSuccess: async (_r, s) => {
      await audit('schedule_delete', `Deleted schedule ${s.id}`, s.id);
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Schedule deleted');
      setDeleting(null);
    },
    onError: err => toast.error(describeFirebaseError(err, 'schedules')),
  });

  const permissionBlocked = isError && isPermissionError(error);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (s: Schedule) => {
    setEditing(s);
    setFormOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Schedules"
        description="Manage route timetables."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New schedule
          </Button>
        }
      />

      {!permissionBlocked && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <SearchInput value={table.query} onChange={table.setQuery} placeholder="Search schedules…" className="max-w-xs" />
          {data && <p className="text-sm text-muted-foreground">{data.length} entries</p>}
        </div>
      )}

      {isLoading ? (
        <TableSkeleton cols={5} />
      ) : permissionBlocked ? (
        <Card>
          <EmptyState
            icon={CalendarClock}
            title="Schedules are not accessible yet"
            description="Deploy the proposed schedules Firestore rule to enable this section. Until then, reads and writes are denied by default."
            action={
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        </Card>
      ) : isError ? (
        <Card>
          <EmptyState icon={CalendarClock} title="Could not load schedules" description={describeFirebaseError(error, 'schedules')} />
        </Card>
      ) : table.total === 0 ? (
        <TableContainer>
          <EmptyState
            icon={CalendarClock}
            title={table.query ? 'No schedules match your search' : 'No schedules yet'}
            description={table.query ? undefined : 'Create your first timetable entry.'}
            action={!table.query && (
              <Button onClick={openCreate} size="sm">
                <Plus className="size-4" />
                New schedule
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
                  <TableHead>Day type</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Arrival</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.paged.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{routeNames[s.routeId] ?? s.routeId}</TableCell>
                    <TableCell>
                      <Badge variant="neutral">{DAY_TYPE_LABEL[s.dayType] ?? s.dayType}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="size-3.5" />{s.departureTime}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.arrivalTime}</TableCell>
                    <TableCell><ActiveBadge active={s.isActive} /></TableCell>
                    <TableCell>
                      <RowActions>
                        <DropdownMenuItem onSelect={() => openEdit(s)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(s)}>
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

      <ScheduleFormDialog open={formOpen} onOpenChange={setFormOpen} schedule={editing} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={o => !o && setDeleting(null)}
        title="Delete schedule?"
        description="This permanently deletes this timetable entry. This cannot be undone."
        confirmLabel="Delete schedule"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </div>
  );
}
