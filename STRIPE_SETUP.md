# Turning on subscriptions

The app code is done. Payments run through the official **Firebase "Run Payments
with Stripe" extension** — it's the backend, so there's no server for us to host.
These are the account steps only you can do. Budget ~45 minutes.

The app is safe to ship before this is finished: with no price IDs set, everyone
stays on the free tier and the paywall shows a gentle "billing setup pending".

---

## 1. Stripe account (~10 min)
1. Create/sign in at https://dashboard.stripe.com and finish business verification
   (needed before you can accept live payments; test mode works immediately).
2. **Products → Add product**: name it `11 Plus Study — Full Access`.
3. Add **two recurring prices** to that one product:
   - **Monthly** — £4.99 / month
   - **Annual** — £34.99 / year
4. On each price, set a **7-day free trial** (Price → "Add free trial", 7 days).
5. Copy each price ID (looks like `price_1AbC...`).
6. **Settings → Tax**: enable **Stripe Tax** so UK VAT is handled automatically.
7. **Settings → Billing → Customer portal**: enable it and allow "cancel
   subscription" so parents can self-serve.

## 2. Install the Firebase extension (~15 min)
1. Firebase console → your project → **Extensions** → find
   **"Run Payments with Stripe"** (a.k.a. `firestore-stripe-payments`) → Install.
2. During config:
   - Paste your Stripe **restricted/secret API key**.
   - Products/prices collections: keep defaults (`products`, `customers`).
   - "Sync new users to Stripe automatically": **Yes**.
   - "Automatically delete Stripe customer objects": your choice (No is fine).
3. After install, the extension shows a **webhook URL** — go to Stripe
   **Developers → Webhooks → Add endpoint**, paste it, and subscribe to the
   events the extension lists (checkout, customer, subscription, invoice, price,
   product events). Copy the signing secret back into the extension config.
4. In Stripe, run the extension's product-sync (or edit/save each price once) so
   `products` + `prices` mirror into Firestore.

## 3. Firestore security rules
The extension needs these (merge into `firestore.rules`, then deploy):

```
match /customers/{uid} {
  allow read: if request.auth.uid == uid;
  match /checkout_sessions/{id} {
    allow read, write: if request.auth.uid == uid;
  }
  match /subscriptions/{id} { allow read: if request.auth.uid == uid; }
  match /payments/{id}      { allow read: if request.auth.uid == uid; }
}
match /products/{id} {
  allow read: if true;
  match /prices/{id} { allow read: if true; }
}
```

## 4. Environment variables (~5 min)
Add the two price IDs everywhere the app builds:

- **Local**: copy `.env.example` → `.env`, fill `VITE_STRIPE_PRICE_MONTHLY`
  and `VITE_STRIPE_PRICE_ANNUAL`.
- **Vercel**: Project → Settings → Environment Variables → add the same two
  (Production + Preview), then redeploy.

## 5. Test it end to end
1. Start Stripe in **test mode**; use test card `4242 4242 4242 4242`, any future
   expiry/CVC.
2. In the app: Settings → **Upgrade**, or pick Level B → the paywall opens.
3. Complete Checkout → you're redirected back → within a second the app flips to
   Full Access (the `customers/{uid}/subscriptions` doc appears as `trialing`).
4. Settings → **Manage billing** should open the Stripe customer portal.
5. Cancel in the portal → the app drops back to free on the next snapshot.

### Preview premium without Stripe
In the browser console: `localStorage.setItem("11plus_dev_premium","1")` then
reload. Set back to `"0"` (or remove it) to return to free. Dev only.

---

## What's already wired in the app
- `src/utils/subscription.js` — reads live subscription state, starts Checkout,
  opens the billing portal (all via the extension; no server code).
- `src/utils/entitlement.js` — the free/paid line: **Level A + 8 rounds/day free**,
  everything else premium. Tune the numbers here.
- `src/contexts/PremiumContext.jsx` — `isPremium` + the paywall controller.
- `src/components/Paywall.jsx` — the upgrade modal (monthly/annual, 7-day trial).
- Gates: level selectors (Home/Punctuation) + the round choke point in `App.jsx`;
  the Full Access card in Settings.

## Notes
- This is **web billing** → 100% of revenue is yours. If you later wrap it in an
  iOS/Android app-store build, Apple/Google require their in-app purchase and take
  15–30% — keep web-first.
- Add a **Privacy Policy** and **Terms** before taking live payments (you store a
  child's data — worth a proper UK-GDPR-aware notice). Link them from Settings.
