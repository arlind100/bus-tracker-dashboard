import { Badge } from '@/components/ui/badge';
import {
  ROUTE_STATUS_VARIANT,
  BUS_STATUS_VARIANT,
  DRIVER_STATUS_VARIANT,
  DRIVER_STATUS_LABEL,
  ISSUE_STATUS_VARIANT,
  NOTIFICATION_KIND_VARIANT,
  NOTIFICATION_KIND_LABEL,
} from '@/lib/domain';
import type {
  BusStatus,
  DriverStatus,
  IssueStatus,
  NotificationKind,
  RouteStatus,
} from '@/types';

export function RouteStatusBadge({ status }: { status?: RouteStatus }) {
  if (!status) return <Badge variant="neutral">Unknown</Badge>;
  return <Badge variant={ROUTE_STATUS_VARIANT[status]}>{status}</Badge>;
}

export function BusStatusBadge({ status }: { status?: BusStatus }) {
  if (!status) return <Badge variant="neutral">Unknown</Badge>;
  return <Badge variant={BUS_STATUS_VARIANT[status]}>{status}</Badge>;
}

export function DriverStatusBadge({ status }: { status?: DriverStatus }) {
  const s = status ?? 'active';
  return <Badge variant={DRIVER_STATUS_VARIANT[s]}>{DRIVER_STATUS_LABEL[s]}</Badge>;
}

export function IssueStatusBadge({ status }: { status?: IssueStatus }) {
  const s = status ?? 'new';
  return <Badge variant={ISSUE_STATUS_VARIANT[s]}>{s}</Badge>;
}

export function NotificationKindBadge({ kind }: { kind: NotificationKind }) {
  return <Badge variant={NOTIFICATION_KIND_VARIANT[kind]}>{NOTIFICATION_KIND_LABEL[kind]}</Badge>;
}

/** Active/inactive pill for agencies, admins, schedules. */
export function ActiveBadge({ active }: { active?: boolean }) {
  return active === false ? (
    <Badge variant="neutral">Inactive</Badge>
  ) : (
    <Badge variant="success">Active</Badge>
  );
}
