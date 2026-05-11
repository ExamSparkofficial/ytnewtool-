import { getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  GoogleAuthProvider,
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "firebase/auth";

import { firebaseEnvFields } from "@/lib/firebase-config";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

let analyticsInitialized = false;

export function isFirebaseConfigured() {
  const requiredConfig = {
    NEXT_PUBLIC_FIREBASE_API_KEY: firebaseConfig.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: firebaseConfig.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: firebaseConfig.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: firebaseConfig.appId
  } satisfies Record<(typeof firebaseEnvFields)[number], string | undefined>;

  return firebaseEnvFields.every((field) => Boolean(requiredConfig[field]));
}

export function getFirebaseApp() {
  if (!isFirebaseConfigured()) {
    return null;
  }

  return getApps()[0] ?? initializeApp(firebaseConfig);
}

export function getFirebaseAuth() {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  const auth = getAuth(app);
  void setPersistence(auth, browserLocalPersistence);
  return auth;
}

export function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

export async function initializeFirebaseAnalytics() {
  if (analyticsInitialized || typeof window === "undefined") {
    return null;
  }

  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    return null;
  }

  analyticsInitialized = true;
  return getAnalytics(app);
}
