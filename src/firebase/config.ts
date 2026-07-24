// Firebase app initialization for the Super Admin Dashboard.
//
// This connects to the SAME Firebase backend as the Bus Tracker mobile app
// (project `bus-tracker-capstone`). The config lives in environment variables
// (VITE_FIREBASE_*) rather than being hard-coded — see .env.example.
//
// Mirrors the mobile app's src/firebase/config.ts:
//   - guards against double-init (getApps().length)
//   - Firestore is the live data source
//   - Auth on web defaults to browserLocalPersistence, so admin sessions
//     survive page reloads with no extra setup.
//
// Read Firestore through the service layer (src/services/*), never by importing
// the Firebase SDK directly into a component.

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Fail loudly in development if the env is missing, rather than silently
// connecting to `undefined` and producing confusing auth/permission errors.
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    '[firebase] Missing Firebase configuration. Copy .env.example to .env and fill in the VITE_FIREBASE_* values.',
  );
}

export const firebaseApp: FirebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

// ignoreUndefinedProperties: the form dialogs send `undefined` for cleared
// optional fields (e.g. "No agency" in a select). Without this, updateDoc /
// batch.update REJECT the entire write with "Unsupported field value:
// undefined", so a single empty optional silently fails the whole save.
// Skipping undefined keys makes those partial updates behave as intended.
// initializeFirestore must run before any getFirestore call — this module is
// the single init point, and it re-uses the existing instance on hot reload.
export const db: Firestore = (() => {
  try {
    return initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true });
  } catch {
    // Throws if Firestore was already initialized for this app (hot reload) —
    // reuse the existing instance, which already carries the setting.
    return getFirestore(firebaseApp);
  }
})();

// Web default persistence = browserLocalPersistence (IndexedDB/localStorage):
// the signed-in session survives reloads and browser restarts automatically.
export const auth: Auth = getAuth(firebaseApp);

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
