// POST /api/admin/test-email   Authorization: Bearer <ADMIN_SECRET>
// Body: { to, template: "welcome" | "trial" | "inactivity" | "firstRound" | "winBack" | "announcement" | "support" }
// Sends one sample of a template, subject prefixed "[TEST]", to check how it looks.
// { to, template: "firstRound", real: true } instead sends the real first-round
// email to that account (its own unsubscribe link, no [TEST]) and records it,
// so the daily job won't send it again.
// { to, note: { subject, text, attachments?: [{ filename, content(base64) }], scheduledAt? } }
// sends a private reminder to one of the owners' own addresses (nothing else).
// { cancel: "<email id>" } cancels a scheduled reminder.
import { adminAuth, adminDb } from "../../server/firebaseAdmin.js";
import {
  sendEmail, ownerNoteEmail, cancelScheduledEmail, welcomeEmail, trialEndingEmail, inactivityEmail, announcementEmail, supportRequestEmail, firstRoundEmail, winBackEmail,
} from "../../server/email.js";

const OWNER_EMAILS = new Set(["urbancrunchmedia@gmail.com", "reuben.dongre@gmail.com"]);

const SAMPLES = {
  welcome: () => welcomeEmail({ name: "" }),
  trial: () => trialEndingEmail({ trialEnd: Date.now() + 3 * 24 * 60 * 60 * 1000 }),
  inactivity: () => inactivityEmail({ uid: "test", name: "", days: 6 }),
  firstRound: () => firstRoundEmail({ uid: "test" }),
  winBack: () => winBackEmail({ uid: "test", name: "" }),
  support: () => supportRequestEmail({
    uid: "test", email: "parent@example.com", displayName: "Sample learner", categoryLabel: "Billing or subscription",
    message: "This is a sample support request from the in-app form.\n\nReplying to this email would go to the parent.",
    createdAt: new Date().toISOString(), id: "test",
  }),
  announcement: () => announcementEmail({
    uid: "test",
    subject: "New on 11 PlusLab",
    text: "This is a sample announcement.\n\nYour real message goes here, split into paragraphs by blank lines.",
    ctaLabel: "Open 11 PlusLab",
  }),
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const secret = (process.env.ADMIN_SECRET || "").trim();
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { to, template, real, note, cancel } = req.body || {};
  if (cancel) {
    try { return res.status(200).json({ cancelled: true, ...(await cancelScheduledEmail(String(cancel))) }); }
    catch (e) { return res.status(500).json({ error: e.message }); }
  }
  if (note) {
    if (!OWNER_EMAILS.has(String(to || "").toLowerCase())) return res.status(400).json({ error: "Notes only go to the owners" });
    if (!note.subject || !note.text) return res.status(400).json({ error: "Need note.subject and note.text" });
    try {
      const data = await sendEmail({
        to, uid: "owner", email: ownerNoteEmail(note), attachments: note.attachments, scheduledAt: note.scheduledAt,
      });
      return res.status(200).json({ sent: true, id: data?.id, scheduledAt: note.scheduledAt || null });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  if (!to || !SAMPLES[template]) return res.status(400).json({ error: "Need to and a known template" });
  if (real) {
    if (template !== "firstRound") return res.status(400).json({ error: "Only firstRound can be sent for real here" });
    try {
      const user = await adminAuth().getUserByEmail(to);
      const data = await sendEmail({ to: user.email, uid: user.uid, email: firstRoundEmail({ uid: user.uid }), idempotencyKey: `first-round-${user.uid}` });
      await adminDb().collection("emailState").doc(user.uid).set({ firstRoundSentAt: new Date().toISOString() }, { merge: true });
      return res.status(200).json({ sent: true, real: true, id: data?.id });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  try {
    const email = SAMPLES[template]();
    const data = await sendEmail({ to, uid: "test", email: { ...email, subject: `[TEST] ${email.subject}` } });
    res.status(200).json({ sent: true, id: data?.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
