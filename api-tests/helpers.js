// Calls a Vercel-style handler directly, signed in as an emulator user.
import { adminAuth, adminDb } from "../server/firebaseAdmin.js";

const PROJECT = process.env.VITE_FIREBASE_PROJECT_ID;

// The Auth emulator's tokens are unsigned; verifyToken accepts them only in
// emulator mode (never on Vercel).
export function tokenFor(uid, email, emailVerified = true) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: uid, aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, email, email_verified: emailVerified })}.`;
}

export async function call(handler, { token, body, ip = "1.2.3.4", method = "POST" } = {}) {
  const req = { method, body, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "x-real-ip": ip } };
  let status = 200, data;
  const res = {
    setHeader() {},
    status(s) { status = s; return this; },
    json(d) { data = d; return this; },
  };
  await handler(req, res);
  return { status, data };
}

export async function makeUser(uid, email, displayName) {
  await adminAuth().createUser({ uid, email, password: "secret123", emailVerified: true });
  if (displayName) await adminDb().doc(`profiles/${uid}`).set({ displayName, points: 0, weekPoints: 0, code: `WM-${uid.slice(0, 5).toUpperCase()}` });
  return { uid, email, token: tokenFor(uid, email) };
}

export async function resetEmulators() {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
  globalThis.__emailOutbox = [];
}
