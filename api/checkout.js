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

    // The free trial is ONCE per customer. Without this, someone could cancel
    // before day 7 and resubscribe forever without ever paying.
    const prior = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 1 });
    const trialEligible = prior.data.length === 0;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      ...(trialEligible ? { subscription_data: { trial_period_days: 7 } } : {}),
      allow_promotion_codes: true,
      client_reference_id: uid,
      // Stripe Tax: turning it on in the Dashboard only configures it — a
      // Checkout Session still has to opt in per-session, and needs a
      // billing address to know which jurisdiction's tax applies.
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      // Without this, Stripe tries to calculate tax against the *existing*
      // Customer object's address before the session even renders — for any
      // brand-new customer that's empty, and the whole session creation call
      // fails outright with "requires a valid address on the Customer" before
      // anyone sees a checkout page. This tells Stripe to use the address
      // collected in *this* session instead, and to save it going forward.
      customer_update: { address: "auto" },
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
    });
    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(400).json({ error: e.message || "Checkout failed" });
  }
}
