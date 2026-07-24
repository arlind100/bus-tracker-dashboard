import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Trash2, TriangleAlert, CircleCheck } from 'lucide-react';
import { issuesService } from '@/services/issues.service';
import { useAuth } from '@/hooks/useAuth';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useDataTable } from '@/hooks/useDataTable';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { Pagination } from '@/components/Pagination';
import { RowActions } from '@/components/RowActions';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/states';
import { IssueStatusBadge } from '@/components/StatusBadge';
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
import { IssueTriageDialog } from '@/pages/issues/IssueTriageDialog';
import { ISSUE_KIND_LABEL } from '@/lib/domain';
import { isOpen } from '@/services/issues.service';
import { formatRelative, cn } from '@/lib/utils';
import type { IssueReport, IssueStatus } from '@/types';

type FilterKey = 'all' | 'open' | 'resolved' | IssueStatus;
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
];

export function IssuesPage() {
  const queryClient = useQueryClient();
  const audit = useAuditLog();
  const { user } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['issues'],
    queryFn: () => issuesService.list(),
  });

  const reports = data?.reports ?? [];
  const routeNames = data?.routeNames ?? {};

  const [filter, setFilter] = useState<FilterKey>('all');
  const [triaging, setTriaging] = useState<IssueReport | null>(null);
  const [deleting, setDeleting] = useState<IssueReport | null>(null);

  const filteredByStatus = useMemo(() => {
    if (filter === 'all') return reports;
    if (filter === 'open') return reports.filter(isOpen);
    if (filter === 'resolved') return reports.filter(r => r.status === 'resolved' || r.status === 'closed');
    return reports.filter(r => (r.status ?? 'new') === filter);
  }, [reports, filter]);

  const table = useDataTable({
    items: filteredByStatus,
    searchText: r => `${ISSUE_KIND_LABEL[r.kind] ?? r.kind} ${r.description} ${r.routeId ? routeNames[r.routeId] ?? '' : ''} ${r.busId ?? ''}`,
    pageSize: 12,
  });

  const counts = useMemo(
    () => ({
      all: reports.length,
      open: reports.filter(isOpen).length,
      resolved: reports.filter(r => r.status === 'resolved' || r.status === 'closed').length,
    }),
    [reports],
  );

  const resolveMutation = useMutation({
    mutationFn: (r: IssueReport) => issuesService.setStatus(r.id, 'resolved', user?.uid),
    onSuccess: async (_res, r) => {
      await audit('issue_triage', `Resolved issue ${r.id}`, r.id);
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Issue resolved');
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (r: IssueReport) => issuesService.remove(r.id),
    onSuccess: async (_res, r) => {
      await audit('issue_delete', `Deleted issue ${r.id}`, r.id);
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Issue deleted');
      setDeleting(null);
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Delete failed'),
  });

  return (
    <div>
      <PageHeader title="Issues" description="Triage passenger-submitted reports." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
              <span className={cn('rounded px-1 text-[11px]', filter === f.key ? 'bg-white/20' : 'bg-background')}>
                {counts[f.key as 'all' | 'open' | 'resolved']}
              </span>
            </button>
          ))}
        </div>
        <SearchInput value={table.query} onChange={table.setQuery} placeholder="Search issues…" className="max-w-xs" />
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
            icon={TriangleAlert}
            title={table.query || filter !== 'all' ? 'No issues match your filters' : 'No issue reports'}
            description={table.query || filter !== 'all' ? undefined : 'Passenger reports will appear here.'}
          />
        </TableContainer>
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Bus</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reported</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.paged.map(report => (
                  <TableRow key={report.id} className="cursor-pointer" onClick={() => setTriaging(report)}>
                    <TableCell className="font-medium">{ISSUE_KIND_LABEL[report.kind] ?? report.kind}</TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-muted-foreground">{report.description || '—'}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {report.routeId ? routeNames[report.routeId] ?? report.routeId : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{report.busId || '—'}</TableCell>
                    <TableCell><IssueStatusBadge status={report.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{formatRelative(report.createdAt)}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <RowActions>
                        <DropdownMenuItem onSelect={() => setTriaging(report)}>
                          <Pencil className="size-4" />
                          Triage
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => resolveMutation.mutate(report)}
                          disabled={report.status === 'resolved'}
                        >
                          <CircleCheck className="size-4" />
                          Mark resolved
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(report)}>
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

      <IssueTriageDialog
        open={!!triaging}
        onOpenChange={o => !o && setTriaging(null)}
        report={triaging}
        routeNames={routeNames}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={o => !o && setDeleting(null)}
        title="Delete this issue report?"
        description="This permanently removes the passenger report. This cannot be undone."
        confirmLabel="Delete report"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </div>
  );
}
