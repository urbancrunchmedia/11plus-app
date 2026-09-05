// Client side of Stripe billing. The actual Stripe work happens in Vercel
// serverless functions (/api/checkout, /api/status, /api/portal) which verify
// the Firebase ID token and talk to Stripe. No secrets live in the client.
import { auth } from "../firebase";

// Price IDs (publishable identifiers) from Vercel env — safe in the client.
export const PRICES = {
  monthly: (import.meta.env.VITE_STRIPE_PRICE_MONTHLY || "").trim(),
  annual:  (import.meta.env.VITE_STRIPE_PRICE_ANNUAL  || "").trim(),
};
export const stripeConfigured = !!(PRICES.monthly || PRICES.annual);

async function authedFetch(path, body) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in first.");
  const token = await user.getIdToken();
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

// Is the signed-in user subscribed (active or in trial)? Fails safe to false.
export async function fetchPremiumStatus() {
  try {
    const { isPremium } = await authedFetch("/api/status");
    return !!isPremium;
  } catch {
    return false;
  }
}

// Start Stripe Checkout, then redirect to the hosted page.
export async function startCheckout(priceId) {
  if (!priceId) throw new Error("No Stripe price configured");
  const { url } = await authedFetch("/api/checkout", { priceId });
  if (url) window.location.assign(url);
  return url;
}

// Open the Stripe Customer Portal (update card / cancel).
export async function openBillingPortal() {
  const { url } = await authedFetch("/api/portal", {});
  if (url) window.location.assign(url);
}
