// GET /api/cron/inactivity  (run daily by Vercel Cron, see vercel.json)
// Two emails:
//  - First round: accounts at least FIRST_MIN_HOURS old that have never played,
//    up to FIRST_MAX_DAYS old. Sent once per account.
//  - Practice reminder: children who HAVE played but not for INACTIVE_DAYS.
//    One per quiet spell: nobody is nudged again until they've played since.
//    Quiet for more than MAX_DAYS: left alone, so this never emails everyone
//    who tried the app once months ago.
import { adminDb } from "../../server/firebaseAdmin.js";
import { listAccounts } from "../../server/recipients.js";
import { inactivityEmail, firstRoundEmail, sendBatch, unsubscribedUids } from "../../server/email.js";

const DAY = 24 * 60 * 60 * 1000;
const INACTIVE_DAYS = 5;
const MAX_DAYS = 30;
// Leaves most of Resend's 100/day free allowance for welcome emails and announcements.
const NUDGE_CAP = 40;
const FIRST_MIN_HOURS = 20;
const FIRST_MAX_DAYS = 14;
const FIRST_CAP = 30;

export default async function handler(req, res) {
  const expected = `Bearer ${(process.env.CRON_SECRET || "").trim()}`;
  if (!process.env.CRON_SECRET || req.headers.authorization !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const db = adminDb();
    const [accounts, unsubscribed, states] = await Promise.all([
      listAccounts(),
      unsubscribedUids(db),
      db.collection("emailState").select("lastNudgeAt", "firstRoundSentAt").get(),
    ]);
    const lastNudge = new Map(states.docs.map((d) => [d.id, Date.parse(d.get("lastNudgeAt")) || 0]));
    const firstSent = new Set(states.docs.filter((d) => d.get("firstRoundSentAt")).map((d) => d.id));
    const now = Date.now();

    const due = accounts
      .filter((a) => !unsubscribed.has(a.uid) && a.played)
      .filter((a) => {
        const quiet = now - a.lastActive;
        return quiet >= INACTIVE_DAYS * DAY && quiet <= MAX_DAYS * DAY;
      })
      .filter((a) => (lastNudge.get(a.uid) || 0) < a.lastActive)
      // Most recently active first: they're the likeliest to come back.
      .sort((a, b) => b.lastActive - a.lastActive)
      .slice(0, NUDGE_CAP);

    if (due.length) {
      await sendBatch(due.map((a) => ({
        to: a.email,
        uid: a.uid,
        email: inactivityEmail({ uid: a.uid, name: a.childName, days: Math.floor((now - a.lastActive) / DAY) }),
      })));
      const batch = db.batch();
      const at = new Date().toISOString();
      for (const a of due) batch.set(db.collection("emailState").doc(a.uid), { lastNudgeAt: at }, { merge: true });
      await batch.commit();
    }

    const firsts = accounts
      .filter((a) => !unsubscribed.has(a.uid) && !a.played && !firstSent.has(a.uid))
      .filter((a) => now - a.createdAt >= FIRST_MIN_HOURS * 60 * 60 * 1000 && now - a.createdAt <= FIRST_MAX_DAYS * DAY)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, FIRST_CAP);
    if (firsts.length) {
      await sendBatch(firsts.map((a) => ({ to: a.email, uid: a.uid, email: firstRoundEmail({ uid: a.uid }) })));
      const batch = db.batch();
      const at = new Date().toISOString();
      for (const a of firsts) batch.set(db.collection("emailState").doc(a.uid), { firstRoundSentAt: at }, { merge: true });
      await batch.commit();
    }
    res.status(200).json({ nudged: due.length, firstRound: firsts.length });
  } catch (e) {
    console.error("inactivity cron:", e.message);
    res.status(500).json({ error: e.message });
  }
}
