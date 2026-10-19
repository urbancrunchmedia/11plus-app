// POST /api/admin/announce   Authorization: Bearer <ADMIN_SECRET>
// Sends an announcement to every account, at most DAILY_CAP per call so it
// stays inside Resend's free daily allowance. Call it again (e.g. the next
// day) with the same id to carry on where it stopped; nobody gets it twice.
//
// Body:
//   { id, subject, heading?, text, ctaLabel?, ctaUrl? }  first send (content is saved)
//   { id }                                               continue a saved announcement
//   { ...any of the above, testTo: "you@example.com" }   send one test copy only
//   { id, dryRun: true }                                 just count who would get it
import { adminDb } from "../../server/firebaseAdmin.js";
import { listAccounts } from "../../server/recipients.js";
import { announcementEmail, sendBatch, sendEmail, unsubscribedUids, DAILY_CAP } from "../../server/email.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const secret = (process.env.ADMIN_SECRET || "").trim();
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const db = adminDb();
    const body = req.body || {};
    const id = String(body.id || "").replace(/[^a-z0-9-]/gi, "");
    if (!id) return res.status(400).json({ error: "Missing id" });

    const ref = db.collection("announcements").doc(id);
    if (body.dryRun) {
      const [accounts, unsubscribed, alreadySent] = await Promise.all([listAccounts(), unsubscribedUids(db), ref.collection("sent").get()]);
      const sent = new Set(alreadySent.docs.map((d) => d.id));
      const wouldSend = accounts.filter((a) => !unsubscribed.has(a.uid) && !sent.has(a.uid)).length;
      return res.status(200).json({ dryRun: true, wouldSend, unsubscribed: unsubscribed.size, total: accounts.length });
    }

    let content;
    if (body.subject && body.text) {
      content = {
        subject: body.subject, heading: body.heading || "", text: body.text,
        ctaLabel: body.ctaLabel || "", ctaUrl: body.ctaUrl || "",
      };
    } else {
      const saved = await ref.get();
      if (!saved.exists) return res.status(400).json({ error: "No saved announcement with that id; send subject and text" });
      content = saved.data().content;
    }

    if (body.testTo) {
      await sendEmail({ to: body.testTo, uid: "test", email: announcementEmail({ uid: "test", ...content }) });
      return res.status(200).json({ test: true, sentTo: body.testTo });
    }

    await ref.set({ content, updatedAt: new Date().toISOString() }, { merge: true });

    const [accounts, unsubscribed, alreadySent] = await Promise.all([
      listAccounts(),
      unsubscribedUids(db),
      ref.collection("sent").get(),
    ]);
    const sent = new Set(alreadySent.docs.map((d) => d.id));
    const pending = accounts.filter((a) => !unsubscribed.has(a.uid) && !sent.has(a.uid));
    const now = pending.slice(0, Math.min(DAILY_CAP, Number(body.limit) || DAILY_CAP));

    if (now.length) {
      await sendBatch(now.map((a) => ({ to: a.email, uid: a.uid, email: announcementEmail({ uid: a.uid, ...content }) })));
      const batch = db.batch();
      const at = new Date().toISOString();
      for (const a of now) batch.set(ref.collection("sent").doc(a.uid), { at });
      await batch.commit();
    }
    res.status(200).json({ sent: now.length, remaining: pending.length - now.length, total: accounts.length });
  } catch (e) {
    console.error("announce:", e.message);
    res.status(500).json({ error: e.message });
  }
}
