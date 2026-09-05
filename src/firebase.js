import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Trim each value — Vercel env vars were stored with trailing newlines, which
// corrupt the Firebase auth iframe URL ("Illegal url for new iframe").
const clean = (v) => (v == null ? v : String(v).trim());

const firebaseConfig = {
  apiKey:            clean(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain:        clean(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId:         clean(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket:     clean(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId:             clean(import.meta.env.VITE_FIREBASE_APP_ID),
  measurementId:     clean(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID),
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
