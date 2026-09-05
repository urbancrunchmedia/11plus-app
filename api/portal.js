// POST /api/portal -> { url }
// Opens the Stripe Customer Portal (manage/cancel) for the signed-in user.
import { getStripe, findCustomer } from "../server/stripe.js";
import { verifyToken } from "../server/verifyToken.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { uid } = await verifyToken(req);
    const stripe = getStripe();
    const customer = await findCustomer(stripe, uid);
    if (!customer) return res.status(400).json({ error: "No billing account yet" });

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const session = await stripe.billingPortal.sessions.create({ customer: customer.id, return_url: origin });
    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(400).json({ error: e.message || "Could not open billing portal" });
  }
}
