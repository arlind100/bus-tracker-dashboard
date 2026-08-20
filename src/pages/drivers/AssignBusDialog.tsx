import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAgencyFilter } from '@/hooks/useAgencyFilter';
import { toast } from 'sonner';
import { driversService } from '@/services/drivers.service';
import { busesService } from '@/services/buses.service';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAuth } from '@/hooks/useAuth';
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
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { FormField } from '@/components/form/FormField';
import type { Driver } from '@/types';

const UNASSIGNED = '__unassigned__';

export function AssignBusDialog({
  open,
  onOpenChange,
  driver,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: Driver | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {driver && <AssignBusForm key={driver.id} driver={driver} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function AssignBusForm({ driver, onDone }: { driver: Driver; onDone: () => void }) {
  const queryClient = useQueryClient();
  const audit = useAuditLog();
  const { user } = useAuth();
  const [busId, setBusId] = useState<string>(driver.assignedBusId || UNASSIGNED);

  const { scopeAgencyId, scopeKey } = useAgencyFilter();
  const { data } = useQuery({ queryKey: ['buses', scopeKey], queryFn: () => busesService.list(scopeAgencyId) });
  const buses = data?.buses ?? [];

  const mutation = useMutation({
    mutationFn: async () => {
      const target = busId === UNASSIGNED ? null : busId;
      await driversService.assignToBus(driver.id, target, user?.uid);
      const label = target
        ? buses.find(b => b.id === target)?.busNumber || target
        : 'no bus';
      await audit('driver_assign', `Assigned ${driver.name} to ${label}`, driver.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['buses'] });
      queryClient.invalidateQueries({ queryKey: ['live-data'] });
      toast.success('Assignment updated');
      onDone();
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Assignment failed'),
  });

  return (
    <>
        <DialogHeader>
          <DialogTitle>Assign bus</DialogTitle>
          <DialogDescription>
            Choose the vehicle {driver.name} currently drives. A bus holds one
            driver — assigning here releases any previous pairing.
          </DialogDescription>
        </DialogHeader>

        <FormField label="Bus">
          <Select value={busId} onValueChange={setBusId}>
            <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {buses.map(b => (
                <SelectItem key={b.id} value={b.id}>
                  {b.busNumber || b.id}{b.plate ? ` · ${b.plate}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={mutation.isPending}>Cancel</Button>
          </DialogClose>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner className="size-4 text-primary-foreground" /> : 'Save assignment'}
          </Button>
        </DialogFooter>
    </>
  );
}
