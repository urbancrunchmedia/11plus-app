// Verify a Firebase ID token in a serverless function WITHOUT the Firebase Admin
// SDK — validate the RS256 JWT against Google's public keys. Returns { uid, email }.
import { createRemoteJWKSet, jwtVerify } from "jose";

const projectId = process.env.VITE_FIREBASE_PROJECT_ID;

// Google's JWKS for Firebase Auth ID tokens.
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

export async function verifyToken(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Not signed in");
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  return { uid: payload.sub, email: payload.email };
}
