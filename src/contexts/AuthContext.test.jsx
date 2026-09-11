import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act, useEffect } from "react";
import { createRoot } from "react-dom/client";

// Mirrors the real Firebase behaviour that caused the bug: onAuthStateChanged
// fires for the sign-up itself with the pre-updateProfile user (displayName
// still null), and never fires again just because updateProfile ran
// afterwards — it mutates auth.currentUser in place, same as the real SDK.
let authStateCallback = null;

vi.mock("../firebase", () => ({ auth: {} }));
vi.mock("../utils/cloudScores", () => ({
  prepareLocalForUser: vi.fn(),
  mergeFromCloud: vi.fn(async () => {}),
  syncProfile: vi.fn(async () => {}),
}));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(async () => null),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, cb) => { authStateCallback = cb; return () => {}; }),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(async () => {
    // `cred.user` and what onAuthStateChanged hands the listener are
    // deliberately SEPARATE objects — updateProfile only ever touches the
    // former in real Firebase too (auth.currentUser), and nothing re-invokes
    // the listener just because a profile changed. So the ONLY way React's
    // copy can ever show the new name is an explicit setUser call — this
    // mock can't accidentally leak the answer through a shared reference.
    authStateCallback({ uid: "u1", displayName: null, photoURL: null, email: "a@b.com" });
    return { user: { uid: "u1", displayName: null, photoURL: null, email: "a@b.com" } };
  }),
  updateProfile: vi.fn(async (user, { displayName }) => { user.displayName = displayName; }),
  sendPasswordResetEmail: vi.fn(),
}));

import { AuthProvider, useAuth } from "./AuthContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Every render's user, snapshotted by VALUE (never the live object) — a mock
// that mutates auth.currentUser in place must not be able to make a stale
// closure look fresh just by reading through the same reference later.
let renders = [];
let doSignUp = null;
function Probe() {
  const { user, signUpWithEmail } = useAuth();
  renders.push(user ? { ...user } : user);
  useEffect(() => { doSignUp = signUpWithEmail; });
  return null;
}

async function mount() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => { createRoot(container).render(<AuthProvider><Probe /></AuthProvider>); });
  return container;
}

describe("signUpWithEmail", () => {
  beforeEach(() => { authStateCallback = null; renders = []; });

  it("re-renders consumers with the chosen name, not just a mutated reference", async () => {
    await mount();
    await act(async () => { await doSignUp("a@b.com", "pw", "Amu"); });

    // The bug: onAuthStateChanged's setUser(credUser) is the only render this
    // produces: no second setUser call after updateProfile means no second
    // render, so no render in this list ever shows displayName "Amu" —
    // App.jsx's needsOnboarding reads exactly this and wrongly sends someone
    // straight back through "Who's learning?" to ask for the same name again.
    expect(renders.some((u) => u?.displayName === "Amu")).toBe(true);
  });
});
