import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { driversService, type DriverInput } from '@/services/drivers.service';
import { agenciesService } from '@/services/agencies.service';
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
import { DRIVER_STATUSES, DRIVER_STATUS_LABEL } from '@/lib/domain';
import type { Driver, DriverStatus } from '@/types';

const NONE = '__none__';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  agencyId: z.string(),
  licenseNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine(v => !v || v.trim() === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Enter a valid email'),
  status: z.enum(['active', 'inactive', 'on_leave']),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function DriverFormDialog({
  open,
  onOpenChange,
  driver,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver?: Driver | null;
}) {
  const queryClient = useQueryClient();
  const audit = useAuditLog();
  const { user } = useAuth();
  const isEdit = !!driver;

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
      name: '',
      agencyId: NONE,
      licenseNumber: '',
      phone: '',
      email: '',
      status: 'active',
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: driver?.name ?? '',
        agencyId: driver?.agencyId || NONE,
        licenseNumber: driver?.licenseNumber ?? '',
        phone: driver?.phone ?? '',
        email: driver?.email ?? '',
        status: (driver?.status as DriverStatus) ?? 'active',
        notes: driver?.notes ?? '',
      });
    }
  }, [open, driver, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: DriverInput = {
        name: values.name,
        agencyId: values.agencyId === NONE ? undefined : values.agencyId,
        licenseNumber: values.licenseNumber,
        phone: values.phone,
        email: values.email,
        status: values.status,
        notes: values.notes,
      };
      if (isEdit && driver) {
        await driversService.update(driver.id, payload, user?.uid);
        await audit('driver_update', `Updated driver ${values.name}`, driver.id);
        return;
      }
      const id = await driversService.create(payload, user?.uid);
      await audit('driver_create', `Created driver ${values.name}`, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['buses'] });
      toast.success(isEdit ? 'Driver updated' : 'Driver created');
      onOpenChange(false);
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Something went wrong'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit driver' : 'New driver'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this driver’s personnel record.'
              : 'Add a driver. Assign them to a bus from the row menu.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Full name" htmlFor="name" error={errors.name?.message}>
              <Input id="name" placeholder="Arben Krasniqi" {...register('name')} />
            </FormField>
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
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Licence number" htmlFor="licenseNumber">
              <Input id="licenseNumber" placeholder="KS-DL-99213" {...register('licenseNumber')} />
            </FormField>
            <FormField label="Status">
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DRIVER_STATUSES.map(s => (
                        <SelectItem key={s} value={s}>{DRIVER_STATUS_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Phone" htmlFor="phone">
              <Input id="phone" placeholder="+383 44 000 000" {...register('phone')} />
            </FormField>
            <FormField label="Email" htmlFor="email" error={errors.email?.message}>
              <Input id="email" placeholder="driver@agency.com" {...register('email')} />
            </FormField>
          </div>

          <FormField label="Notes" htmlFor="notes">
            <Textarea id="notes" rows={3} placeholder="Optional internal notes" {...register('notes')} />
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={mutation.isPending}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner className="size-4 text-primary-foreground" /> : isEdit ? 'Save changes' : 'Create driver'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
