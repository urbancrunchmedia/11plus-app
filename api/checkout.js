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
    // Only our two plans: never a price ID chosen by the browser (an old or
    // cheaper price in the same Stripe account would otherwise work too).
    const allowed = [process.env.VITE_STRIPE_PRICE_MONTHLY, process.env.VITE_STRIPE_PRICE_ANNUAL].map((v) => (v || "").trim()).filter(Boolean);
    if (!allowed.includes(String(priceId).trim())) return res.status(400).json({ error: "Unknown plan" });

    const stripe = getStripe();
    const customer = await findOrCreateCustomer(stripe, uid, email);
    const origin = req.headers.origin || `https://${req.headers.host}`;

    // One subscription per family. A second checkout while one is running
    // would charge them twice (it happened once, Nov 2026, during a trial).
    const prior = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 20 });
    const live = prior.data.filter((x) => ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(x.status));
    const running = live.find((x) => !x.cancel_at_period_end);
    if (running) {
      return res.status(409).json({ error: "already_subscribed", message: "You already have Full Access on this account, so there's nothing more to pay. Manage it in Settings → Manage billing." });
    }
    // Cancelled but still in the paid-up period: switch the renewal back on
    // instead of starting (and charging for) a second subscription.
    const ending = live.find((x) => x.cancel_at_period_end);
    if (ending) {
      await stripe.subscriptions.update(ending.id, { cancel_at_period_end: false });
      return res.status(200).json({ resumed: true });
    }

    // The free trial is ONCE per customer. Without this, someone could cancel
    // before day 7 and resubscribe forever without ever paying.
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
