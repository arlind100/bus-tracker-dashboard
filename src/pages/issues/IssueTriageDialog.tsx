import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bus as BusIcon, Route as RouteIcon, MapPin, Clock } from 'lucide-react';
import { issuesService } from '@/services/issues.service';
import { adminsService } from '@/services/admins.service';
import { useAuth } from '@/hooks/useAuth';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { FormField } from '@/components/form/FormField';
import { IssueStatusBadge } from '@/components/StatusBadge';
import { ISSUE_STATUSES, ISSUE_KIND_LABEL } from '@/lib/domain';
import { formatDateTime } from '@/lib/utils';
import type { IssueReport, IssueStatus } from '@/types';

const UNASSIGNED = '__unassigned__';

export function IssueTriageDialog({
  open,
  onOpenChange,
  report,
  routeNames,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: IssueReport | null;
  routeNames: Record<string, string>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {report && (
          <IssueTriageForm
            key={report.id}
            report={report}
            routeNames={routeNames}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// State is seeded from the report via useState initializers and the form is keyed
// by report id, so it resets cleanly on each open without a state-syncing effect.
function IssueTriageForm({
  report,
  routeNames,
  onOpenChange,
}: {
  report: IssueReport;
  routeNames: Record<string, string>;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const audit = useAuditLog();
  const { user } = useAuth();

  const { data: admins } = useQuery({ queryKey: ['admins'], queryFn: () => adminsService.list() });

  const [status, setStatus] = useState<IssueStatus>(report.status ?? 'new');
  const [assignedTo, setAssignedTo] = useState<string>(report.assignedTo || UNASSIGNED);
  const [note, setNote] = useState(report.resolutionNote ?? '');

  const mutation = useMutation({
    mutationFn: async () => {
      await issuesService.update(report.id, {
        status,
        assignedTo: assignedTo === UNASSIGNED ? undefined : assignedTo,
        resolutionNote: note.trim() || undefined,
        updatedBy: user?.uid,
      });
      await audit('issue_triage', `Set issue ${report.id} to ${status}`, report.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Issue updated');
      onOpenChange(false);
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Update failed'),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {ISSUE_KIND_LABEL[report.kind] ?? report.kind}
          <IssueStatusBadge status={report.status} />
        </DialogTitle>
        <DialogDescription>Triage this passenger-submitted report.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
          {/* Report body */}
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
            {report.description || 'No description provided.'}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {report.routeId && (
              <span className="inline-flex items-center gap-1.5">
                <RouteIcon className="size-3.5" />
                {routeNames[report.routeId] ?? report.routeId}
              </span>
            )}
            {report.busId && (
              <span className="inline-flex items-center gap-1.5">
                <BusIcon className="size-3.5" />
                {report.busId}
              </span>
            )}
            {report.stopName && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {report.stopName}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" />
              {formatDateTime(report.createdAt)}
            </span>
          </div>

          <FormField label="Status">
            <Select value={status} onValueChange={v => setStatus(v as IssueStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ISSUE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Assigned to">
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {admins?.map(a => (
                  <SelectItem key={a.uid} value={a.uid}>{a.email || a.displayName || a.uid}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Resolution note">
            <Textarea
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add context or the resolution taken…"
            />
          </FormField>
        </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={mutation.isPending}>Cancel</Button>
        </DialogClose>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner className="size-4 text-primary-foreground" /> : 'Save changes'}
        </Button>
      </DialogFooter>
    </>
  );
}
