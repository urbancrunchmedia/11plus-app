// Everyone we could email: Firebase Auth users with an email address, with
// their last activity (users/{uid}.updatedAt is written after every game).
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

  const activity = await adminDb().collection("users").select("updatedAt").get();
  const lastPlayed = new Map(activity.docs.map((d) => [d.id, Date.parse(d.get("updatedAt")) || 0]));
  for (const a of accounts) a.lastActive = Math.max(a.createdAt, lastPlayed.get(a.uid) || 0);
  return accounts;
}
