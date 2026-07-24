import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ShieldCheck, Power, PowerOff } from 'lucide-react';
import { adminsService } from '@/services/admins.service';
import { agenciesService } from '@/services/agencies.service';
import { useAuth } from '@/hooks/useAuth';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useDataTable } from '@/hooks/useDataTable';
import { describeFirebaseError } from '@/lib/errors';
import { formatDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Pagination } from '@/components/Pagination';
import { RowActions } from '@/components/RowActions';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/states';
import { ActiveBadge } from '@/components/StatusBadge';
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
import { AdminFormDialog } from '@/pages/admins/AdminFormDialog';
import type { AdminRecord } from '@/types';

export function AdminsPage() {
  const queryClient = useQueryClient();
  const audit = useAuditLog();
  const { user } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admins'],
    queryFn: () => adminsService.list(),
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
  const [editing, setEditing] = useState<AdminRecord | null>(null);
  const [deleting, setDeleting] = useState<AdminRecord | null>(null);

  const table = useDataTable({
    items: data ?? [],
    searchText: a => `${a.email ?? ''} ${a.displayName ?? ''} ${a.uid}`,
    pageSize: 10,
  });

  const deleteMutation = useMutation({
    mutationFn: (admin: AdminRecord) => adminsService.remove(admin.uid),
    onSuccess: async (_r, admin) => {
      await audit('admin_delete', `Removed admin ${admin.email || admin.uid}`, admin.uid);
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      toast.success('Administrator removed');
      setDeleting(null);
    },
    onError: err => toast.error(describeFirebaseError(err, 'admins')),
  });

  const toggleActive = useMutation({
    mutationFn: (admin: AdminRecord) => adminsService.setActive(admin.uid, !admin.active),
    onSuccess: (_r, admin) => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      toast.success(admin.active ? 'Administrator deactivated' : 'Administrator activated');
    },
    onError: err => toast.error(describeFirebaseError(err, 'admins')),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (admin: AdminRecord) => {
    setEditing(admin);
    setFormOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Administrators"
        description="Manage who can access the platform and their access tier."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New administrator
          </Button>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <SearchInput value={table.query} onChange={table.setQuery} placeholder="Search admins…" className="max-w-xs" />
        {data && <p className="text-sm text-muted-foreground">{data.length} total</p>}
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
            icon={ShieldCheck}
            title={table.query ? 'No administrators match your search' : 'No administrators yet'}
            description={table.query ? undefined : 'Add your first administrator to grant platform access.'}
          />
        </TableContainer>
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Administrator</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.paged.map(admin => (
                  <TableRow key={admin.uid}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
                          {(admin.email || admin.uid).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {admin.email || admin.displayName || admin.uid}
                            {admin.uid === user?.uid && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{admin.uid}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {admin.superAdmin ? <Badge>Super Admin</Badge> : <Badge variant="neutral">Admin</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {admin.agencyId ? agencyNames[admin.agencyId] ?? admin.agencyId : 'Global'}
                    </TableCell>
                    <TableCell><ActiveBadge active={admin.active} /></TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(admin.createdAt)}</TableCell>
                    <TableCell>
                      <RowActions>
                        <DropdownMenuItem onSelect={() => openEdit(admin)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => toggleActive.mutate(admin)}
                          disabled={admin.uid === user?.uid}
                        >
                          {admin.active ? (
                            <>
                              <PowerOff className="size-4" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Power className="size-4" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setDeleting(admin)}
                          disabled={admin.uid === user?.uid}
                        >
                          <Trash2 className="size-4" />
                          Remove
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

      <AdminFormDialog open={formOpen} onOpenChange={setFormOpen} admin={editing} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={o => !o && setDeleting(null)}
        title={`Remove ${deleting?.email || deleting?.uid}?`}
        description="This removes their admin record (their Firebase Auth account is not deleted). They will lose access to both apps."
        confirmLabel="Remove administrator"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </div>
  );
}
