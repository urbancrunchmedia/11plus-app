// Client side of the tutor feature. Approval, join codes and connecting are
// server actions (api/tutor.js); reading and disconnecting go straight to
// Firestore, where firestore.rules limits each side to its own links.
import { doc, getDoc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";

export const MAX_TUTORS = 3;
const READ_TIMEOUT = 15000;

// A Firestore read that hangs (flaky connection) fails after 15s instead of
// leaving a screen on "Loading…" for ever; callers show a "Try again".
export function withTimeout(promise, ms = READ_TIMEOUT) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), ms); }),
  ]).finally(() => clearTimeout(timer));
}
const linkId = (tutorUid, childUid) => `${tutorUid}__${childUid}`;

export async function tutorApi(action, body = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in first.");
  const res = await fetch("/api/tutor", {
    method: "POST",
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

// This account's tutor record ({ status, name, business, code, ... }) or null.
export async function getTutorRecord(uid) {
  const snap = await getDoc(doc(db, "tutors", uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

// The tutors a child's account is connected to.
export async function getMyTutors(childUid) {
  const snap = await withTimeout(getDocs(query(collection(db, "tutorLinks"), where("childUid", "==", childUid))));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export function disconnectTutor(tutorUid, childUid) {
  return deleteDoc(doc(db, "tutorLinks", linkId(tutorUid, childUid)));
}

// A tutor's pupils with their synced progress.
export async function getPupils(tutorUid) {
  const links = await withTimeout(getDocs(query(collection(db, "tutorLinks"), where("tutorUid", "==", tutorUid))));
  return withTimeout(Promise.all(links.docs.map(async (d) => {
    const link = d.data();
    // The name comes from the link (set when the parent connected); tutors
    // can't read the profile, which also holds the child's friend code.
    const progress = await getDoc(doc(db, "users", link.childUid)).catch(() => null);
    return {
      uid: link.childUid,
      name: link.childName || "Pupil",
      connectedAt: link.createdAt,
      data: progress?.exists() ? progress.data() : {},
    };
  })));
}

export function removePupil(tutorUid, childUid) {
  return deleteDoc(doc(db, "tutorLinks", linkId(tutorUid, childUid)));
}

// The message a tutor sends to parents with their join code.
export function joinMessage(code, tutorName) {
  return `${tutorName} uses 11 PlusLab to follow your child's 11+ practice. ` +
    `To connect, open 11 PlusLab (11pluslab.com), go to Settings → Tutors → Connect a tutor and enter this code: ${code}`;
}
