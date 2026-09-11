import React, { createContext, useContext, useEffect, useState } from "react";
import { checkDisplayName } from "../utils/nameCheck";
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
  sendPasswordResetEmail,
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

  // Email a reset link so a forgotten password never locks anyone out.
  async function resetPassword(email) {
    const clean = (email || "").trim();
    if (!clean) throw new Error("Please enter your email address first.");
    await sendPasswordResetEmail(auth, clean);
  }

  async function signUpWithEmail(email, password, name) {
    // Check the name before the account exists, so a rejected name doesn't
    // leave someone signed up under nothing.
    const check = checkDisplayName(name);
    if (!check.ok) throw new Error(check.reason);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: check.value });
    // onAuthStateChanged already fired for the sign-up itself (before this
    // updateProfile call), with a user object whose displayName is still
    // null — Firebase mutates auth.currentUser in place afterwards but does
    // NOT refire the listener for a profile update, so React's copy of
    // `user` was left stale. That stale displayName is exactly what
    // App.jsx's needsOnboarding check reads, so straight after signing up
    // with a name already typed in, the app sent everyone through the "Who's
    // learning?" screen again to ask for the same name a second time — read
    // as the flow glitching. Same local-echo fix as updateDisplayName below.
    setUser({ uid: cred.user.uid, displayName: check.value, photoURL: cred.user.photoURL, email: cred.user.email });
  }

  async function handleSignOut() {
    await signOut(auth);
  }

  // Set/change the child's display name (used on the leaderboard).
  async function updateDisplayName(name) {
    const u = auth.currentUser;
    // Every rename in the app comes through here — Settings, the leaderboard
    // and onboarding — so this is the one place the rules have to hold.
    const check = checkDisplayName(name);
    if (!check.ok) throw new Error(check.reason);
    const clean = check.value;
    if (!u) return;
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
      resetPassword,
      signOut: handleSignOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- the useX() hook alongside its Provider is the standard pattern used by every context in this app.
export function useAuth() {
  return useContext(AuthContext);
}
