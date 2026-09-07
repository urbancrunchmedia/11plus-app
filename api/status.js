// GET /api/status -> { isPremium, status, cancelAtPeriodEnd, currentPeriodEnd, trialEnd, interval }
// Live check against Stripe. Fails safe to false (free) on any error.
import { getStripe, findCustomer, summarise } from "../server/stripe.js";
import { verifyToken } from "../server/verifyToken.js";

export default async function handler(req, res) {
  // Never let a CDN/browser cache a subscription state.
  res.setHeader("Cache-Control", "no-store");
  try {
    const { uid, email } = await verifyToken(req);
    const stripe = getStripe();
    const customer = await findCustomer(stripe, uid, email);
    if (!customer) return res.status(200).json({ isPremium: false, status: "none" });

    const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 10 });
    res.status(200).json(summarise(subs.data));
  } catch (e) {
    res.status(200).json({ isPremium: false, status: "none", error: e.message });
  }
}
