import React, { createContext, useContext, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firebase";
import { mergeFromCloud, syncProfile, prepareLocalForUser } from "../utils/cloudScores";

const AuthContext = createContext(null);

// Errors that mean "this environment can't do a popup" — fall back to redirect.
const POPUP_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
  "auth/internal-error",
]);

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(undefined); // undefined = loading
  const [redirectError, setRedirectError] = useState(null);

  useEffect(() => {
    // Complete any sign-in that used the redirect fallback.
    getRedirectResult(auth).catch((err) => {
      console.error("Redirect sign-in error:", err.code, err.message);
      setRedirectError(err.code || "auth/redirect-failed");
    });

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);
      if (u) {
        // Clear any previous account's local progress on this device, THEN merge
        // this account's cloud scores and publish a profile (friend code + points).
        prepareLocalForUser(u.uid);
        mergeFromCloud(u.uid).then(() => syncProfile(u)).catch(console.error);
      }
    });
    return unsub;
  }, []);

  async function signInWithGoogle() {
    setRedirectError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    // Prefer popup; if the browser blocks the auth popup/iframe (third-party
    // cookie restrictions, embedded webviews, Safari), fall back to redirect.
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (POPUP_FALLBACK_CODES.has(err.code)) {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw err;
    }
  }

  async function signInWithEmail(email, password) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signUpWithEmail(email, password, name) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
  }

  async function handleSignOut() {
    await signOut(auth);
  }

  // Set/change the child's display name (used on the leaderboard).
  async function updateDisplayName(name) {
    const u = auth.currentUser;
    const clean = (name || "").trim();
    if (!u || !clean) return;
    // Optimistic: show the new name instantly (Firebase mutates currentUser in
    // place, so build a plain object the app's data-only reads can use).
    setUser({ uid: u.uid, displayName: clean, photoURL: u.photoURL, email: u.email });
    await updateProfile(u, { displayName: clean });
    // Publish to the public profile in the background — don't block the UI on the
    // extra Firestore round-trips (that was the long "Saving…" delay).
    syncProfile(u).catch(console.error);
  }

  return (
    <AuthContext.Provider value={{
      user,
      redirectError,
      updateDisplayName,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut: handleSignOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
