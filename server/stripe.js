import Stripe from "stripe";

let _stripe;
export function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
  return _stripe;
}

// Map a Firebase user to a Stripe customer via metadata (no extra datastore).
export async function findCustomer(stripe, uid) {
  const res = await stripe.customers.search({ query: `metadata['firebaseUID']:'${uid}'`, limit: 1 });
  return res.data[0] || null;
}

export async function findOrCreateCustomer(stripe, uid, email) {
  const existing = await findCustomer(stripe, uid);
  if (existing) return existing;
  return stripe.customers.create({ email: email || undefined, metadata: { firebaseUID: uid } });
}
