// POST /api/email/welcome  -> { sent: boolean }
// Called by the app right after sign-up. Sends the welcome email once per
// account: only for accounts created in the last day, and only if
// emailState/{uid}.welcomeSentAt isn't set yet (claimed in a transaction, so
// two tabs signing in at once can't both send it).
import { verifyToken } from "../../server/verifyToken.js";
import { adminAuth, adminDb } from "../../server/firebaseAdmin.js";
import { sendEmail, welcomeEmail } from "../../server/email.js";

const DAY = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { uid } = await verifyToken(req);
    const user = await adminAuth().getUser(uid);
    if (!user.email) return res.status(200).json({ sent: false });
    if (Date.now() - new Date(user.metadata.creationTime).getTime() > DAY) {
      return res.status(200).json({ sent: false });
    }

    const ref = adminDb().collection("emailState").doc(uid);
    const claimed = await adminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists && snap.data().welcomeSentAt) return false;
      tx.set(ref, { welcomeSentAt: new Date().toISOString() }, { merge: true });
      return true;
    });
    if (!claimed) return res.status(200).json({ sent: false });

    // Only the email sign-up form asks for the learner's name, so the client
    // passes it. A Google account's displayName is the parent's own name.
    const name = String(req.body?.name || "").slice(0, 20);
    await sendEmail({ to: user.email, uid, email: welcomeEmail({ name }), idempotencyKey: `welcome-${uid}` });
    res.status(200).json({ sent: true });
  } catch (e) {
    console.error("welcome email:", e.message);
    res.status(200).json({ sent: false, error: e.message });
  }
}
