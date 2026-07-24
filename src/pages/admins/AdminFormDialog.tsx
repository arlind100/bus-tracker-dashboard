import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import { adminsService } from '@/services/admins.service';
import { adminProvisioningService } from '@/services/adminProvisioning.service';
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

// Two ways to create an admin:
//   'create' — provision a new Firebase Auth account from here (the dashboard
//              creates it on an isolated app instance, so this session stays)
//   'link'   — attach an admin record to an Auth uid that already exists

const schema = z
  .object({
    mode: z.enum(['create', 'link']),
    uid: z.string().optional(),
    email: z.string().email('Enter a valid email').or(z.literal('')).optional(),
    password: z.string().optional(),
    displayName: z.string().optional(),
    agencyId: z.string(),
    active: z.boolean(),
    superAdmin: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'link' && !v.uid?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['uid'], message: 'Firebase Auth UID is required' });
    }
    if (v.mode === 'create') {
      if (!v.email?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['email'], message: 'Email is required for a new account' });
      }
      if (!v.password || v.password.length < 8) {
        ctx.addIssue({ code: 'custom', path: ['password'], message: 'Use at least 8 characters' });
      }
    }
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
    defaultValues: { mode: 'create', uid: '', email: '', password: '', displayName: '', agencyId: NO_AGENCY, active: true, superAdmin: false },
  });

  useEffect(() => {
    if (open) {
      reset({
        mode: admin ? 'link' : 'create',
        uid: admin?.uid ?? '',
        email: admin?.email ?? '',
        password: '',
        displayName: admin?.displayName ?? '',
        agencyId: admin?.agencyId || NO_AGENCY,
        active: admin?.active ?? true,
        superAdmin: admin?.superAdmin ?? false,
      });
    }
  }, [open, admin, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // Creating an Auth account first, so the admin record is always written
      // against a uid that really exists.
      let uid = values.uid?.trim() ?? '';
      let provisioned = false;
      if (!isEdit && values.mode === 'create') {
        uid = await adminProvisioningService.createAuthAccount({
          email: values.email!.trim(),
          password: values.password!,
          displayName: values.displayName?.trim(),
        });
        provisioned = true;
      }

      await adminsService.upsert({
        uid,
        email: values.email || undefined,
        displayName: values.displayName || undefined,
        agencyId: values.agencyId === NO_AGENCY ? '' : values.agencyId,
        active: values.active,
        superAdmin: values.superAdmin,
        createdBy: user?.uid,
      });

      await audit(
        isEdit ? 'admin_update' : 'admin_create',
        `${isEdit ? 'Updated' : 'Created'} admin ${values.email || uid}`,
        uid,
      );
      return { provisioned, email: values.email ?? '' };
    },
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      toast.success(
        result.provisioned
          ? 'Administrator created — they can sign in with the password you set.'
          : isEdit
            ? 'Administrator updated'
            : 'Administrator created',
      );
      onOpenChange(false);
    },
    onError: err => toast.error(describeFirebaseError(err, 'admins')),
  });

  const sendReset = useMutation({
    mutationFn: (email: string) => adminProvisioningService.sendPasswordSetupEmail(email),
    onSuccess: () => toast.success('Password reset email sent'),
    onError: err => toast.error(describeFirebaseError(err, 'admins')),
  });

  const mode = watch('mode');
  const emailValue = watch('email');
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
          {!isEdit && (
            <div className="flex gap-2 rounded-lg border border-border p-1">
              {(['create', 'link'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setValue('mode', m)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {m === 'create' ? 'Create new account' : 'Link existing UID'}
                </button>
              ))}
            </div>
          )}

          {(isEdit || mode === 'link') && (
            <FormField
              label="Firebase Auth UID"
              htmlFor="uid"
              required
              error={errors.uid?.message}
              hint={isEdit ? undefined : "The uid of an account that already exists in Firebase Authentication."}
            >
              <Input id="uid" placeholder="e.g. 8xK2…f9" disabled={isEdit} {...register('uid')} />
            </FormField>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Email" htmlFor="email" required={!isEdit && mode === 'create'} error={errors.email?.message}>
              <Input id="email" type="email" placeholder="admin@agency.com" {...register('email')} />
            </FormField>
            <FormField label="Display name" htmlFor="displayName" error={errors.displayName?.message}>
              <Input id="displayName" placeholder="Jane Doe" {...register('displayName')} />
            </FormField>
          </div>

          {!isEdit && mode === 'create' && (
            <FormField
              label="Temporary password"
              htmlFor="password"
              required
              error={errors.password?.message}
              hint="The new admin signs in with this, then changes it. Minimum 8 characters."
            >
              <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••" {...register('password')} />
            </FormField>
          )}

          {isEdit && !!emailValue && (
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Password</p>
                <p className="text-xs text-muted-foreground">Email this admin a link to set a new password.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sendReset.isPending}
                onClick={() => sendReset.mutate(emailValue)}
              >
                {sendReset.isPending ? <Spinner className="size-4" /> : 'Send reset email'}
              </Button>
            </div>
          )}

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
              Only super admins can write the <code>admins</code> registry — enforced by Firestore rules,
              not just this UI. Deactivating revokes access everywhere immediately; the Firebase Auth
              account itself can only be deleted from the Firebase Console.
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
