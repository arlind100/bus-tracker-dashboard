import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import { adminsService } from '@/services/admins.service';
import { agenciesService } from '@/services/agencies.service';
import { useAuth } from '@/hooks/useAuth';
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
import type { AdminRecord } from '@/types';

const NO_AGENCY = '__none__';

const schema = z.object({
  uid: z.string().min(1, 'Firebase Auth UID is required'),
  email: z.string().email('Enter a valid email').or(z.literal('')).optional(),
  displayName: z.string().optional(),
  agencyId: z.string(),
  active: z.boolean(),
  superAdmin: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function AdminFormDialog({
  open,
  onOpenChange,
  admin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admin?: AdminRecord | null;
}) {
  const queryClient = useQueryClient();
  const audit = useAuditLog();
  const { user } = useAuth();
  const isEdit = !!admin;

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
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { uid: '', email: '', displayName: '', agencyId: NO_AGENCY, active: true, superAdmin: false },
  });

  useEffect(() => {
    if (open) {
      reset({
        uid: admin?.uid ?? '',
        email: admin?.email ?? '',
        displayName: admin?.displayName ?? '',
        agencyId: admin?.agencyId || NO_AGENCY,
        active: admin?.active ?? true,
        superAdmin: admin?.superAdmin ?? false,
      });
    }
  }, [open, admin, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      await adminsService.upsert({
        uid: values.uid.trim(),
        email: values.email || undefined,
        displayName: values.displayName || undefined,
        agencyId: values.agencyId === NO_AGENCY ? undefined : values.agencyId,
        active: values.active,
        superAdmin: values.superAdmin,
        createdBy: user?.uid,
      });
      await audit(
        isEdit ? 'admin_update' : 'admin_create',
        `${isEdit ? 'Updated' : 'Created'} admin ${values.email || values.uid}`,
        values.uid.trim(),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      toast.success(isEdit ? 'Administrator updated' : 'Administrator created');
      onOpenChange(false);
    },
    onError: err => toast.error(describeFirebaseError(err, 'admins')),
  });

  const active = watch('active');
  const superAdmin = watch('superAdmin');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit administrator' : 'New administrator'}</DialogTitle>
          <DialogDescription>
            The document keeps <code className="text-xs">role: "admin"</code> for mobile compatibility.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="flex flex-col gap-4" noValidate>
          <FormField
            label="Firebase Auth UID"
            htmlFor="uid"
            required
            error={errors.uid?.message}
            hint={isEdit ? undefined : 'Create the Auth user in Firebase Console first, then paste their UID here.'}
          >
            <Input id="uid" placeholder="e.g. 8xK2…f9" disabled={isEdit} {...register('uid')} />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Email" htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" placeholder="admin@agency.com" {...register('email')} />
            </FormField>
            <FormField label="Display name" htmlFor="displayName" error={errors.displayName?.message}>
              <Input id="displayName" placeholder="Jane Doe" {...register('displayName')} />
            </FormField>
          </div>

          <FormField label="Agency" hint="Scope this admin to an agency (foundation for the company-admin tier).">
            <Controller
              control={control}
              name="agencyId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="No agency (global)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_AGENCY}>No agency (global)</SelectItem>
                    {agencies?.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Deactivating locks the admin out of both apps.</p>
            </div>
            <Switch checked={active} onCheckedChange={v => setValue('active', v)} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Super Admin</p>
              <p className="text-xs text-muted-foreground">Full platform access, including admin management.</p>
            </div>
            <Switch checked={superAdmin} onCheckedChange={v => setValue('superAdmin', v)} />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-accent/60 px-3 py-2.5 text-xs text-accent-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Writing to the <code>admins</code> collection requires the proposed super-admin Firestore rule
              to be deployed. See <code>docs/PROPOSED_FIRESTORE_RULES.md</code>.
            </span>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={mutation.isPending}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner className="size-4 text-primary-foreground" /> : isEdit ? 'Save changes' : 'Create administrator'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
