// POST /api/email/welcome  -> { sent: boolean }
// Called by the app right after sign-up. Sends the welcome email once per
// account: only for accounts created in the last day, and only if
// emailState/{uid}.welcomeSentAt isn't set yet (claimed in a transaction, so
// two tabs signing in at once can't both send it).
//
// POST { type: "reset", email } -> { ok: true }   (no sign-in needed)
// Lives here because the project is at Vercel's function limit. Sends our own
// branded password-reset email (or, for a Google sign-in account, how to sign
// in). Always answers the same way, so it never reveals whether an account
// exists, and allows 3 requests per address per hour.
import { createHash } from "crypto";
import { verifyToken } from "../../server/verifyToken.js";
import { adminAuth, adminDb } from "../../server/firebaseAdmin.js";
import { sendEmail, welcomeEmail, passwordResetEmail, googleSignInEmail, SITE } from "../../server/email.js";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const RESETS_PER_HOUR = 3;

async function handleReset(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const done = () => res.status(200).json({ ok: true });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "Please enter a valid email address." });
  try {
    const db = adminDb();
    const ref = db.collection("resetLimits").doc(createHash("sha256").update(email).digest("hex").slice(0, 32));
    const allowed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const { windowStart = 0, count = 0 } = snap.exists ? snap.data() : {};
      const fresh = now - windowStart > HOUR;
      if (!fresh && count >= RESETS_PER_HOUR) return false;
      tx.set(ref, fresh ? { windowStart: now, count: 1 } : { windowStart, count: count + 1 });
      return true;
    });
    if (!allowed) return done(); // same answer: don't reveal anything, just stop sending

    let user;
    try { user = await adminAuth().getUserByEmail(email); }
    catch (e) { if (e.code === "auth/user-not-found") return done(); throw e; }

    const providers = user.providerData.map((p) => p.providerId);
    if (!providers.includes("password") && providers.includes("google.com")) {
      await sendEmail({ to: user.email, email: googleSignInEmail() });
      return done();
    }
    // Firebase's reset link, served through our own domain (vercel.json
    // proxies /__/auth/* to Firebase), so parents see 11pluslab.com.
    const link = (await adminAuth().generatePasswordResetLink(user.email, { url: SITE }))
      .replace(/^https:\/\/[^/]+\/__\/auth\/action/, `${SITE}/__/auth/action`);
    await sendEmail({ to: user.email, email: passwordResetEmail({ link }) });
    done();
  } catch (e) {
    console.error("password reset:", e.message);
    res.status(500).json({ error: "Couldn't send the reset email. Please try again." });
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (req.body?.type === "reset") return handleReset(req, res);
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
