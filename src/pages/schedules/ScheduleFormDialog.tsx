import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { schedulesService, type ScheduleInput } from '@/services/schedules.service';
import { routesService } from '@/services/routes.service';
import { useAuditLog } from '@/hooks/useAuditLog';
import { describeFirebaseError } from '@/lib/errors';
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
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { FormField } from '@/components/form/FormField';
import { DAY_TYPES, DAY_TYPE_LABEL } from '@/lib/domain';
import type { Schedule, DayType } from '@/types';

const schema = z
  .object({
    routeId: z.string().min(1, 'Route is required'),
    dayType: z.enum(['weekday', 'weekend']),
    departureTime: z.string().min(1, 'Required'),
    arrivalTime: z.string().min(1, 'Required'),
    isActive: z.boolean(),
  });

type FormValues = z.infer<typeof schema>;

export function ScheduleFormDialog({
  open,
  onOpenChange,
  schedule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: Schedule | null;
}) {
  const queryClient = useQueryClient();
  const audit = useAuditLog();
  const isEdit = !!schedule;

  const { data: routes } = useQuery({ queryKey: ['routes'], queryFn: () => routesService.list(), enabled: open });

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { routeId: '', dayType: 'weekday', departureTime: '', arrivalTime: '', isActive: true },
  });

  useEffect(() => {
    if (open) {
      reset({
        routeId: schedule?.routeId ?? '',
        dayType: (schedule?.dayType as DayType) ?? 'weekday',
        departureTime: schedule?.departureTime ?? '',
        arrivalTime: schedule?.arrivalTime ?? '',
        isActive: schedule?.isActive ?? true,
      });
    }
  }, [open, schedule, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: ScheduleInput = values;
      if (isEdit && schedule) {
        await schedulesService.update(schedule.id, payload);
        await audit('schedule_update', `Updated schedule for route ${values.routeId}`, schedule.id);
        return;
      }
      const id = await schedulesService.create(payload);
      await audit('schedule_create', `Created schedule for route ${values.routeId}`, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success(isEdit ? 'Schedule updated' : 'Schedule created');
      onOpenChange(false);
    },
    onError: err => toast.error(describeFirebaseError(err, 'schedules')),
  });

  const isActive = watch('isActive');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit schedule' : 'New schedule'}</DialogTitle>
          <DialogDescription>Timetable row for a route and day type.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="flex flex-col gap-4" noValidate>
          <FormField label="Route" required error={errors.routeId?.message}>
            <Controller
              control={control}
              name="routeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select a route" /></SelectTrigger>
                  <SelectContent>
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

          <FormField label="Day type">
            <Controller
              control={control}
              name="dayType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAY_TYPES.map(d => <SelectItem key={d} value={d}>{DAY_TYPE_LABEL[d]}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Departure" htmlFor="departureTime" required error={errors.departureTime?.message}>
              <Input id="departureTime" type="time" {...register('departureTime')} />
            </FormField>
            <FormField label="Arrival" htmlFor="arrivalTime" required error={errors.arrivalTime?.message}>
              <Input id="arrivalTime" type="time" {...register('arrivalTime')} />
            </FormField>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <p className="text-sm font-medium">Active</p>
            <Switch checked={isActive} onCheckedChange={v => setValue('isActive', v)} />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={mutation.isPending}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner className="size-4 text-primary-foreground" /> : isEdit ? 'Save changes' : 'Create schedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
