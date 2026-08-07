import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { stopsService, type StopInput } from '@/services/stops.service';
import { routesService } from '@/services/routes.service';
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
import type { Stop } from '@/types';

const NO_ROUTE = '__none__';

const numeric = z
  .string()
  .optional()
  .refine(v => v == null || v.trim() === '' || Number.isFinite(Number(v)), 'Must be a number');

const schema = z.object({
  routeId: z.string(),
  name: z.string().min(1, 'Name is required'),
  order: z.string().optional(),
  city: z.string().optional(),
  lat: numeric,
  lng: numeric,
});

type FormValues = z.infer<typeof schema>;

export function StopFormDialog({
  open,
  onOpenChange,
  stop,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stop?: Stop | null;
}) {
  const queryClient = useQueryClient();
  const audit = useAuditLog();
  const { user } = useAuth();
  const isEdit = !!stop;

  const { data: routes } = useQuery({
    queryKey: ['routes'],
    queryFn: () => routesService.list(),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { routeId: NO_ROUTE, name: '', order: '', city: '', lat: '', lng: '' },
  });

  useEffect(() => {
    if (open) {
      reset({
        routeId: stop?.routeId || NO_ROUTE,
        name: stop?.name ?? '',
        order: stop?.order != null ? String(stop.order) : '',
        city: stop?.city ?? '',
        lat: stop?.lat != null ? String(stop.lat) : '',
        lng: stop?.lng != null ? String(stop.lng) : '',
      });
    }
  }, [open, stop, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: StopInput = {
        routeId: values.routeId === NO_ROUTE ? undefined : values.routeId,
        name: values.name,
        order: values.order?.trim() ? Number(values.order) : undefined,
        city: values.city,
        lat: values.lat?.trim() ? Number(values.lat) : undefined,
        lng: values.lng?.trim() ? Number(values.lng) : undefined,
      };
      if (isEdit && stop) {
        await stopsService.update(stop.id, payload, user?.uid);
        await audit('stop_update', `Updated stop "${values.name}"`, stop.id);
        return;
      }
      const id = await stopsService.create(payload, user?.uid);
      await audit('stop_create', `Created stop "${values.name}"`, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stops'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(isEdit ? 'Stop updated' : 'Stop created');
      onOpenChange(false);
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Something went wrong'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit stop' : 'New stop'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update this stop’s details.' : 'Add a stop and link it to a route.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="flex flex-col gap-4" noValidate>
          <FormField label="Route">
            <Controller
              control={control}
              name="routeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="No route" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ROUTE}>No route</SelectItem>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor="name" required error={errors.name?.message}>
              <Input id="name" placeholder="Bit Pazar" {...register('name')} />
            </FormField>
            <FormField label="Order" htmlFor="order" hint="Position along the route">
              <Input id="order" type="number" min={1} placeholder="1" {...register('order')} />
            </FormField>
          </div>

          <FormField label="City" htmlFor="city">
            <Input id="city" placeholder="Skopje" {...register('city')} />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Latitude" htmlFor="lat" error={errors.lat?.message}>
              <Input id="lat" placeholder="41.9981" {...register('lat')} />
            </FormField>
            <FormField label="Longitude" htmlFor="lng" error={errors.lng?.message}>
              <Input id="lng" placeholder="21.4702" {...register('lng')} />
            </FormField>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={mutation.isPending}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner className="size-4 text-primary-foreground" /> : isEdit ? 'Save changes' : 'Create stop'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
