// What the FREE tier gets. Everything else is Full Access (premium).
//   Free:  Level A on every game, Word Detective in full, a daily round cap.
//   Paid:  Levels B & C (and Punctuation "all levels"), unlimited rounds,
//          plus the parent progress report.
// Keep these numbers here so the free/paid line is easy to tune in one place.

export const FREE_DAILY_ROUNDS = 8;                 // generous; premium = unlimited
export const isLevelFree = (level) => level === "A"; // A is free; B, C and "all" are premium

function todayKey() {
  const d = new Date();
  return `11plus_rounds_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function roundsToday() {
  try { return Number(localStorage.getItem(todayKey())) || 0; } catch { return 0; }
}

export function bumpRoundsToday() {
  try { localStorage.setItem(todayKey(), String(roundsToday() + 1)); } catch { /* ignore */ }
}

export function roundsLeftToday() {
  return Math.max(0, FREE_DAILY_ROUNDS - roundsToday());
}
