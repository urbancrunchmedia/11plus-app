// /api/admin/outreach — emailing UK 11+ tuition centres (B2B), each with its
// own Stripe promotion code (20% off a family's first paid month).
//
// POST, Authorization: Bearer <ADMIN_SECRET>, body { action, ... }:
//   { action: "setup" }                         create the shared coupon (idempotent)
//   { action: "import", prospects: [{ business, location, email, code }], manual? }
//                                               create each centre's promo code and queue it;
//                                               manual: true = code only, the owner emails them personally
//   { action: "test", to, business, code }      send one sample to `to` (nothing is queued)
//   { action: "start" } / { action: "pause" }   switch the daily send on/off
//   { action: "send", limit? }                  send the next batch now
//   { action: "status" }                        counts, plus redemptions per code
//   { action: "verify" }                        check every queued centre's code in Stripe
//   { action: "tutorTest", to, business?, code?, email? }   one sample of the tutor invitation
//   { action: "tutorQueue", include? }          queue the tutor invitation for every centre emailed
//                                               (not manual/sole-trader rows, opt-outs or existing tutors);
//                                               `include`: extra emails to queue whatever their status
//   { action: "tutorStart" } / { action: "tutorPause" }   daily sending of tutor invitations on/off
//   { action: "tutorStatus" }                   tutor-invitation counts
// GET from Vercel Cron (Authorization: Bearer <CRON_SECRET>): sends the next
// batch, but only once "start" has been called.
import { getStripe } from "../../server/stripe.js";
import { adminDb } from "../../server/firebaseAdmin.js";
import { sendEmail, outreachEmail, tutorInviteEmail, outreachKey, OUTREACH_FROM } from "../../server/email.js";

const COUPON_ID = "tuition-centre-first-month";
const DAILY_LIMIT = 30; // new domain: keep cold email slow and steady
const clean = (v) => String(v || "").trim();

// 20% off for one month from sign-up. Not "once": with the 7-day trial the
// first invoice is the £0 trial one, which would use a "once" coupon up.
// Monthly and annual are prices on the same product, so a coupon can't be
// limited to the monthly plan. A fixed amount equal to 20% of the monthly
// price (£4.99 -> £3.99) keeps the promise exact for monthly, and only takes
// the same £1 off an annual plan instead of 20% of the whole year.
async function ensureCoupon(stripe) {
  try {
    return await stripe.coupons.retrieve(COUPON_ID);
  } catch (e) {
    if (e.code !== "resource_missing") throw e;
  }
  const monthly = await stripe.prices.retrieve(clean(process.env.VITE_STRIPE_PRICE_MONTHLY));
  return stripe.coupons.create({
    id: COUPON_ID,
    name: "Tuition centre: 20% off first month",
    amount_off: Math.round(monthly.unit_amount * 0.2),
    currency: monthly.currency,
    duration: "repeating",
    duration_in_months: 1,
  });
}

// The first version was 20% of anything, annual included. Remove it while unused.
async function retireOldCoupon(stripe) {
  try {
    const old = await stripe.coupons.retrieve("tuition-centre-20-first-month");
    if (old.times_redeemed === 0) await stripe.coupons.del(old.id);
  } catch { /* already gone */ }
}

async function ensurePromoCode(stripe, { code, business, email }) {
  const existing = await stripe.promotionCodes.list({ code, limit: 1 });
  const found = existing.data.find((p) => p.active);
  if (found) {
    const couponId = typeof found.coupon === "string" ? found.coupon : found.coupon?.id;
    if (couponId !== COUPON_ID) throw new Error(`Code ${code} already exists for a different offer`);
    return found;
  }
  return stripe.promotionCodes.create({
    coupon: COUPON_ID,
    code,
    restrictions: { first_time_transaction: true },
    metadata: { centre: business.slice(0, 200), email },
  });
}

async function sendBatch(db, limit) {
  const queued = await db.collection("outreach").where("status", "==", "queued").limit(limit).get();
  let sent = 0, skipped = 0, failed = 0;
  for (const doc of queued.docs) {
    const p = doc.data();
    // Opt-outs are stored separately so they survive a re-import of the list.
    if ((await db.collection("outreachOptOut").doc(doc.id).get()).exists) {
      await doc.ref.update({ status: "optedOut" });
      skipped++;
      continue;
    }
    try {
      await sendEmail({
        to: p.email,
        from: OUTREACH_FROM,
        email: outreachEmail(p),
        idempotencyKey: `outreach-${doc.id}`,
      });
      await doc.ref.update({ status: "sent", sentAt: new Date().toISOString() });
      sent++;
    } catch (e) {
      await doc.ref.update({ status: "failed", error: String(e.message).slice(0, 300) });
      failed++;
    }
    await new Promise((r) => setTimeout(r, 600)); // stay well under Resend's rate limit
  }
  return { sent, skipped, failed };
}

