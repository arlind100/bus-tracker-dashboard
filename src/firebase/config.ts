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

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    '[firebase] Missing Firebase configuration. Copy .env.example to .env and fill in the VITE_FIREBASE_* values.',
  );
}

export const firebaseApp: FirebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

export const db: Firestore = (() => {
  try {
    return initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(firebaseApp);
  }
})();

export const auth: Auth = getAuth(firebaseApp);

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
