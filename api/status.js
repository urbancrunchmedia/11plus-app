// GET  /api/status -> { isPremium, status, cancelAtPeriodEnd, currentPeriodEnd, trialEnd, interval }
//   Live check against Stripe. Fails safe to false (free) on any error.
// POST /api/status -> { url }  (also reached as /api/portal, see vercel.json)
//   Opens the Stripe Customer Portal (manage/cancel) for the signed-in user.
//   Shares this function because the project is at Vercel's function limit.
import { getStripe, findCustomer, summarise } from "../server/stripe.js";
import { verifyToken } from "../server/verifyToken.js";

async function portal(req, res) {
  try {
    const { uid, email } = await verifyToken(req);
    const stripe = getStripe();
    const customer = await findCustomer(stripe, uid, email);
    if (!customer) return res.status(400).json({ error: "No billing account yet" });

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const session = await stripe.billingPortal.sessions.create({ customer: customer.id, return_url: `${origin}/?billing=return` });
    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(400).json({ error: e.message || "Could not open billing portal" });
  }
}

export default async function handler(req, res) {
  // Never let a CDN/browser cache a subscription state.
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "POST") return portal(req, res);
  try {
    const { uid, email } = await verifyToken(req);
    const stripe = getStripe();
    const customer = await findCustomer(stripe, uid, email);
    if (!customer) return res.status(200).json({ isPremium: false, status: "none", trialEligible: true });

    const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 10 });
    res.status(200).json({ ...summarise(subs.data), trialEligible: subs.data.length === 0 });
  } catch (e) {
    res.status(200).json({ isPremium: false, status: "none", trialEligible: false, error: e.message });
  }
}
