// Who may use the owner-only tools: the owners' own accounts, once that email
// is verified (an unverified email/password sign-up using an owner's address
// must not get in), or the admin key (ADMIN_SECRET) for the owner's tooling.
import { verifyToken } from "./verifyToken.js";
import { hasBearer } from "./bearer.js";

export const OWNER_EMAILS = new Set(["urbancrunchmedia@gmail.com", "reuben.dongre@gmail.com"]);

// -> { ok: true } or { ok: false, status, error }
export async function checkOwner(req) {
  if (hasBearer(req, "ADMIN_SECRET")) return { ok: true };
  let who;
  try { who = await verifyToken(req); } catch { return { ok: false, status: 401, error: "signin" }; }
  if (!OWNER_EMAILS.has((who.email || "").toLowerCase())) return { ok: false, status: 403, error: "forbidden" };
  if (!who.emailVerified) return { ok: false, status: 403, error: "verify" };
  return { ok: true };
}
