import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { agenciesService, type AgencyInput } from '@/services/agencies.service';
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
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { FormField } from '@/components/form/FormField';
import type { Agency } from '@/types';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Enter a valid email').or(z.literal('')).optional(),
  active: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function AgencyFormDialog({
  open,
  onOpenChange,
  agency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agency?: Agency | null;
}) {
  const queryClient = useQueryClient();
  const audit = useAuditLog();
  const { user } = useAuth();
  const isEdit = !!agency;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', city: '', phone: '', email: '', active: true },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: agency?.name ?? '',
        city: agency?.city ?? '',
        phone: agency?.phone ?? '',
        email: agency?.email ?? '',
        active: agency?.active ?? true,
      });
    }
  }, [open, agency, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: AgencyInput = values;
      if (isEdit && agency) {
        await agenciesService.update(agency.id, payload, user?.uid);
        await audit('agency_update', `Updated agency "${values.name}"`, agency.id);
        return agency.id;
      }
      const id = await agenciesService.create(payload, user?.uid);
      await audit('agency_create', `Created agency "${values.name}"`, id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agencies'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(isEdit ? 'Agency updated' : 'Agency created');
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    },
  });

  const active = watch('active');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit agency' : 'New agency'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update this transit operator’s details.' : 'Add a transit operator to the platform.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(values => mutation.mutate(values))}
          className="flex flex-col gap-4"
          noValidate
        >
          <FormField label="Name" htmlFor="name" required error={errors.name?.message}>
            <Input id="name" placeholder="JSP Skopje" {...register('name')} />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="City" htmlFor="city" error={errors.city?.message}>
              <Input id="city" placeholder="Skopje" {...register('city')} />
            </FormField>
            <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
              <Input id="phone" placeholder="+389 2 3117188" {...register('phone')} />
            </FormField>
          </div>

          <FormField label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" placeholder="info@agency.com" {...register('email')} />
          </FormField>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Inactive agencies are hidden from operations.</p>
            </div>
            <Switch checked={active} onCheckedChange={v => setValue('active', v)} />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={mutation.isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner className="size-4 text-primary-foreground" /> : isEdit ? 'Save changes' : 'Create agency'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
