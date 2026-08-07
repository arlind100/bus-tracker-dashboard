// Canonical shared types for the Bus Tracker Super Admin Dashboard.
//
// These MIRROR the mobile app's Firestore document shapes (src/types/index.ts
// in the mobile repo + the SUPER_ADMIN_FIREBASE_HANDOFF data model). Field
// names, enum values, and the epoch-ms timestamp convention MUST match the
// mobile app so data written here renders correctly in the passenger app.
//
// ⚠️ Timestamps (`createdAt` / `updatedAt`) are Unix epoch MILLISECONDS (number)
//    — Date.now() — NOT Firestore Timestamp objects. Sort/query them as numbers.

// ─── Roles & auth ──────────────────────────────────────────────────────────────

export type AppMode = 'passenger' | 'admin';

// Additive super-admin tier. The mobile app only understands 'admin'; a super
// admin keeps role: 'admin' and is distinguished by the `superAdmin` flag, so
// the mobile gate (role === 'admin') keeps working unchanged. 'super_admin' is
// reserved for a future distinct-role migration.
export type UserRole = 'passenger' | 'admin' | 'super_admin';

/** The authenticated dashboard user, enriched with their admin record. */
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  /** True when the admins/{uid} doc carries superAdmin: true. */
  isSuperAdmin: boolean;
  /** Agency the admin is scoped to (undefined = global / unscoped). */
  agencyId?: string;
}

// ─── admins/{uid} — the access-control gate ──────────────────────────────────────

/**
 * admins/{uid} document. `active` + `role` are the exact fields the mobile app
 * and Firestore rules check — DO NOT rename or remove them. `superAdmin`,
 * `agencyId`, and metadata are safe additive fields for the dashboard.
 */
export interface AdminRecord {
  /** Mirrors the doc id (the Firebase Auth uid). Not stored by the mobile app. */
  uid: string;
  email?: string;
  active: boolean;
  role: 'admin';
  superAdmin?: boolean;
  agencyId?: string;
  displayName?: string;
  createdAt?: number;
  createdBy?: string;
}

// ─── agencies ────────────────────────────────────────────────────────────────

export interface Agency {
  id: string;
  agencyId: string;
  name: string;
  city?: string;
  phone?: string;
  email?: string;
  /** Additive: soft-disable an agency without deleting it. */
  active?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

// ─── routes ──────────────────────────────────────────────────────────────────

export type RouteStatus = 'On time' | 'Delayed' | 'Offline';
export type RouteSt = 'ok' | 'warn' | 'off';

/** One vertex of a route's drawn geometry (road-corridor waypoint). */
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
  /** Human-readable service frequency ("Every 15 min") — display only. */
  freq?: string;
  duration?: string;
  description?: string;
  /** Ordered stop NAMES (not ids). */
  stops?: string[];
  routePath?: PathPoint[];
  code?: string;
  source?: string;
  createdAt?: number;
  updatedAt?: number;
  /** Attribution for cross-agency editing (uid of the acting admin). */
  createdBy?: string;
  updatedBy?: string;
}

// ─── stops ───────────────────────────────────────────────────────────────────

export interface Stop {
  id: string;
  stopId?: string;
  routeId?: string;
  routes?: string[];
  name: string;
  order?: number;
  city?: string;
  lat?: number;
  lng?: number;
  /** Normalized 0–100 position for the in-app schematic map. */
  x?: number;
  y?: number;
  source?: string;
  createdAt?: number;
  updatedAt?: number;
  /** Attribution for cross-agency editing (uid of the acting admin). */
  createdBy?: string;
  updatedBy?: string;
}

// ─── schedules ───────────────────────────────────────────────────────────────

export type DayType = 'weekday' | 'weekend';

export interface Schedule {
  id: string;
  scheduleId?: string;
  routeId: string;
  dayType: DayType;
  departureTime: string;
  arrivalTime: string;
  isActive?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

// ─── drivers (dashboard-only personnel collection) ───────────────────────────

export type DriverStatus = 'active' | 'inactive' | 'on_leave';

/**
 * A real driver record, replacing the free-text `buses.driver` string as the
 * source of truth. Contains PII (licence, phone) and is admin-only in the
 * security rules — the passenger app never reads it.
 *
 * Compatibility: assigning a driver to a bus writes BOTH `buses.driverId` (the
 * reference) and `buses.driver` (the name string the mobile app still renders),
 * so the mobile app keeps working unchanged.
 */
export interface Driver {
  id: string;
  name: string;
  agencyId?: string;
  licenseNumber?: string;
  phone?: string;
  email?: string;
  /** Bus this driver is currently assigned to (bus doc id). */
  assignedBusId?: string;
  status?: DriverStatus;
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
  updatedBy?: string;
}

// ─── buses ───────────────────────────────────────────────────────────────────

export type BusStatus = 'Active' | 'Offline' | 'Maintenance';

export interface Bus {
  id: string;
  agencyId?: string;
  routeId?: string;
  /** Legacy duplicate of routeId — the mobile app writes both. */
  route?: string;
  plate?: string;
  busNumber?: string;
  /**
   * Driver NAME, denormalized. Kept because the mobile app renders this string
   * directly — never remove it. `driverId` is the authoritative reference.
   */
  driver?: string;
  /** Reference into `drivers`. Additive; absent on mobile-created buses. */
  driverId?: string;
  status?: BusStatus;
  capacity?: number;
  currentStop?: string;
  nextStop?: string;
  progress?: number;
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
  updatedBy?: string;
}

// ─── busLocations (1:1 with buses; doc id == bus id) ─────────────────────────────

export interface BusLocation {
  id: string;
  busId: string;
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

/** Fields an admin may manually change on a busLocation (checkpoint override). */
export interface BusLocationUpdate {
  status?: string;
  currentStop?: string;
  nextStop?: string;
  progress?: number;
  lat?: number;
  lng?: number;
}

// ─── notifications ───────────────────────────────────────────────────────────

export type NotificationKind = 'delay' | 'arrive' | 'update';

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  time: string;
  color: string;
  source?: string;
  createdAt: number;
}

// ─── issueReports ────────────────────────────────────────────────────────────

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
  /** Additive triage fields (dashboard-only). */
  assignedTo?: string;
  resolutionNote?: string;
  updatedBy?: string;
  createdAt: number;
  updatedAt?: number;
}

// ─── adminUpdates (audit log) ────────────────────────────────────────────────

export interface AdminUpdate {
  id: string;
  adminUid: string;
  action: string;
  detail: string;
  targetId?: string;
  createdAt: number;
}

// ─── Dashboard aggregate shapes ──────────────────────────────────────────────

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
  /** issueReports grouped by kind (all five kinds present, zero-filled). */
  issuesByCategory: Record<IssueKind, number>;
  /** agencyId → number of routes it owns. */
  routesByAgency: Record<string, number>;
  /** agencyId → number of buses it owns. */
  busesByAgency: Record<string, number>;
  /** agencyId → display name, for labeling the two maps above. */
  agencyNames: Record<string, string>;
  recentIssueReports: IssueReport[];
  recentAdminUpdates: AdminUpdate[];
  recentNotifications: Notification[];
}
