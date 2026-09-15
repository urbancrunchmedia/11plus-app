import Stripe from "stripe";

let _stripe;
export function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
  return _stripe;
}

// Map a Firebase user to a Stripe customer via metadata (no extra datastore).
//
// IMPORTANT: customers.search runs on Stripe's search index, which lags by up to
// ~a minute after a customer is created. Relying on it alone made a brand-new
// subscriber look "not premium" right after checkout. customers.list is strongly
// consistent, so we look up by email first and only fall back to search.
export async function findCustomer(stripe, uid, email) {
  if (email) {
    const byEmail = await stripe.customers.list({ email, limit: 100 });
    const match = byEmail.data.find((c) => c.metadata?.firebaseUID === uid);
    if (match) return match;
  }
  try {
    const res = await stripe.customers.search({ query: `metadata['firebaseUID']:'${uid}'`, limit: 1 });
    if (res.data[0]) return res.data[0];
  } catch (e) {
    // Logged, not swallowed silently — this shouldn't happen often, and the
    // fallback below is what keeps it from mattering when it does.
    console.error("customers.search unavailable, falling back to a full scan:", e.message);
  }
  // Last resort. Reached only if BOTH lookups above missed — most likely a
  // real paying customer whose Firebase email no longer matches what's on
  // file in Stripe (changed email, switched sign-in provider), landing here
  // during whatever moment the search index above is also lagging or down.
  // Without this, they'd wrongly look unsubscribed and checkout would hand
  // them a second free trial on a disconnected new customer. Stripe has no
  // way to filter customers.list by metadata, so this scans — bounded, so a
  // large customer base can't stall this request chasing a customer that
  // was never going to turn up (a genuinely new customer, not a lookup miss).
  let startingAfter;
  for (let page = 0; page < 5; page++) {
    const batch = await stripe.customers.list({ limit: 100, starting_after: startingAfter });
    const match = batch.data.find((c) => c.metadata?.firebaseUID === uid);
    if (match) return match;
    if (!batch.has_more) break;
    startingAfter = batch.data[batch.data.length - 1]?.id;
  }
  return null;
}

export async function findOrCreateCustomer(stripe, uid, email) {
  const existing = await findCustomer(stripe, uid, email);
  if (existing) {
    // Keep the Stripe customer's email in step with the signed-in account, so
    // Checkout never prefills a stale address from earlier testing.
    if (email && existing.email !== email) {
      try { return await stripe.customers.update(existing.id, { email }); } catch { return existing; }
    }
    return existing;
  }
  return stripe.customers.create({ email: email || undefined, metadata: { firebaseUID: uid } });
}

// The subscription that grants access, plus what the UI needs to explain it.
export function summarise(subs) {
  const live = subs.find((s) => s.status === "active" || s.status === "trialing");
  const sub = live || subs.find((s) => s.status === "past_due") || null;
  if (!sub) return { isPremium: false, status: "none" };
  return {
    isPremium: sub.status === "active" || sub.status === "trialing",
    status: sub.status,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    currentPeriodEnd: sub.current_period_end ? sub.current_period_end * 1000 : null,
    trialEnd: sub.trial_end ? sub.trial_end * 1000 : null,
    interval: sub.items?.data?.[0]?.price?.recurring?.interval || null,
  };
}
