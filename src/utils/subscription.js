// Stripe subscriptions via the official Firebase "Run Payments with Stripe"
// extension (firestore-stripe-payments). The extension is the backend: it
// listens to Firestore, creates Checkout Sessions, and writes each user's live
// subscription state to  customers/{uid}/subscriptions/*. This file just reads
// that state and kicks off Checkout / the billing portal — no server code here.
import { collection, addDoc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";

// Price IDs come from your Stripe dashboard (price_...), set as Vercel env vars.
// Until they're set, the paywall still renders but Checkout is disabled.
export const PRICES = {
  monthly: (import.meta.env.VITE_STRIPE_PRICE_MONTHLY || "").trim(),
  annual:  (import.meta.env.VITE_STRIPE_PRICE_ANNUAL  || "").trim(),
};
export const stripeConfigured = !!(PRICES.monthly || PRICES.annual);

// Statuses that grant access. "trialing" covers the 7-day free trial.
const ACTIVE = new Set(["active", "trialing"]);

// Live-watch the signed-in user's subscription docs. Fires the callback with
// { isPremium, sub } and again whenever Stripe pushes an update (renewal,
// cancellation, payment failure). Returns an unsubscribe function.
export function watchSubscription(uid, cb) {
  const col = collection(db, "customers", uid, "subscriptions");
  return onSnapshot(
    col,
    (snap) => {
      let active = null;
      snap.forEach((d) => {
        const s = d.data();
        if (ACTIVE.has(s.status)) active = { id: d.id, ...s };
      });
      cb({ isPremium: !!active, sub: active });
    },
    (err) => {
      // No customer doc yet, or rules deny before the extension provisions —
      // treat as "not subscribed" rather than crashing the app.
      console.error("subscription watch failed:", err);
      cb({ isPremium: false, sub: null });
    }
  );
}

// Create a Checkout Session (the extension fills in `url`), then redirect to
// Stripe's hosted, PCI-compliant checkout. Never handles card details ourselves.
export async function startCheckout(uid, priceId) {
  if (!priceId) throw new Error("No Stripe price configured");
  const ref = await addDoc(collection(db, "customers", uid, "checkout_sessions"), {
    price: priceId,
    allow_promotion_codes: true,
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  });
  return new Promise((resolve, reject) => {
    const unsub = onSnapshot(ref, (snap) => {
      const { error, url } = snap.data() || {};
      if (error) { unsub(); reject(new Error(error.message)); }
      if (url)   { unsub(); window.location.assign(url); resolve(url); }
    });
  });
}

// Stripe Customer Portal — lets a parent update card, view invoices or cancel.
// Backed by the extension's callable function.
export async function openBillingPortal() {
  const fn = httpsCallable(functions, "ext-firestore-stripe-payments-createPortalLink");
  const { data } = await fn({ returnUrl: window.location.origin });
  window.location.assign(data.url);
}
