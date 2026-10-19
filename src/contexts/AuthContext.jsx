import React, { createContext, useContext, useEffect, useState, useRef } from "react";
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

// Ask the server to send the welcome email. Only for accounts created in the
// last few minutes; the server also checks it hasn't been sent already, so
// calling this more than once (other tab, reload) is harmless.
function maybeSendWelcome(u, name) {
  const created = Date.parse(u?.metadata?.creationTime || "");
  if (!created || Date.now() - created > 10 * 60 * 1000 || typeof u.getIdToken !== "function") return;
  u.getIdToken()
    .then((token) => fetch("/api/email/welcome", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(name ? { name } : {}),
    }))
    .catch(() => { /* a missed welcome email must never break sign-in */ });
}

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
  // While a signUpWithEmail() call is in flight, the listener below would
  // otherwise commit ONE render with the fresh account's displayName still
  // null (Firebase fires onAuthStateChanged for the sign-up itself before
  // our own updateProfile call even starts) — long enough for App.jsx's
  // needsOnboarding check to flash the "Who's learning?" screen before the
  // corrected name lands a moment later. signUpWithEmail sets this ref before
  // creating the account and does the listener's own job itself once the
  // real name is known, so `user` only ever goes straight from loading to
  // its final, correct value — no intermediate stale render to flash.
  const signingUpRef = useRef(false);
  // The most recently signed-in uid, so an in-flight sync from an account
  // that's since been switched away from (shared device, quick profile
  // swap) can tell it's stale and skip writing — syncProfile() computes its
  // stats from local storage, which by then belongs to the NEW account.
  const latestUidRef = useRef(null);
  // A persisted session restoring from storage — especially Safari/iOS,
  // under ITP or a slow IndexedDB read — can fire this listener once with
  // "logged out" before correcting itself a moment later with the real
  // signed-in user, flashing the login screen on every reload. Holding a
  // "logged out" result for a short grace period lets that correction land
  // first; a genuinely logged-out visitor just sees the login screen a
  // few hundred ms later, which is imperceptible.
  const pendingLogoutTimer = useRef(null);

  useEffect(() => {
    // Complete any sign-in that used the redirect fallback.
    getRedirectResult(auth).catch((err) => {
      console.error("Redirect sign-in error:", err.code, err.message);
      setRedirectError(err.code || "auth/redirect-failed");
    });

    const unsub = onAuthStateChanged(auth, (u) => {
      if (signingUpRef.current) return;
      clearTimeout(pendingLogoutTimer.current);
      if (!u) {
        pendingLogoutTimer.current = setTimeout(() => {
          setUser(null);
          latestUidRef.current = null;
        }, 400);
        return;
      }
      setUser(u);
      latestUidRef.current = u.uid;
      maybeSendWelcome(u);
      // Clear any previous account's local progress on this device, THEN merge
      // this account's cloud scores and publish a profile (friend code + points).
      prepareLocalForUser(u.uid);
      mergeFromCloud(u.uid)
        .then(() => { if (latestUidRef.current === u.uid) return syncProfile(u); })
        .catch(console.error);
    });
    return () => { unsub(); clearTimeout(pendingLogoutTimer.current); };
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
    // Told the listener above to stand down for this sign-up — replicate its
    // job here ourselves, once, with the real name already known, so `user`
    // never passes through a displayName:null render at all.
    signingUpRef.current = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: check.value });
      const u = cred.user;
      prepareLocalForUser(u.uid);
      setUser({ uid: u.uid, displayName: check.value, photoURL: u.photoURL, email: u.email });
      maybeSendWelcome(u, check.value);
      await mergeFromCloud(u.uid).then(() => syncProfile(u)).catch(console.error);
    } finally {
      signingUpRef.current = false;
    }
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