// Already a tutor (applied with that email, or the same business domain)?
async function tutorEmails(db) {
  const tutors = await db.collection("tutors").get();
  const emails = new Set(), domains = new Set();
  for (const t of tutors.docs) {
    const e = String(t.get("email") || "").toLowerCase();
    emails.add(e);
    domains.add(e.split("@")[1]);
  }
  return { emails, domains };
}

async function sendTutorInvites(db, limit) {
  const queued = await db.collection("outreach").where("tutorInvite", "==", "queued").limit(limit).get();
  const { emails, domains } = await tutorEmails(db);
  let sent = 0, skipped = 0, failed = 0;
  for (const doc of queued.docs) {
    const p = doc.data();
    const domain = String(p.email).split("@")[1];
    const optedOut = (await db.collection("outreachOptOut").doc(doc.id).get()).exists;
    if (optedOut || emails.has(p.email) || domains.has(domain)) {
      await doc.ref.update({ tutorInvite: optedOut ? "optedOut" : "alreadyTutor" });
      skipped++;
      continue;
    }
    try {
      await sendEmail({ to: p.email, from: OUTREACH_FROM, email: tutorInviteEmail(p), idempotencyKey: `tutor-invite-${doc.id}` });
      await doc.ref.update({ tutorInvite: "sent", tutorInviteSentAt: new Date().toISOString() });
      sent++;
    } catch (e) {
      await doc.ref.update({ tutorInvite: "failed", tutorInviteError: String(e.message).slice(0, 300) });
      failed++;
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return { sent, skipped, failed };
}

export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  const admin = clean(process.env.ADMIN_SECRET) && auth === `Bearer ${clean(process.env.ADMIN_SECRET)}`;
  const cron = clean(process.env.CRON_SECRET) && auth === `Bearer ${clean(process.env.CRON_SECRET)}`;
  if (!admin && !cron) return res.status(401).json({ error: "Unauthorized" });

  const db = adminDb();
  const config = db.collection("outreachConfig").doc("main");
  try {
    if (req.method === "GET") {
      if (!cron) return res.status(405).json({ error: "Use POST" });
      const cfg = (await config.get()).data() || {};
      const out = {};
      out.outreach = cfg.enabled === true ? await sendBatch(db, DAILY_LIMIT) : "paused";
      // Tutor invitations use whatever is left of the day's allowance.
      const left = DAILY_LIMIT - ((out.outreach.sent || 0) + (out.outreach.failed || 0));
      out.tutorInvites = cfg.tutorInvites === true && left > 0 ? await sendTutorInvites(db, left) : "paused";
      return res.status(200).json(out);
    }
    if (!admin) return res.status(401).json({ error: "Unauthorized" });
    const body = req.body || {};
    const stripe = getStripe();

    switch (body.action) {
      case "setup": {
        await retireOldCoupon(stripe);
        const c = await ensureCoupon(stripe);
        return res.status(200).json({ coupon: c.id, amount_off: c.amount_off, currency: c.currency, duration: c.duration, months: c.duration_in_months });
      }
      case "import": {
        await ensureCoupon(stripe);
        const out = [];
        for (const p of body.prospects || []) {
          const email = clean(p.email).toLowerCase();
          const code = clean(p.code).toUpperCase();
          if (!email.includes("@") || !/^[A-Z0-9]{3,20}$/.test(code)) { out.push({ email, error: "bad email or code" }); continue; }
          const ref = db.collection("outreach").doc(outreachKey(email));
          const snap = await ref.get();
          if (snap.exists) { out.push({ email, code: snap.data().code, status: snap.data().status, note: "already imported" }); continue; }
          try {
            const promo = await ensurePromoCode(stripe, { code, business: clean(p.business), email });
            const status = body.manual ? "manual" : "queued";
            await ref.set({ business: clean(p.business), location: clean(p.location), email, code, promoId: promo.id, status, importedAt: new Date().toISOString() });
            out.push({ email, code, status });
          } catch (e) {
            out.push({ email, code, error: e.message });
          }
        }
        return res.status(200).json({ imported: out.filter((o) => o.status === "queued" || o.status === "manual").length, results: out });
      }
      case "test": {
        if (!body.to) return res.status(400).json({ error: "Missing to" });
        const email = outreachEmail({ business: body.business || "Sample Tuition", email: body.to, code: body.code || "SAMPLE20" });
        await sendEmail({ to: body.to, from: OUTREACH_FROM, email: { ...email, subject: `[TEST] ${email.subject}` } });
        return res.status(200).json({ test: true, to: body.to });
      }
      case "start":
      case "pause":
        await config.set({ enabled: body.action === "start", updatedAt: new Date().toISOString() }, { merge: true });
        return res.status(200).json({ enabled: body.action === "start" });
      case "send":
        return res.status(200).json(await sendBatch(db, Math.min(Number(body.limit) || DAILY_LIMIT, DAILY_LIMIT)));
      case "verify": {
        // Every queued centre's code must exist in Stripe, be active, match the
        // email exactly, be first-time-only and point at the outreach coupon.
        const queued = await db.collection("outreach").where("status", "in", ["queued", "manual"]).get();
        const problems = [];
        for (const d of queued.docs) {
          const p = d.data();
          try {
            const promo = await stripe.promotionCodes.retrieve(p.promoId);
            const couponId = typeof promo.coupon === "string" ? promo.coupon : promo.coupon?.id;
            const issue =
              !promo.active ? "inactive" :
              promo.code.toUpperCase() !== p.code ? `code mismatch (${promo.code})` :
              couponId !== COUPON_ID ? `wrong coupon (${couponId})` :
              !promo.restrictions?.first_time_transaction ? "not first-time-only" : null;
            if (issue) problems.push({ business: p.business, code: p.code, issue });
          } catch (e) {
            problems.push({ business: p.business, code: p.code, issue: e.message });
          }
        }
        const coupon = await stripe.coupons.retrieve(COUPON_ID);
        return res.status(200).json({ checked: queued.size, ok: queued.size - problems.length, problems, coupon: { valid: coupon.valid, amount_off: coupon.amount_off, currency: coupon.currency, duration: coupon.duration, months: coupon.duration_in_months } });
      }
      case "tutorTest": {
        if (!body.to) return res.status(400).json({ error: "Missing to" });
        const email = tutorInviteEmail({ business: body.business || "Sample Tuition", email: body.email || body.to, code: body.code || "SAMPLE20" });
        await sendEmail({ to: body.to, from: OUTREACH_FROM, email: { ...email, subject: `[TEST] ${email.subject}` } });
        return res.status(200).json({ test: true, to: body.to });
      }
      case "tutorQueue": {
        // Centres that were emailed (status "sent"); never the manual sole-trader rows.
        const sent = await db.collection("outreach").where("status", "==", "sent").get();
        const extra = await Promise.all((Array.isArray(body.include) ? body.include : [])
          .map((e) => db.collection("outreach").doc(outreachKey(clean(e).toLowerCase())).get()));
        let queued = 0;
        const missing = [];
        for (const d of [...sent.docs, ...extra]) {
          if (!d.exists) { missing.push(d.id); continue; }
          if (d.get("tutorInvite") || d.get("status") === "optedOut") continue;
          await d.ref.update({ tutorInvite: "queued" });
          queued++;
        }
        return res.status(200).json({ queued, missing });
      }
      case "tutorStart":
      case "tutorPause":
        await config.set({ tutorInvites: body.action === "tutorStart", updatedAt: new Date().toISOString() }, { merge: true });
        return res.status(200).json({ tutorInvites: body.action === "tutorStart" });
      case "tutorStatus": {
        const all = await db.collection("outreach").get();
        const counts = {};
        for (const d of all.docs) { const k = d.get("tutorInvite") || "notQueued"; counts[k] = (counts[k] || 0) + 1; }
        return res.status(200).json({ tutorInvites: (await config.get()).data()?.tutorInvites === true, counts });
      }
      case "status": {
        const all = await db.collection("outreach").get();
        const counts = {};
        for (const d of all.docs) counts[d.data().status] = (counts[d.data().status] || 0) + 1;
        const codes = await stripe.promotionCodes.list({ coupon: COUPON_ID, limit: 100 });
        const redeemed = codes.data.filter((c) => c.times_redeemed > 0).map((c) => ({ code: c.code, centre: c.metadata?.centre, times: c.times_redeemed }));
        return res.status(200).json({ enabled: (await config.get()).data()?.enabled === true, counts, redeemed });
      }
      default:
        return res.status(400).json({ error: "Unknown action" });
    }
  } catch (e) {
    console.error("outreach:", e.message);
    res.status(500).json({ error: e.message });
  }
}
