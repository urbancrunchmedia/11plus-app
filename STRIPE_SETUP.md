# Stripe billing (Vercel serverless functions)

Billing runs through three Vercel functions that verify the Firebase login and
talk to your existing Stripe account. No Firebase extension, no webhook, no
service account — subscription status is read live from Stripe.

- `api/checkout.js` — creates a Checkout Session (7-day trial) → redirects.
- `api/status.js`   — returns `{ isPremium }` (active or trialing subscription).
- `api/portal.js`   — opens the Stripe Customer Portal (manage / cancel).
- `server/verifyToken.js` — validates the Firebase ID token via Google's JWKS.
- Client: `src/utils/subscription.js` + `PremiumContext` call these.

## What's already done
- Product + two prices created in Stripe (monthly £4.99, annual £34.99, 7-day trial).
- `VITE_STRIPE_PRICE_MONTHLY` / `VITE_STRIPE_PRICE_ANNUAL` set in Vercel + local `.env`.

## What you still need to do (one secret + two toggles)

1. **Add the Stripe secret key to Vercel** (Project → Settings → Environment
   Variables):
   - **Name:** `STRIPE_SECRET_KEY`
   - **Value:** your account's secret key — **matching the mode of the prices**
     (test prices → `sk_test_…`, live prices → `sk_live_…`).
   - **Environments:** Production (also Preview if you use preview URLs).
   Redeploy after adding it (env changes need a new deploy).

2. **Activate the Customer Portal** in Stripe → Settings → Billing → Customer
   portal → Activate, and allow "Cancel subscription". (Needed for `/api/portal`.)

3. **Firebase authorized domains** — add `11pluslab.com` and `www.11pluslab.com`
   in Firebase console → Authentication → Settings → Authorized domains, or
   sign-in breaks on the custom domain.

## Test it
- Test mode: card `4242 4242 4242 4242`, any future expiry/CVC.
- Settings → **Upgrade** (or pick Level B) → paywall → checkout → you're
  redirected back and the app flips to Full Access within a moment.
- Settings → **Manage billing** opens the portal; cancel there → the app drops
  back to free on the next load.

### Preview premium without paying
Console: `localStorage.setItem("11plus_dev_premium","1")`, reload. `"0"` to undo.

## Notes
- Web billing → 100% yours. An app-store wrapper would owe Apple/Google 15–30%.
- Add a Privacy Policy + Terms before taking live payments.
- Comp access: emails in `COMP_EMAILS` (PremiumContext) always get Full Access.
