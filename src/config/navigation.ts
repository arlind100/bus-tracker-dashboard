import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Building2,
  ShieldCheck,
  Route as RouteIcon,
  MapPin,
  Bus,
  IdCard,
  Radio,
  CalendarClock,
  Bell,
  TriangleAlert,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', path: '/', icon: LayoutDashboard }],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Agencies', path: '/agencies', icon: Building2 },
      { label: 'Administrators', path: '/admins', icon: ShieldCheck, superAdminOnly: true },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Routes', path: '/routes', icon: RouteIcon },
      { label: 'Stops', path: '/stops', icon: MapPin },
      { label: 'Buses', path: '/buses', icon: Bus },
      { label: 'Drivers', path: '/drivers', icon: IdCard },
      { label: 'Live Operations', path: '/live', icon: Radio },
      { label: 'Schedules', path: '/schedules', icon: CalendarClock },
    ],
  },
  {
    title: 'Engagement',
    items: [
      { label: 'Notifications', path: '/notifications', icon: Bell },
      { label: 'Issues', path: '/issues', icon: TriangleAlert },
    ],
  },
];
