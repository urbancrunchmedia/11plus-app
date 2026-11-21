import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

export const SUPPORT_CATEGORIES = [
  { id: "billing",   label: "Billing or subscription" },
  { id: "technical", label: "Something isn't working" },
  { id: "feedback",  label: "Feedback or a suggestion" },
  { id: "other",     label: "Something else" },
];

// Sent through /api/support, which saves it and emails it to
// hello@11pluslab.com with the parent's address as Reply-To (rather than a
// mailto link, which does nothing on a device with no mail app configured).
// If the server can't be reached at all, the request is still written straight
// to Firestore (create-only, per firestore.rules) so it is never lost.
export async function submitSupportRequest(user, { category, message }) {
  if (!user) throw new Error("Not signed in.");
  const text = (message || "").trim();
  if (!text) throw new Error("Please describe what's going on.");
  let res;
  try {
    const token = await user.getIdToken();
    res = await fetch("/api/support", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ category, message: text }),
    });
  } catch {
    res = null; // offline or the function is down: fall through to Firestore
  }
  if (res?.ok) return;
  if (res && res.status < 500) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Couldn't send your message. Please try again.");
  }
  await addDoc(collection(db, "supportRequests"), {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
    category,
    message: text,
    createdAt: serverTimestamp(),
  });
}

// Report a friend's name from the leaderboard. Goes to the same inbox; the
// server looks up the name itself, so it can't be faked by the reporter.
export async function reportName(reportedUid) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in.");
  const token = await user.getIdToken();
  const res = await fetch("/api/support", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ category: "report", reportedUid }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Couldn't send the report. Please try again.");
  }
}
