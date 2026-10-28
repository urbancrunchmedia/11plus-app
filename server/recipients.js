// Everyone we could email: Firebase Auth users with an email address, with
// their last activity (users/{uid}.updatedAt is written after every game) and
// whether they have played at all.
import { adminAuth, adminDb } from "./firebaseAdmin.js";

export async function listAccounts() {
  const accounts = [];
  let pageToken;
  do {
    const page = await adminAuth().listUsers(1000, pageToken);
    for (const u of page.users) {
      if (!u.email || u.disabled) continue;
      accounts.push({
        uid: u.uid,
        email: u.email,
        name: u.displayName || "",
        createdAt: new Date(u.metadata.creationTime).getTime(),
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);

  const [activity, profiles] = await Promise.all([
    adminDb().collection("users").select("updatedAt").get(),
    adminDb().collection("profiles").select("displayName").get(),
  ]);
  const lastPlayed = new Map(activity.docs.map((d) => [d.id, Date.parse(d.get("updatedAt")) || 0]));
  // The child's name as set in the app. The Auth displayName can be the
  // parent's own name (Google sign-up), so emails about the child use this.
  const childName = new Map(profiles.docs.map((d) => [d.id, d.get("displayName") || ""]));
  for (const a of accounts) {
    // users/{uid} is only written after a finished round, so no entry = never played.
    a.played = (lastPlayed.get(a.uid) || 0) > 0;
    a.childName = childName.get(a.uid) || "";
    a.lastActive = Math.max(a.createdAt, lastPlayed.get(a.uid) || 0);
  }
  return accounts;
}
