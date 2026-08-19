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
      try {
        await signOut(secondaryAuth);
      } catch { /* best effort */ }
      try {
        await deleteApp(secondary);
      } catch { /* best effort */ }
    }
  },

  async sendPasswordSetupEmail(email: string): Promise<void> {
    await sendPasswordResetEmail(primaryAuth, email.trim());
  },
};
