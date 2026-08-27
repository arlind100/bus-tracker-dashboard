// Labels, badge variants and chart colors for the domain enums, so every page
// renders a status identically.

import type { BadgeProps } from '@/components/ui/badge';
import type {
  BusStatus,
  DriverStatus,
  IssueKind,
  IssueStatus,
  NotificationKind,
  RouteStatus,
  DayType,
} from '@/types';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

export const ROUTE_STATUSES: RouteStatus[] = ['On time', 'Delayed', 'Offline'];
export const ROUTE_STATUS_VARIANT: Record<RouteStatus, BadgeVariant> = {
  'On time': 'success',
  Delayed: 'warning',
  Offline: 'destructive',
};
export const ROUTE_STATUS_COLOR: Record<RouteStatus, string> = {
  'On time': '#16a34a',
  Delayed: '#f59e0b',
  Offline: '#dc2626',
};

export const BUS_STATUSES: BusStatus[] = ['Active', 'Offline', 'Maintenance'];
export const BUS_STATUS_VARIANT: Record<BusStatus, BadgeVariant> = {
  Active: 'success',
  Offline: 'neutral',
  Maintenance: 'warning',
};

export const DRIVER_STATUSES: DriverStatus[] = ['active', 'inactive', 'on_leave'];
export const DRIVER_STATUS_LABEL: Record<DriverStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  on_leave: 'On leave',
};
export const DRIVER_STATUS_VARIANT: Record<DriverStatus, BadgeVariant> = {
  active: 'success',
  inactive: 'neutral',
  on_leave: 'warning',
};

export const ISSUE_STATUSES: IssueStatus[] = [
  'new',
  'open',
  'pending',
  'reviewing',
  'resolved',
  'closed',
];
export const ISSUE_STATUS_VARIANT: Record<IssueStatus, BadgeVariant> = {
  new: 'default',
  open: 'warning',
  pending: 'warning',
  reviewing: 'default',
  resolved: 'success',
  closed: 'neutral',
};

export const ISSUE_KINDS: IssueKind[] = [
  'wrong_location',
  'wrong_eta',
  'missing_route',
  'app_bug',
  'other',
];
export const ISSUE_KIND_LABEL: Record<IssueKind, string> = {
  wrong_location: 'Wrong location',
  wrong_eta: 'Wrong ETA',
  missing_route: 'Missing route',
  app_bug: 'App bug',
  other: 'Other',
};

export const NOTIFICATION_KINDS: NotificationKind[] = ['delay', 'arrive', 'update'];
export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, string> = {
  delay: 'Delay',
  arrive: 'Arrival',
  update: 'Update',
};
export const NOTIFICATION_KIND_VARIANT: Record<NotificationKind, BadgeVariant> = {
  delay: 'warning',
  arrive: 'success',
  update: 'default',
};

export const DAY_TYPES: DayType[] = ['weekday', 'weekend'];
export const DAY_TYPE_LABEL: Record<DayType, string> = {
  weekday: 'Weekday',
  weekend: 'Weekend',
};

/** Categorical palette for charts (deep-blue anchored, colorblind-considerate). */
export const CHART_COLORS = [
  '#2563eb',
  '#0ea5e9',
  '#14b8a6',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
];

/** Status → chart color, matching the badge tone semantics. */
export const STATUS_CHART_COLOR = {
  active: '#16a34a',
  offline: '#94a3b8',
  maintenance: '#f59e0b',
  onTime: '#16a34a',
  delayed: '#f59e0b',
  resolved: '#16a34a',
  open: '#f59e0b',
} as const;
