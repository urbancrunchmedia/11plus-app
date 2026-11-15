// GET /api/admin/owner -> numbers for the private owner dashboard (/owner).
// Only for the owners' accounts, and only once that email is verified: an
// unverified email/password sign-up using an owner's address must not get in.
// The admin key (ADMIN_SECRET) is accepted too, for the owner's tooling.
import { checkOwner } from "../../server/ownerAuth.js";
import { ownerStats } from "../../server/ownerStats.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const auth = await checkOwner(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  try {
    res.status(200).json(await ownerStats());
  } catch (e) {
    console.error("owner stats:", e.message);
    res.status(500).json({ error: "Couldn't load the numbers. Please try again." });
  }
}
