// Friend invite links: https://11pluslab.com/?friend=<friend code>
// Opening one remembers the code (through sign-up, Google redirects and
// onboarding) until the signed-in player accepts or dismisses it in
// InvitePrompt. Becoming friends always takes that one-tap confirmation.
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const KEY = "11plus_pending_invite";
const CODE = /^[A-Z0-9-]{4,16}$/;

// Call once at startup: moves ?friend=CODE from the address bar into storage.
export function captureInviteFromUrl() {
  try {
    const url = new URL(window.location.href);
    const raw = (url.searchParams.get("friend") || "").trim().toUpperCase();
    if (!raw) return;
    if (CODE.test(raw)) localStorage.setItem(KEY, raw);
    url.searchParams.delete("friend");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  } catch { /* storage or URL unavailable */ }
}

export function getPendingInvite() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function clearPendingInvite() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export const inviteLink = (code) => `${window.location.origin}/?friend=${encodeURIComponent(code)}`;

// Who an invite is from. Needs a signed-in user (codes/{code} is readable by
// any signed-in player, never anonymously).
export async function lookupInvite(code) {
  const snap = await getDoc(doc(db, "codes", code));
  return snap.exists() ? { uid: snap.get("uid"), displayName: snap.get("displayName") || "your friend" } : null;
}

// Phone share sheet (WhatsApp, Messages…) where available, otherwise copy.
// Returns "shared" | "copied" | "cancelled", or throws if neither works.
export async function shareInvite(code, name) {
  const url = inviteLink(code);
  const text = `${name ? `${name} has invited you to` : "Join me on"} 11 PlusLab! Let's see who tops the leaderboard 🏆`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "11 PlusLab", text, url });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
      // Share sheet unavailable in this context: fall through to copying.
    }
  }
  await navigator.clipboard.writeText(`${text} ${url}`);
  return "copied";
}
