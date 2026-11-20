// Does the request carry "Authorization: Bearer <secret>" for this env var?
// Constant-time, so response timing can't reveal how much of a guess was right.
import { createHash, timingSafeEqual } from "crypto";

export function hasBearer(req, envName) {
  const secret = (process.env[envName] || "").trim();
  const header = String(req.headers?.authorization || "");
  if (!secret || !header.startsWith("Bearer ")) return false;
  const digest = (v) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(secret));
}
