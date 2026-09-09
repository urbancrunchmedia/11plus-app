// A parent's statutory right to see and delete what's held about their
// child (AADC standards 11/15) shouldn't route through emailing support and
// waiting — it should be a button. Both actions here are self-service and
// immediate.
import { deleteUser, GoogleAuthProvider, reauthenticateWithPopup } from "firebase/auth";
import { doc, getDoc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { getSettings, getAllBests, getAllHistory } from "./leaderboard";

// Every place this account's data actually lives, gathered into one JSON
// object a parent can read or hand to anyone who asks what's held.
export async function exportMyData(user) {
  if (!user) throw new Error("Not signed in.");
  const uid = user.uid;

  const [profileSnap, usersSnap, friendshipDocs] = await Promise.all([
    getDoc(doc(db, "profiles", uid)),
    getDoc(doc(db, "users", uid)),
    getDocs(query(collection(db, "friendships"), where("uids", "array-contains", uid))),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    account: {
      uid,
      email: user.email,
      displayName: user.displayName,
      signInProviders: (user.providerData || []).map((p) => p.providerId),
      createdAt: user.metadata?.creationTime || null,
      lastSignInAt: user.metadata?.lastSignInTime || null,
    },
    cloudProfile: profileSnap.exists() ? profileSnap.data() : null,
    cloudProgress: usersSnap.exists() ? usersSnap.data() : null,
    friendships: friendshipDocs.docs.map((d) => d.data()),
    // Kept only on this device, never sent to us — included so the export is
    // a complete picture of what this account knows, not just the cloud half.
    onThisDeviceOnly: {
      settings: getSettings(),
      personalBests: getAllBests(),
      history: getAllHistory(),
    },
  };
}

// Triggers a browser download of the export above — a real file save in the
// live app (this isn't a sandboxed preview), so a plain Blob + <a download> works.
export function downloadMyData(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `11plus-lab-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Deletes every server-held trace of this account, then the sign-in itself.
// Order matters: the Firestore documents first (while still authenticated as
// this user, per the rules), the Auth account last (irreversible — nothing
// after it can use this uid again).
export async function deleteMyAccount(user) {
  if (!user) throw new Error("Not signed in.");
  const uid = user.uid;

  const profileSnap = await getDoc(doc(db, "profiles", uid));
  const code = profileSnap.exists() ? profileSnap.data()?.code : null;

  const friendshipDocs = await getDocs(
    query(collection(db, "friendships"), where("uids", "array-contains", uid))
  );

  await Promise.all([
    ...friendshipDocs.docs.map((d) => deleteDoc(d.ref)),
    code ? deleteDoc(doc(db, "codes", code)) : Promise.resolve(),
    deleteDoc(doc(db, "profiles", uid)),
    deleteDoc(doc(db, "users", uid)),
  ]);

  try {
    await deleteUser(user);
  } catch (e) {
    if (e.code !== "auth/requires-recent-login") throw e;
    // Firebase requires a *recent* sign-in for account deletion. Their
    // Firestore data is already gone at this point; only the login itself
    // remains, so it's safe to silently re-prove identity and retry once
    // rather than surface a scary error for a routine session-age check.
    if ((user.providerData || []).some((p) => p.providerId === "google.com")) {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
      await deleteUser(user);
    } else {
      throw new Error("For your security, please sign out, sign back in, and try deleting your account again.");
    }
  }
}
