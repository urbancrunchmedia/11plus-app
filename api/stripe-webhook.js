// POST /api/stripe-webhook  (called by Stripe, not the app)
// Handles customer.subscription.trial_will_end, which Stripe sends 3 days
// before a trial ends, by emailing the customer a reminder.
import { getStripe } from "../server/stripe.js";
import { sendEmail, trialEndingEmail } from "../server/email.js";

// Signature checks need the exact bytes Stripe sent, not a parsed body.
export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      await rawBody(req),
      req.headers["stripe-signature"],
      (process.env.STRIPE_WEBHOOK_SECRET || "").trim()
    );
  } catch (e) {
    console.error("stripe webhook signature:", e.message);
    return res.status(400).send(`Webhook error: ${e.message}`);
  }

  try {
    if (event.type === "customer.subscription.trial_will_end") {
      const sub = event.data.object;
      // Skip a trial that's already set to cancel: they've decided, no need to warn them.
      if (!sub.cancel_at_period_end && sub.trial_end) {
        const customer = await stripe.customers.retrieve(sub.customer);
        if (customer.email && !customer.deleted) {
          await sendEmail({
            to: customer.email,
            email: trialEndingEmail({ trialEnd: sub.trial_end * 1000 }),
            // Stripe retries webhooks; this stops a retry sending a second copy.
            idempotencyKey: `trial-end-${event.id}`,
          });
        }
      }
    }
    res.status(200).json({ received: true });
  } catch (e) {
    console.error("stripe webhook:", e.message);
    // 500 makes Stripe retry later, which is what we want if Resend was briefly down.
    res.status(500).json({ error: e.message });
  }
}
