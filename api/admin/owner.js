// GET /api/admin/owner -> numbers for the private owner dashboard (/owner).
// Only for the owners' accounts, and only once that email is verified: an
// unverified email/password sign-up using an owner's address must not get in.
// The admin key (ADMIN_SECRET) is accepted too, for the owner's tooling.
import { verifyToken } from "../../server/verifyToken.js";
import { ownerStats } from "../../server/ownerStats.js";

const OWNER_EMAILS = new Set(["urbancrunchmedia@gmail.com", "reuben.dongre@gmail.com"]);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  // The admin key (kept off the client, used by the owner's tooling) also works.
  const admin = (process.env.ADMIN_SECRET || "").trim();
  if (admin && req.headers.authorization === `Bearer ${admin}`) {
    try {
      if (req.query?.diag === "auth") {
        // Temporary: account health check (no emails).
        const { adminAuth } = await import("../../server/firebaseAdmin.js");
        const out = [];
        let token;
        do {
          const page = await adminAuth().listUsers(1000, token);
          for (const u of page.users) out.push({ uid: u.uid.slice(0, 6), created: u.metadata.creationTime, lastSignIn: u.metadata.lastSignInTime, disabled: u.disabled, providers: u.providerData.map((p) => p.providerId), hasEmail: !!u.email });
          token = page.pageToken;
        } while (token);
        return res.status(200).json({ count: out.length, disabled: out.filter((u) => u.disabled).length, users: out });
      }
      return res.status(200).json(await ownerStats());
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }
  let who;
  try {
    who = await verifyToken(req);
  } catch {
    return res.status(401).json({ error: "signin" });
  }
  if (!OWNER_EMAILS.has((who.email || "").toLowerCase())) return res.status(403).json({ error: "forbidden" });
  if (!who.emailVerified) return res.status(403).json({ error: "verify" });
  try {
    res.status(200).json(await ownerStats());
  } catch (e) {
    console.error("owner stats:", e.message);
    res.status(500).json({ error: "Couldn't load the numbers. Please try again." });
  }
}
