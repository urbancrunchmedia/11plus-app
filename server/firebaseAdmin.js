// Firebase Admin for serverless functions that need more than verifying a
// token: listing users, reading activity, and the server-only emailState docs.
// FIREBASE_SERVICE_ACCOUNT holds the whole service-account JSON file.
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Local end-to-end tests run against the Firebase emulators. Never on Vercel.
export const useEmulators = !!process.env.FIRESTORE_EMULATOR_HOST && !process.env.VERCEL;

function app() {
  if (getApps().length) return getApps()[0];
  if (useEmulators) return initializeApp({ projectId: (process.env.VITE_FIREBASE_PROJECT_ID || "demo-11plus").trim() });
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  const sa = JSON.parse(raw);
  // Pasted through a dashboard, the key's newlines can arrive as literal "\n".
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  return initializeApp({ credential: cert(sa) });
}

export const adminAuth = () => getAuth(app());
export const adminDb = () => getFirestore(app());
