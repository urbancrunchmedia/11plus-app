// GET /api/admin/owner -> numbers for the private owner dashboard (/owner).
// POST { action: "setComp", uid, on } -> give or remove complimentary access.
// Only for the owners' accounts, and only once that email is verified: an
// unverified email/password sign-up using an owner's address must not get in.
// The admin key (ADMIN_SECRET) is accepted too, for the owner's tooling.
import { checkOwner } from "../../server/ownerAuth.js";
import { ownerStats } from "../../server/ownerStats.js";
import { setDashboardComp } from "../../server/compAccess.js";
import { adminAuth } from "../../server/firebaseAdmin.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const auth = await checkOwner(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  // POST { action: "setComp", uid, on } gives or removes complimentary Full Access.
  if (req.method === "POST") {
    const { action, uid, on } = req.body || {};
    if (action !== "setComp" || typeof uid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(uid) || typeof on !== "boolean") {
      return res.status(400).json({ error: "Unknown request" });
    }
    let user;
    try { user = await adminAuth().getUser(uid); } catch { return res.status(404).json({ error: "No such account" }); }
    try {
      await setDashboardComp(uid, on, user);
      return res.status(200).json({ ok: true, complimentary: on });
    } catch (e) {
      console.error("setComp:", e.message);
      return res.status(500).json({ error: "Couldn't save that. Please try again." });
    }
  }
  try {
    res.status(200).json(await ownerStats());
  } catch (e) {
    console.error("owner stats:", e.message);
    res.status(500).json({ error: "Couldn't load the numbers. Please try again." });
  }
}
