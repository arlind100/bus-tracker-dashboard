export const COLLECTIONS = {
  users:         'users',
  admins:        'admins',
  agencies:      'agencies',
  buses:         'buses',
  routes:        'routes',
  stops:         'stops',
  schedules:     'schedules',
  busLocations:  'busLocations',
  issueReports:  'issueReports',
  notifications: 'notifications',
  adminUpdates:  'adminUpdates',
  drivers:       'drivers',
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];
