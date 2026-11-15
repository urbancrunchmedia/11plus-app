// Tutor join links: https://11pluslab.com/join/<tutor code>
// Opening one remembers the code (through sign-up, Google redirects and
// onboarding) until the signed-in parent confirms or dismisses it in
// TutorJoinPrompt. Connecting always takes the parent's confirmation.
const KEY = "11plus_pending_tutor";
const CODE = /^TUT-[2-9A-HJKMNP-Z]{8}$/;

// Call once at startup: moves /join/<code> out of the address bar into storage.
export function captureTutorJoinFromUrl() {
  try {
    const m = window.location.pathname.match(/^\/join\/([^/?#]+)/i);
    if (!m) return;
    const code = decodeURIComponent(m[1]).trim().toUpperCase();
    if (CODE.test(code)) localStorage.setItem(KEY, code);
    window.history.replaceState(window.history.state, "", "/" + window.location.search + window.location.hash);
  } catch { /* storage or URL unavailable */ }
}

export function getPendingTutorJoin() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function clearPendingTutorJoin() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export const tutorJoinLink = (code) => `${window.location.origin}/join/${code}`;

// The tutor's name for the sign-in page (no sign-in needed; rate-limited).
export async function publicTutorLookup(code) {
  const res = await fetch("/api/tutor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "publicLookup", code }),
  });
  return res.ok ? res.json() : null;
}
