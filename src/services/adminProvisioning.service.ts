// Provisioning Firebase Auth accounts for new administrators.
//
// WHY A SECOND FIREBASE APP
// createUserWithEmailAndPassword signs the NEW user in on the app instance it
// is called on — which would silently kick the super admin out of their own
// session. So the account is created on a SECONDARY, isolated Firebase app
// (same project, in-memory session) that is signed out and deleted immediately
// afterwards. The primary app's session is never touched.
//
// WHAT THIS DELIBERATELY DOES NOT DO
//   - It does not delete Firebase Auth users. Deleting another user's account
//     requires the Admin SDK, which must never ship in a browser bundle (it
//     bypasses every security rule). Removing an admin therefore deactivates
//     the `admins/{uid}` record — which is the actual access gate in both apps
//     and in firestore.rules — and leaves the Auth account to be deleted from
//     the Firebase Console if the operator wants it gone.
//   - It does not set passwords for existing users, or read any credential.
//
// The resulting uid is written to admins/{uid} by adminsService, which is
// itself gated on isSuperAdmin() in the rules.

import { initializeApp, deleteApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { auth as primaryAuth, firebaseApp } from '@/firebase/config';

const PROVISIONING_APP_NAME = 'admin-provisioning';

/** A throwaway app instance so provisioning never disturbs the current session. */
function provisioningApp(): FirebaseApp {
  const existing = getApps().find(a => a.name === PROVISIONING_APP_NAME);
  if (existing) return getApp(PROVISIONING_APP_NAME);
  return initializeApp(firebaseApp.options, PROVISIONING_APP_NAME);
}

export interface NewAuthAccount {
  email: string;
  password: string;
  displayName?: string;
}

export const adminProvisioningService = {
  /**
   * Creates a Firebase Auth account and returns its uid, leaving the caller's
   * own session signed in. Throws with Firebase's error code on failure
   * (auth/email-already-in-use, auth/weak-password, …) so the UI can explain it.
   */
  async createAuthAccount(input: NewAuthAccount): Promise<string> {
    const secondary = provisioningApp();
    const secondaryAuth = getAuth(secondary);
    try {
      const { user } = await createUserWithEmailAndPassword(
        secondaryAuth,
        input.email.trim(),
        input.password,
      );
      if (input.displayName?.trim()) {
        await updateProfile(user, { displayName: input.displayName.trim() });
      }
      return user.uid;
    } finally {
      // Always tear the secondary session down, even on failure.
      try {
        await signOut(secondaryAuth);
      } catch {
        /* already signed out */
      }
      try {
        await deleteApp(secondary);
      } catch {
        /* already deleted */
      }
    }
  },

  /**
   * Sends a password-reset email so a new admin can set their own password and
   * the temporary one stops being usable. Uses the PRIMARY app: this call does
   * not sign anyone in, and Firebase requires the address to exist.
   */
  async sendPasswordSetupEmail(email: string): Promise<void> {
    await sendPasswordResetEmail(primaryAuth, email.trim());
  },
};
