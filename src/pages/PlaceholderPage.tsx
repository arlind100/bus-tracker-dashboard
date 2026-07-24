import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Temporary placeholder for management pages arriving in Phase 2. The service
 * layer backing each of these already exists (src/services/*) — only the UI is
 * pending, so wiring a real page in is incremental work.
 */
export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Construction className="size-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Coming in Phase 2</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              The data service for this section is already implemented. The
              management interface will be built next.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
