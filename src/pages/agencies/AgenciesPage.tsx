import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAgencyFilter } from '@/hooks/useAgencyFilter';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Eye, Building2, Power, PowerOff } from 'lucide-react';
import { agenciesService, type AgencyWithCounts } from '@/services/agencies.service';
import { useAuth } from '@/hooks/useAuth';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useDataTable } from '@/hooks/useDataTable';
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
import { AgencyFormDialog } from '@/pages/agencies/AgencyFormDialog';

export function AgenciesPage() {
  const queryClient = useQueryClient();
  const audit = useAuditLog();
  const { user } = useAuth();
  const { scopeAgencyId, scopeKey } = useAgencyFilter();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agencies', 'with-counts', scopeKey],
    queryFn: () => agenciesService.listWithCounts(scopeAgencyId),
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AgencyWithCounts | null>(null);
  const [deleting, setDeleting] = useState<AgencyWithCounts | null>(null);

  const table = useDataTable({
    items: data ?? [],
    searchText: a => `${a.name} ${a.city ?? ''} ${a.email ?? ''} ${a.phone ?? ''}`,
    pageSize: 10,
  });

  const deleteMutation = useMutation({
    mutationFn: (agency: AgencyWithCounts) => agenciesService.remove(agency.id),
    onSuccess: async (_r, agency) => {
      await audit('agency_delete', `Deleted agency "${agency.name}"`, agency.id);
      queryClient.invalidateQueries({ queryKey: ['agencies'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Agency deleted');
      setDeleting(null);
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Delete failed'),
  });

  const toggleActive = useMutation({
    mutationFn: (agency: AgencyWithCounts) =>
      agenciesService.setActive(agency.id, !(agency.active ?? true), user?.uid),
    onSuccess: (_r, agency) => {
      queryClient.invalidateQueries({ queryKey: ['agencies'] });
      toast.success((agency.active ?? true) ? 'Agency deactivated' : 'Agency activated');
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Update failed'),
  });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (agency: AgencyWithCounts) => {
    setEditing(agency);
    setFormOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Agencies"
        description="Onboard and manage transit operators across the platform."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New agency
          </Button>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <SearchInput
          value={table.query}
          onChange={table.setQuery}
          placeholder="Search agencies…"
          className="max-w-xs"
        />
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
            icon={Building2}
            title={table.query ? 'No agencies match your search' : 'No agencies yet'}
            description={table.query ? undefined : 'Create your first transit operator to get started.'}
            action={
              !table.query && (
                <Button onClick={openCreate} size="sm">
                  <Plus className="size-4" />
                  New agency
                </Button>
              )
            }
          />
        </TableContainer>
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Agency</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-center">Routes</TableHead>
                  <TableHead className="text-center">Buses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.paged.map(agency => (
                  <TableRow key={agency.id}>
                    <TableCell>
                      <Link to={`/agencies/${agency.id}`} className="flex items-center gap-3 group">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                          <Building2 className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground group-hover:text-primary">
                            {agency.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{agency.id}</p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{agency.city || '—'}</TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        <p className="truncate">{agency.email || '—'}</p>
                        <p className="truncate text-xs">{agency.phone || ''}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="neutral">{agency.routeCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="neutral">{agency.busCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={agency.active} />
                    </TableCell>
                    <TableCell>
                      <RowActions>
                        <DropdownMenuItem asChild>
                          <Link to={`/agencies/${agency.id}`}>
                            <Eye className="size-4" />
                            View details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openEdit(agency)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => toggleActive.mutate(agency)}>
                          {(agency.active ?? true) ? (
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
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(agency)}>
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

      <AgencyFormDialog open={formOpen} onOpenChange={setFormOpen} agency={editing} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={o => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description={
          <>
            An agency can only be deleted once nothing references it. This one currently owns{' '}
            {deleting?.routeCount ?? 0} route(s) and {deleting?.busCount ?? 0} bus(es) — if either is
            above zero the delete is refused; deactivate the agency instead. This cannot be undone.
          </>
        }
        confirmLabel="Delete agency"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </div>
  );
}
