// Complimentary Full Access granted from the owner dashboard. Stored in
// compAccess/{uid} (server-only: firestore.rules has no rule for it, so no
// client can read or write it). The built-in list in src/utils/compAccess.js
// (the owner's own accounts) still applies on top of this.
import { adminDb } from "./firebaseAdmin.js";

export async function hasDashboardComp(uid) {
  if (!uid) return false;
  const doc = await adminDb().collection("compAccess").doc(uid).get();
  return doc.exists;
}

export async function dashboardCompUids() {
  const snap = await adminDb().collection("compAccess").get();
  return new Set(snap.docs.map((d) => d.id));
}

export async function setDashboardComp(uid, on, user) {
  const ref = adminDb().collection("compAccess").doc(uid);
  if (on) await ref.set({ email: (user.email || "").toLowerCase(), name: user.displayName || "", grantedAt: new Date().toISOString() });
  else await ref.delete();
}
