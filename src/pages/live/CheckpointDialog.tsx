import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import { liveService } from '@/services/live.service';
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
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { FormField } from '@/components/form/FormField';
import { BUS_STATUSES } from '@/lib/domain';
import type { Bus, BusLocation, Route } from '@/types';

const KEEP = '__keep__';

export function CheckpointDialog({
  open,
  onOpenChange,
  bus,
  route,
  location,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bus: Bus | null;
  route: Route | null;
  location: BusLocation | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {bus && (
          <CheckpointForm
            key={bus.id}
            bus={bus}
            route={route}
            location={location}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// State is seeded from props via useState initializers and the form is keyed by
// bus id, so it resets cleanly on each open without a state-syncing effect.
function CheckpointForm({
  bus,
  route,
  location,
  onOpenChange,
}: {
  bus: Bus;
  route: Route | null;
  location: BusLocation | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const audit = useAuditLog();

  const [status, setStatus] = useState<string>(location?.status || bus.status || KEEP);
  const [currentStop, setCurrentStop] = useState(location?.currentStop || bus.currentStop || '');
  const [nextStop, setNextStop] = useState(location?.nextStop || bus.nextStop || '');
  const [progress, setProgress] = useState(
    Math.round((location?.progress ?? bus.progress ?? 0) * 100),
  );

  const stopOptions = route?.stops ?? [];

  const mutation = useMutation({
    mutationFn: async () => {
      await liveService.updateBusLocation(bus.id, {
        status: status === KEEP ? undefined : status,
        currentStop: currentStop || undefined,
        nextStop: nextStop || undefined,
        progress: progress / 100,
      });
      await audit('checkpoint_update', `Updated live checkpoint for bus ${bus.busNumber || bus.id}`, bus.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-data'] });
      toast.success('Checkpoint updated');
      onOpenChange(false);
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Update failed'),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Update checkpoint</DialogTitle>
        <DialogDescription>
          {bus.busNumber || bus.id} — set the current live position manually.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
          <FormField label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Keep current</SelectItem>
                {BUS_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Current stop">
              {stopOptions.length > 0 ? (
                <Select value={currentStop || KEEP} onValueChange={v => setCurrentStop(v === KEEP ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select stop" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={KEEP}>—</SelectItem>
                    {stopOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={currentStop} onChange={e => setCurrentStop(e.target.value)} placeholder="Current stop" />
              )}
            </FormField>
            <FormField label="Next stop">
              {stopOptions.length > 0 ? (
                <Select value={nextStop || KEEP} onValueChange={v => setNextStop(v === KEEP ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select stop" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={KEEP}>—</SelectItem>
                    {stopOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={nextStop} onChange={e => setNextStop(e.target.value)} placeholder="Next stop" />
              )}
            </FormField>
          </div>

          <FormField label={`Progress to next stop — ${progress}%`}>
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={e => setProgress(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </FormField>

          <div className="flex items-start gap-2 rounded-lg bg-accent/60 px-3 py-2.5 text-xs text-accent-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              This writes a single checkpoint. The passenger app animates between checkpoints — never
              update on a fast interval.
            </span>
          </div>
        </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={mutation.isPending}>Cancel</Button>
        </DialogClose>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner className="size-4 text-primary-foreground" /> : 'Save checkpoint'}
        </Button>
      </DialogFooter>
    </>
  );
}
