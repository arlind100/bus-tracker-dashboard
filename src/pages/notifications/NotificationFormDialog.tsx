import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notificationsService, type NotificationInput } from '@/services/notifications.service';
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
import { NOTIFICATION_KINDS, NOTIFICATION_KIND_LABEL } from '@/lib/domain';
import type { Notification, NotificationKind } from '@/types';

const schema = z.object({
  kind: z.enum(['delay', 'arrive', 'update']),
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Message is required'),
});

type FormValues = z.infer<typeof schema>;

export function NotificationFormDialog({
  open,
  onOpenChange,
  notification,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification?: Notification | null;
}) {
  const queryClient = useQueryClient();
  const audit = useAuditLog();
  const isEdit = !!notification;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { kind: 'update', title: '', body: '' },
  });

  useEffect(() => {
    if (open) {
      reset({
        kind: (notification?.kind as NotificationKind) ?? 'update',
        title: notification?.title ?? '',
        body: notification?.body ?? '',
      });
    }
  }, [open, notification, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: NotificationInput = values;
      if (isEdit && notification) {
        await notificationsService.update(notification.id, payload);
        await audit('notification_update', `Edited alert "${values.title}"`, notification.id);
        return;
      }
      const id = await notificationsService.create(payload);
      await audit('notification_create', `Broadcast alert "${values.title}"`, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(isEdit ? 'Notification updated' : 'Notification broadcast');
      onOpenChange(false);
    },
    onError: err => toast.error(err instanceof Error ? err.message : 'Something went wrong'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit notification' : 'New notification'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update this service alert.' : 'Broadcast a service alert to all passengers.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="flex flex-col gap-4" noValidate>
          <FormField label="Type">
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_KINDS.map(k => (
                      <SelectItem key={k} value={k}>{NOTIFICATION_KIND_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField label="Title" htmlFor="title" required error={errors.title?.message}>
            <Input id="title" placeholder="Route 2 delayed" {...register('title')} />
          </FormField>

          <FormField label="Message" htmlFor="body" required error={errors.body?.message}>
            <Textarea id="body" rows={4} placeholder="Running ~5 min behind near Bit Pazar." {...register('body')} />
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={mutation.isPending}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner className="size-4 text-primary-foreground" /> : isEdit ? 'Save changes' : 'Broadcast'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
