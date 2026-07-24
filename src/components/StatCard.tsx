import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
}) {
  const toneClass = {
    default: 'bg-accent text-accent-foreground',
    success: 'bg-success/12 text-success',
    warning: 'bg-warning/12 text-warning',
    destructive: 'bg-destructive/12 text-destructive',
  }[tone];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
          {sublabel && (
            <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
          )}
        </div>
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', toneClass)}>
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}
