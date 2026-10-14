import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export const SUPPORT_CATEGORIES = [
  { id: "billing",   label: "Billing or subscription" },
  { id: "technical", label: "Something isn't working" },
  { id: "feedback",  label: "Feedback or a suggestion" },
  { id: "other",     label: "Something else" },
];

// Writes straight to Firestore (create-only, per firestore.rules) rather than
// a mailto link, which does nothing on a device with no mail app configured
// — this always reaches us, and the account is already known, so there's
// nothing else to ask for beyond what's actually wrong.
export async function submitSupportRequest(user, { category, message }) {
  if (!user) throw new Error("Not signed in.");
  const text = (message || "").trim();
  if (!text) throw new Error("Please describe what's going on.");
  await addDoc(collection(db, "supportRequests"), {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
    category,
    message: text,
    createdAt: serverTimestamp(),
  });
}
