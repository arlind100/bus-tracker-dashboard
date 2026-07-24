// Firestore collection name constants.
//
// Copied VERBATIM from the Bus Tracker mobile app (src/firebase/collections.ts)
// so both clients read/write the exact same collections. Never hardcode a
// collection-name string elsewhere — always import COLLECTIONS from here.
//
// ⚠️ Do NOT rename these. The mobile app + Firestore documents depend on them.

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
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];
