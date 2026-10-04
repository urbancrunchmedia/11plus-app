import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Trim each value — Vercel env vars were stored with trailing newlines, which
// corrupt the Firebase auth iframe URL ("Illegal url for new iframe").
const clean = (v) => (v == null ? v : String(v).trim());

// On our own hosts, run the Google sign-in handler same-origin (vercel.json
// proxies /__/auth/* to firebaseapp.com). With the firebaseapp.com domain,
// storage-partitioning browsers (Safari, iOS home-screen app) lose the
// redirect state: "Unable to process request due to missing initial state".
// Off until VITE_FIREBASE_SAME_ORIGIN_AUTH=1 — each host's /__/auth/handler
// must first be an authorised redirect URI on the Google OAuth client, or
// Google sign-in fails with redirect_uri_mismatch.
const PROXIED_AUTH_HOSTS = ["11pluslab.com", "www.11pluslab.com", "11plus-app.vercel.app"];
const host = typeof window !== "undefined" ? window.location.hostname : "";
const sameOriginAuth =
  clean(import.meta.env.VITE_FIREBASE_SAME_ORIGIN_AUTH) === "1" && PROXIED_AUTH_HOSTS.includes(host);

const firebaseConfig = {
  apiKey:            clean(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain:        sameOriginAuth ? host : clean(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId:         clean(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket:     clean(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId:             clean(import.meta.env.VITE_FIREBASE_APP_ID),
  measurementId:     clean(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID),
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
