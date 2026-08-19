import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { busesService, type BusInput } from '@/services/buses.service';
import { useAgencyScope } from '@/hooks/useAgencyScope';
import { routesService } from '@/services/routes.service';
import { driversService } from '@/services/drivers.service';
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

const schema = z
  .object({
    agencyId: z.string(),
    routeId: z.string(),
    plate: z.string().optional(),
    busNumber: z.string().optional(),
    driverId: z.string(),
    status: z.enum(['Active', 'Offline', 'Maintenance']),
    capacity: z
      .string()
      .optional()
      .refine(v => v == null || v.trim() === '' || Number.isFinite(Number(v)), 'Must be a number'),
  })
  .refine(v => !!v.busNumber?.trim() || !!v.plate?.trim(), {
    message: 'Enter a bus number or a plate.',
    path: ['busNumber'],
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
  const { user } = useAuth();
  const isEdit = !!bus;

  const { options: agencies, locked: agencyLocked, defaultAgencyId } = useAgencyScope(open);
  const { data: routes } = useQuery({ queryKey: ['routes'], queryFn: () => routesService.list(), enabled: open });
  const { data: driversData } = useQuery({ queryKey: ['drivers', user?.agencyId ?? 'all'], queryFn: () => driversService.list(user?.agencyId), enabled: open });
  const drivers = driversData?.drivers ?? [];

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { agencyId: NONE, routeId: NONE, plate: '', busNumber: '', driverId: NONE, status: 'Offline', capacity: '' },
  });

  useEffect(() => {
    if (open) {
      reset({
        agencyId: bus?.agencyId || defaultAgencyId || NONE,
        routeId: bus?.routeId || NONE,
        plate: bus?.plate ?? '',
        busNumber: bus?.busNumber ?? '',
        driverId: bus?.driverId || NONE,
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
        status: values.status,
        capacity: values.capacity?.trim() ? Number(values.capacity) : undefined,
      };

      const selectedDriverId = values.driverId === NONE ? null : values.driverId;
      const busId = isEdit && bus ? bus.id : await busesService.create(payload, user?.uid);

      if (isEdit && bus) {
        await busesService.update(bus.id, payload, user?.uid);
        await audit('bus_update', `Updated bus ${values.busNumber || bus.id}`, bus.id);
      } else {
        await audit('bus_create', `Created bus ${values.busNumber || busId}`, busId);
      }

      const previousDriverId = bus?.driverId || null;
      if (selectedDriverId !== previousDriverId) {
        if (selectedDriverId) {
          await driversService.assignToBus(selectedDriverId, busId, user?.uid);
        } else if (previousDriverId) {
          await driversService.assignToBus(previousDriverId, null, user?.uid);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buses'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
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
            <FormField label="Bus number" htmlFor="busNumber" error={errors.busNumber?.message}>
              <Input id="busNumber" placeholder="Bus 01" {...register('busNumber')} />
            </FormField>
            <FormField label="Plate" htmlFor="plate" error={errors.plate?.message}>
              <Input id="plate" placeholder="SK-1234-AB" {...register('plate')} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Agency">
              <Controller
                control={control}
                name="agencyId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={agencyLocked}>
                    <SelectTrigger><SelectValue placeholder="No agency" /></SelectTrigger>
                    <SelectContent>
                      {!agencyLocked && <SelectItem value={NONE}>No agency</SelectItem>}
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
            <FormField
              label="Driver"
              hint={
                !bus?.driverId && bus?.driver ? `Currently: ${bus.driver}` : undefined
              }
            >
              <Controller
                control={control}
                name="driverId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="No driver" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No driver</SelectItem>
                      {drivers.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
