// Complimentary Full Access by email, no subscription needed. Shared by the
// app (PremiumContext) and the owner dashboard (server/ownerStats.js).
// `until` is the last day of access (UK date, inclusive); null = no end date.
// Client-side grant only: real paid access always comes from Stripe.
const COMP_ACCESS = {
  "reuben.dongre@gmail.com": { until: null, note: "owner" },
  "charlotte_dcunha@hotmail.com": { until: null, note: "testing" },
  "lorenzo@lorenzostutoring.co.uk": { until: "2026-11-30", note: "tutor trial with pupils, Lorenzo's Tutoring (LORENZOS20)" },
};

export function hasCompAccess(email, now = Date.now()) {
  const entry = COMP_ACCESS[String(email || "").trim().toLowerCase()];
  if (!entry) return false;
  if (!entry.until) return true;
  // End of that day in the UK (allowing for BST, a day's grace is harmless).
  return now < Date.parse(`${entry.until}T23:59:59Z`);
}
