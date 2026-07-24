import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { busesService, type BusInput } from '@/services/buses.service';
import { agenciesService } from '@/services/agencies.service';
import { routesService } from '@/services/routes.service';
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
import type { Bus, BusStatus } from '@/types';

const NONE = '__none__';

const schema = z.object({
  agencyId: z.string(),
  routeId: z.string(),
  plate: z.string().optional(),
  busNumber: z.string().optional(),
  driver: z.string().optional(),
  status: z.enum(['Active', 'Offline', 'Maintenance']),
  capacity: z
    .string()
    .optional()
    .refine(v => v == null || v.trim() === '' || Number.isFinite(Number(v)), 'Must be a number'),
});

type FormValues = z.infer<typeof schema>;

export function BusFormDialog({
  open,
  onOpenChange,
  bus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bus?: Bus | null;
}) {
  const queryClient = useQueryClient();
  const audit = useAuditLog();
  const isEdit = !!bus;

  const { data: agencies } = useQuery({ queryKey: ['agencies'], queryFn: () => agenciesService.list(), enabled: open });
  const { data: routes } = useQuery({ queryKey: ['routes'], queryFn: () => routesService.list(), enabled: open });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { agencyId: NONE, routeId: NONE, plate: '', busNumber: '', driver: '', status: 'Offline', capacity: '' },
  });

  useEffect(() => {
    if (open) {
      reset({
        agencyId: bus?.agencyId || NONE,
        routeId: bus?.routeId || NONE,
        plate: bus?.plate ?? '',
        busNumber: bus?.busNumber ?? '',
        driver: bus?.driver ?? '',
        status: (bus?.status as BusStatus) ?? 'Offline',
        capacity: bus?.capacity != null ? String(bus.capacity) : '',
      });
    }
  }, [open, bus, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: BusInput = {
        agencyId: values.agencyId === NONE ? undefined : values.agencyId,
        routeId: values.routeId === NONE ? undefined : values.routeId,
        plate: values.plate,
        busNumber: values.busNumber,
        driver: values.driver,
        status: values.status,
        capacity: values.capacity?.trim() ? Number(values.capacity) : undefined,
      };
      if (isEdit && bus) {
        await busesService.update(bus.id, payload);
        await audit('bus_update', `Updated bus ${values.busNumber || bus.id}`, bus.id);
        return;
      }
      const id = await busesService.create(payload);
      await audit('bus_create', `Created bus ${values.busNumber || id}`, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buses'] });
      queryClient.invalidateQueries({ queryKey: ['live-data'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(isEdit ? 'Bus updated' : 'Bus created');
      onOpenChange(false);
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Something went wrong'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit bus' : 'New bus'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update this vehicle’s details.' : 'Add a vehicle to the fleet.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Bus number" htmlFor="busNumber">
              <Input id="busNumber" placeholder="Bus 01" {...register('busNumber')} />
            </FormField>
            <FormField label="Plate" htmlFor="plate">
              <Input id="plate" placeholder="SK-1234-AB" {...register('plate')} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Agency">
              <Controller
                control={control}
                name="agencyId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="No agency" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No agency</SelectItem>
                      {agencies?.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Route">
              <Controller
                control={control}
                name="routeId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="No route" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No route</SelectItem>
                      {routes?.map(r => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.routeNumber ? `${r.routeNumber} · ` : ''}{r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Driver" htmlFor="driver">
              <Input id="driver" placeholder="Full name" {...register('driver')} />
            </FormField>
            <FormField label="Status">
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BUS_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Capacity" htmlFor="capacity" error={errors.capacity?.message}>
              <Input id="capacity" type="number" min={0} placeholder="80" {...register('capacity')} />
            </FormField>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={mutation.isPending}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner className="size-4 text-primary-foreground" /> : isEdit ? 'Save changes' : 'Create bus'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
