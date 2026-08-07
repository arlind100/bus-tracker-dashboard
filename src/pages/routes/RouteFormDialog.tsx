import { useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { routesService, type RouteInput, type StopSeed } from '@/services/routes.service';
import { agenciesService } from '@/services/agencies.service';
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
import { ROUTE_STATUSES } from '@/lib/domain';
import type { Route, RouteStatus } from '@/types';

const NO_AGENCY = '__none__';

const schema = z.object({
  agencyId: z.string(),
  routeNumber: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  from: z.string().optional(),
  to: z.string().optional(),
  city: z.string().optional(),
  color: z.string().optional(),
  status: z.enum(['On time', 'Delayed', 'Offline']),
  freq: z.string().optional(),
  duration: z.string().optional(),
  stops: z.array(
    z.object({
      name: z.string().min(1, 'Required'),
      lat: z.string().optional(),
      lng: z.string().optional(),
    }),
  ),
});

type FormValues = z.infer<typeof schema>;

function parseCoord(v?: string): number | undefined {
  if (v == null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function RouteFormDialog({
  open,
  onOpenChange,
  route,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route?: Route | null;
}) {
  const queryClient = useQueryClient();
  const audit = useAuditLog();
  const { user } = useAuth();
  const isEdit = !!route;

  const { data: agencies } = useQuery({
    queryKey: ['agencies'],
    queryFn: () => agenciesService.list(),
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
    defaultValues: {
      agencyId: NO_AGENCY,
      routeNumber: '',
      name: '',
      from: '',
      to: '',
      city: '',
      color: '#2563eb',
      status: 'On time',
      freq: '',
      duration: '',
      stops: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'stops' });

  useEffect(() => {
    if (open) {
      reset({
        agencyId: route?.agencyId || NO_AGENCY,
        routeNumber: route?.routeNumber ?? '',
        name: route?.name ?? '',
        from: route?.from ?? '',
        to: route?.to ?? '',
        city: route?.city ?? '',
        color: route?.color ?? '#2563eb',
        status: (route?.status as RouteStatus) ?? 'On time',
        freq: route?.freq ?? '',
        duration: route?.duration ?? '',
        stops: (route?.stops ?? []).map(name => ({ name, lat: '', lng: '' })),
      });
    }
  }, [open, route, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const base: RouteInput = {
        agencyId: values.agencyId === NO_AGENCY ? undefined : values.agencyId,
        routeNumber: values.routeNumber,
        name: values.name,
        from: values.from,
        to: values.to,
        city: values.city,
        color: values.color,
        status: values.status,
        freq: values.freq,
        duration: values.duration,
        stops: values.stops.map(s => s.name.trim()),
      };

      if (isEdit && route) {
        await routesService.update(route.id, base, user?.uid);
        await audit('route_update', `Updated route "${values.name}"`, route.id);
        return route.id;
      }

      // If every stop has valid coordinates, create the route AND stop docs
      // atomically (mirrors the mobile createRouteWithStops). Otherwise create
      // the route with its stop-name array only.
      const seeds: StopSeed[] = [];
      let allHaveCoords = values.stops.length > 0;
      for (const s of values.stops) {
        const lat = parseCoord(s.lat);
        const lng = parseCoord(s.lng);
        if (lat === undefined || lng === undefined) { allHaveCoords = false; break; }
        seeds.push({ name: s.name.trim(), lat, lng });
      }

      if (allHaveCoords && seeds.length > 0) {
        const { routeId } = await routesService.createWithStops(
          { ...base, stopSeeds: seeds },
          user?.uid,
        );
        await audit('route_create', `Created route "${values.name}" with ${seeds.length} stops`, routeId);
        return routeId;
      }
      const id = await routesService.create(base, user?.uid);
      await audit('route_create', `Created route "${values.name}"`, id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['stops'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(isEdit ? 'Route updated' : 'Route created');
      onOpenChange(false);
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Something went wrong'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit route' : 'New route'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update route details. Stops with coordinates are managed on the Stops page.'
              : 'Define a route. Add coordinates to every stop to also create stop records atomically.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Agency">
              <Controller
                control={control}
                name="agencyId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="No agency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_AGENCY}>No agency</SelectItem>
                      {agencies?.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Route number" htmlFor="routeNumber">
              <Input id="routeNumber" placeholder="2, T1…" {...register('routeNumber')} />
            </FormField>
          </div>

          <FormField label="Name" htmlFor="name" required error={errors.name?.message}>
            <Input id="name" placeholder="Avtokomanda - Saraj" {...register('name')} />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="From" htmlFor="from">
              <Input id="from" placeholder="Avtokomanda" {...register('from')} />
            </FormField>
            <FormField label="To" htmlFor="to">
              <Input id="to" placeholder="Saraj" {...register('to')} />
            </FormField>
            <FormField label="City" htmlFor="city">
              <Input id="city" placeholder="Skopje" {...register('city')} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Status">
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROUTE_STATUSES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Frequency" htmlFor="freq">
              <Input id="freq" placeholder="Every 15 min" {...register('freq')} />
            </FormField>
            <FormField label="Duration" htmlFor="duration">
              <Input id="duration" placeholder="25 min" {...register('duration')} />
            </FormField>
          </div>

          <FormField label="Color">
            <Controller
              control={control}
              name="color"
              render={({ field }) => (
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={field.value || '#2563eb'}
                    onChange={field.onChange}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-input bg-card p-1"
                  />
                  <Input value={field.value ?? ''} onChange={field.onChange} className="max-w-[140px]" />
                </div>
              )}
            />
          </FormField>

          {/* Stops editor */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Stops <span className="text-muted-foreground">(in order)</span></p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ name: '', lat: '', lng: '' })}
              >
                <Plus className="size-4" />
                Add stop
              </Button>
            </div>
            {fields.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                No stops added. Add coordinates to every stop to create stop records automatically.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {fields.map((f, i) => (
                  <div key={f.id} className="flex items-center gap-2">
                    <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                    <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">{i + 1}</span>
                    <Input
                      placeholder="Stop name"
                      className="flex-1"
                      {...register(`stops.${i}.name`)}
                    />
                    <Input placeholder="lat" className="w-24" {...register(`stops.${i}.lat`)} />
                    <Input placeholder="lng" className="w-24" {...register(`stops.${i}.lng`)} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remove stop">
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={mutation.isPending}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner className="size-4 text-primary-foreground" /> : isEdit ? 'Save changes' : 'Create route'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
