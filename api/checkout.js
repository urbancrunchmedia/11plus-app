// POST /api/checkout  { priceId }  -> { url }
// Creates a Stripe Checkout Session (7-day trial) for the signed-in user.
import { getStripe, findOrCreateCustomer } from "../server/stripe.js";
import { verifyToken } from "../server/verifyToken.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { uid, email } = await verifyToken(req);
    const { priceId } = req.body || {};
    if (!priceId) return res.status(400).json({ error: "Missing price" });

    const stripe = getStripe();
    const customer = await findOrCreateCustomer(stripe, uid, email);
    const origin = req.headers.origin || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: 7 },
      allow_promotion_codes: true,
      client_reference_id: uid,
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
    });
    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(400).json({ error: e.message || "Checkout failed" });
  }
}
