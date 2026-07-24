import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Bell } from 'lucide-react';
import { notificationsService } from '@/services/notifications.service';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useDataTable } from '@/hooks/useDataTable';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Pagination } from '@/components/Pagination';
import { RowActions } from '@/components/RowActions';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/states';
import { NotificationKindBadge } from '@/components/StatusBadge';
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
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { NotificationFormDialog } from '@/pages/notifications/NotificationFormDialog';
import { formatDateTime } from '@/lib/utils';
import type { Notification } from '@/types';

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const audit = useAuditLog();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsService.list(),
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Notification | null>(null);
  const [deleting, setDeleting] = useState<Notification | null>(null);

  const table = useDataTable({
    items: data ?? [],
    searchText: n => `${n.title} ${n.body} ${n.kind}`,
    pageSize: 12,
  });

  const deleteMutation = useMutation({
    mutationFn: (n: Notification) => notificationsService.remove(n.id),
    onSuccess: async (_r, n) => {
      await audit('notification_delete', `Deleted alert "${n.title}"`, n.id);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Notification deleted');
      setDeleting(null);
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Delete failed'),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (n: Notification) => {
    setEditing(n);
    setFormOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Broadcast service alerts to passengers in the mobile app."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New notification
          </Button>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <SearchInput value={table.query} onChange={table.setQuery} placeholder="Search notifications…" className="max-w-xs" />
        {data && <p className="text-sm text-muted-foreground">{data.length} total</p>}
      </div>

      {isLoading ? (
        <TableSkeleton cols={4} />
      ) : isError ? (
        <TableContainer>
          <ErrorState onRetry={() => refetch()} />
        </TableContainer>
      ) : table.total === 0 ? (
        <TableContainer>
          <EmptyState
            icon={Bell}
            title={table.query ? 'No notifications match your search' : 'No notifications yet'}
            description={table.query ? undefined : 'Broadcast your first service alert.'}
            action={!table.query && (
              <Button onClick={openCreate} size="sm">
                <Plus className="size-4" />
                New notification
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
                  <TableHead>Notification</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.paged.map(n => (
                  <TableRow key={n.id}>
                    <TableCell>
                      <div className="flex items-start gap-3">
                        <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: n.color || '#4f46e5' }} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{n.title}</p>
                          <p className="max-w-md truncate text-xs text-muted-foreground">{n.body}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><NotificationKindBadge kind={n.kind} /></TableCell>
                    <TableCell><Badge variant="success">Published</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(n.createdAt)}</TableCell>
                    <TableCell>
                      <RowActions>
                        <DropdownMenuItem onSelect={() => openEdit(n)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(n)}>
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

      <NotificationFormDialog open={formOpen} onOpenChange={setFormOpen} notification={editing} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={o => !o && setDeleting(null)}
        title="Delete notification?"
        description="This removes the alert from the passenger app. This cannot be undone."
        confirmLabel="Delete notification"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </div>
  );
}
