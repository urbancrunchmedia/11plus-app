// GET /api/status -> { isPremium }
// Live check against Stripe for an active or trialing subscription. Fails safe
// to false (free) on any error.
import { getStripe, findCustomer } from "../server/stripe.js";
import { verifyToken } from "../server/verifyToken.js";

export default async function handler(req, res) {
  try {
    const { uid } = await verifyToken(req);
    const stripe = getStripe();
    const customer = await findCustomer(stripe, uid);
    if (!customer) return res.status(200).json({ isPremium: false });

    const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 10 });
    const isPremium = subs.data.some((s) => s.status === "active" || s.status === "trialing");
    res.status(200).json({ isPremium });
  } catch (e) {
    res.status(200).json({ isPremium: false, error: e.message });
  }
}
