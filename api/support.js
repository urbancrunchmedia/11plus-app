// POST /api/support  { category, message }  -> { ok: true }
// The in-app "Contact support" form. Saves the request (so nothing is lost)
// and emails it to the support inbox with the parent's address as Reply-To,
// so answering is just pressing Reply. The parent's address is never shown
// in the app, only used here server-side.
import { verifyToken } from "../server/verifyToken.js";
import { adminAuth, adminDb } from "../server/firebaseAdmin.js";
import { sendEmail, supportRequestEmail, SUPPORT_INBOX } from "../server/email.js";

const CATEGORIES = {
  billing: "Billing or subscription",
  technical: "Something isn't working",
  feedback: "Feedback or a suggestion",
  other: "Something else",
};
const MAX_PER_HOUR = 5;
const HOUR = 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  let uid;
  try {
    ({ uid } = await verifyToken(req));
  } catch {
    return res.status(401).json({ error: "Please sign in again and retry." });
  }
  const category = CATEGORIES[req.body?.category] ? req.body.category : "other";
  const message = String(req.body?.message || "").trim().slice(0, 2000);
  if (!message) return res.status(400).json({ error: "Please describe what's going on." });

  try {
    const db = adminDb();
    // Small per-account limit so the form can't be used to flood the inbox.
    const limitRef = db.collection("supportLimits").doc(uid);
    const allowed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(limitRef);
      const now = Date.now();
      const { windowStart = 0, count = 0 } = snap.exists ? snap.data() : {};
      const fresh = now - windowStart > HOUR;
      if (!fresh && count >= MAX_PER_HOUR) return false;
      tx.set(limitRef, fresh ? { windowStart: now, count: 1 } : { windowStart, count: count + 1 });
      return true;
    });
    if (!allowed) {
      return res.status(429).json({ error: "You've sent a few messages already. Please wait an hour, or email hello@11pluslab.com." });
    }

    const user = await adminAuth().getUser(uid);
    const request = {
      uid,
      email: user.email || "",
      displayName: user.displayName || "",
      category,
      message,
      createdAt: new Date().toISOString(),
    };
    const ref = await db.collection("supportRequests").add(request);

    await sendEmail({
      to: SUPPORT_INBOX,
      replyTo: user.email || undefined,
      email: supportRequestEmail({ ...request, categoryLabel: CATEGORIES[category], id: ref.id }),
    });
    await ref.update({ emailedAt: new Date().toISOString() });
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("support:", e.message);
    res.status(500).json({ error: "Couldn't send your message. Please try again." });
  }
}
