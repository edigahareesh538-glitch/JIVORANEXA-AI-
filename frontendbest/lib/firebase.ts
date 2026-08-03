"use client";

/**
 * Optional: only used for the "Sign in with Google" button.
 * Email/password + Guest Mode work with zero Firebase setup (see lib/auth.ts).
 *
 * To enable Google login, add these to frontend/.env.local (get them from
 * Firebase Console -> Project settings -> General -> Your apps -> SDK setup):
 *   NEXT_PUBLIC_FIREBASE_API_KEY=
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
 *   NEXT_PUBLIC_FIREBASE_APP_ID=
 * ...and set FIREBASE_SERVICE_ACCOUNT_JSON on the backend (see backend/.env.example).
 */
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | null = null;
function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return app;
}

export async function signInWithGooglePopup(): Promise<string> {
  if (!firebaseConfigured) {
    throw new Error("Google login isn't configured yet -- add NEXT_PUBLIC_FIREBASE_* vars (see README).");
  }
  const auth = getAuth(getFirebaseApp());
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user.getIdToken();
}
