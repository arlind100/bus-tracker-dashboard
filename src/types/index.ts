export type AppMode = 'passenger' | 'admin';

export type AdminRole = 'super_admin' | 'agency_admin';

export type UserRole = 'passenger' | AdminRole;

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: AdminRole;
  isSuperAdmin: boolean;
  agencyId?: string;
}

export interface AdminRecord {
  uid: string;
  email?: string;
  active: boolean;
  role: AdminRole;
  agencyId?: string;
  displayName?: string;
  createdAt?: number;
  createdBy?: string;
  updatedAt?: number;
}

export interface Agency {
  id: string;
  agencyId: string;
  name: string;
  city?: string;
  phone?: string;
  email?: string;
  active?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export type RouteStatus = 'On time' | 'Delayed' | 'Offline';
export type RouteSt = 'ok' | 'warn' | 'off';

export interface PathPoint {
  lat: number;
  lng: number;
  label?: string;
}

export interface Route {
  id: string;
  agencyId?: string;
  routeNumber?: string;
  name: string;
  color?: string;
  from?: string;
  to?: string;
  city?: string;
  isActive?: boolean;
  status?: RouteStatus;
  st?: RouteSt;
  freq?: string;
  duration?: string;
  description?: string;
  stops?: string[];
  routePath?: PathPoint[];
  code?: string;
  source?: string;
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
  updatedBy?: string;
}

export interface Stop {
  id: string;
  stopId?: string;
  agencyId?: string;
  routeId?: string;
  routes?: string[];
  name: string;
  order?: number;
  city?: string;
  lat?: number;
  lng?: number;
  x?: number;
  y?: number;
  source?: string;
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
  updatedBy?: string;
}

export type DayType = 'weekday' | 'weekend';

export interface Schedule {
  id: string;
  scheduleId?: string;
  agencyId?: string;
  routeId: string;
  dayType: DayType;
  departureTime: string;
  arrivalTime: string;
  isActive?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export type DriverStatus = 'active' | 'inactive' | 'on_leave';

export interface Driver {
  id: string;
  name: string;
  agencyId?: string;
  licenseNumber?: string;
  phone?: string;
  email?: string;
  assignedBusId?: string;
  status?: DriverStatus;
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
  updatedBy?: string;
}

export type BusStatus = 'Active' | 'Offline' | 'Maintenance';

export interface Bus {
  id: string;
  agencyId?: string;
  routeId?: string;
  route?: string;
  plate?: string;
  busNumber?: string;
  driver?: string;
  driverId?: string;
  status?: BusStatus;
  capacity?: number;
  currentStop?: string;
  nextStop?: string;
  progress?: number;
  manualOverride?: boolean;
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
  updatedBy?: string;
}

export interface BusLocation {
  id: string;
  busId: string;
  agencyId?: string;
  routeId?: string;
  currentStop?: string;
  nextStop?: string;
  status?: string;
  progress?: number;
  lat?: number;
  lng?: number;
  x?: number;
  y?: number;
  updatedAt?: number;
}

export interface BusLocationUpdate {
  status?: string;
  currentStop?: string;
  nextStop?: string;
  progress?: number;
  lat?: number;
  lng?: number;
}

export type NotificationKind = 'delay' | 'arrive' | 'update';

export interface Notification {
  id: string;
  agencyId?: string;
  kind: NotificationKind;
  title: string;
  body: string;
  time: string;
  color: string;
  source?: string;
  createdAt: number;
}

export type IssueKind =
  | 'wrong_location'
  | 'wrong_eta'
  | 'missing_route'
  | 'app_bug'
  | 'other';

export type IssueStatus =
  | 'new'
  | 'open'
  | 'pending'
  | 'reviewing'
  | 'resolved'
  | 'closed';

export interface IssueReport {
  id: string;
  userId?: string;
  kind: IssueKind;
  description: string;
  routeId?: string | null;
  busId?: string | null;
  stopName?: string | null;
  status?: IssueStatus;
  source?: string;
  assignedTo?: string;
  resolutionNote?: string;
  updatedBy?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface AdminUpdate {
  id: string;
  adminUid: string;
  action: string;
  detail: string;
  targetId?: string;
  createdAt: number;
}

export interface DashboardStats {
  totalAgencies: number;
  totalRoutes: number;
  activeRoutes: number;
  totalBuses: number;
  activeBuses: number;
  offlineBuses: number;
  maintenanceBuses: number;
  totalStops: number;
  totalNotifications: number;
  openIssueReports: number;
  totalIssueReports: number;
  resolvedIssueReports: number;
  issuesByCategory: Record<IssueKind, number>;
  routesByAgency: Record<string, number>;
  busesByAgency: Record<string, number>;
  agencyNames: Record<string, string>;
  recentIssueReports: IssueReport[];
  recentAdminUpdates: AdminUpdate[];
  recentNotifications: Notification[];
}
