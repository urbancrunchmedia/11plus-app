// /api/admin/outreach — emailing UK 11+ tuition centres (B2B), each with its
// own Stripe promotion code (20% off a family's first paid month).
//
// POST, Authorization: Bearer <ADMIN_SECRET>, body { action, ... }:
//   { action: "setup" }                         create the shared coupon (idempotent)
//   { action: "import", prospects: [{ business, location, email, code }] }
//                                               create each centre's promo code and queue it
//   { action: "test", to, business, code }      send one sample to `to` (nothing is queued)
//   { action: "start" } / { action: "pause" }   switch the daily send on/off
//   { action: "send", limit? }                  send the next batch now
//   { action: "status" }                        counts, plus redemptions per code
//   { action: "verify" }                        check every queued centre's code in Stripe
// GET from Vercel Cron (Authorization: Bearer <CRON_SECRET>): sends the next
// batch, but only once "start" has been called.
import { getStripe } from "../../server/stripe.js";
import { adminDb } from "../../server/firebaseAdmin.js";
import { sendEmail, outreachEmail, outreachKey, OUTREACH_FROM } from "../../server/email.js";

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
      const enabled = (await config.get()).data()?.enabled === true;
      if (!enabled) return res.status(200).json({ skipped: "paused" });
      return res.status(200).json(await sendBatch(db, DAILY_LIMIT));
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
            await ref.set({ business: clean(p.business), location: clean(p.location), email, code, promoId: promo.id, status: "queued", importedAt: new Date().toISOString() });
            out.push({ email, code, status: "queued" });
          } catch (e) {
            out.push({ email, code, error: e.message });
          }
        }
        return res.status(200).json({ imported: out.filter((o) => o.status === "queued").length, results: out });
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
        const queued = await db.collection("outreach").where("status", "==", "queued").get();
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
      case "debug": {
        // Temporary: inspect a code and make two throwaway test codes on the same coupon.
        const found = (await stripe.promotionCodes.list({ code: body.code || "PRESTIGE20", limit: 1, expand: ["data.coupon"] })).data[0];
        const mk = async (code, first) => {
          const ex = (await stripe.promotionCodes.list({ code, limit: 1 })).data[0];
          return ex || stripe.promotionCodes.create({ coupon: COUPON_ID, code, ...(first ? { restrictions: { first_time_transaction: true } } : {}) });
        };
        let pct;
        try { pct = await stripe.coupons.retrieve("pl-debug-pct-10"); } catch { pct = await stripe.coupons.create({ id: "pl-debug-pct-10", percent_off: 10, duration: "once", name: "Debug 10%" }); }
        const pctCode = (await stripe.promotionCodes.list({ code: "PLTESTPCT10", limit: 1 })).data[0] || await stripe.promotionCodes.create({ coupon: pct.id, code: "PLTESTPCT10" });
        const price = await stripe.prices.retrieve(clean(process.env.VITE_STRIPE_PRICE_MONTHLY));
        const allPromos = (await stripe.promotionCodes.list({ limit: 5, active: true })).data.map((p) => p.code);
        const a = await mk("PLTESTOPEN20", false);
        const b = await mk("PLTESTFIRST20", true);
        return res.status(200).json({
          found: found && { code: found.code, active: found.active, livemode: found.livemode, restrictions: found.restrictions, coupon: found.coupon && { id: found.coupon.id, valid: found.coupon.valid, amount_off: found.coupon.amount_off, currency: found.coupon.currency, applies_to: found.coupon.applies_to, redeem_by: found.coupon.redeem_by, max_redemptions: found.coupon.max_redemptions } },
          tests: [a.code, b.code, pctCode.code],
          price: { id: price.id, currency: price.currency, unit_amount: price.unit_amount, livemode: price.livemode, product: price.product },
          somePromos: allPromos,
        });
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
