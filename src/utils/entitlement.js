// What the FREE tier gets. Everything else is Full Access (premium).
//   Free:  a starter set of Level A on every game (Word Detective included),
//          one "taster" round of Level B or C a day, and a daily round cap.
//   Paid:  every word and level, unlimited rounds, the parent progress report.
// Everyone on the free plan gets the same starter set. (Accounts made before
// 23 Oct 2026 used to keep a larger "original" free plan; on 27 Nov 2026 they
// moved to the starter set too — none of them had played in the last 30 days.)
// Keep these numbers here so the free/paid line is easy to tune in one place.
// Starter set size per game: word games draw from long word lists, the
// sentence games (Punctuation, Spelling, Parts of Speech) from 25-55 per level.
export const STARTER_WORDS = 30;
export const STARTER_SENTENCES = 15;
const SENTENCE_GAMES = new Set(["punctuation", "spelling", "wordClass"]);

export const FREE_DAILY_ROUNDS = 3;        // matches the default daily goal; premium = unlimited
export const isLevelFree = (level) => level === "A"; // A is free; B, C and "all" need a taster or Full Access

// How many items of Level A a free round may draw from.
export function starterLimit(game) {
  return SENTENCE_GAMES.has(game) ? STARTER_SENTENCES : STARTER_WORDS;
}

export function dailyRoundLimit() {
  return FREE_DAILY_ROUNDS;
}

function dayKey(prefix) {
  const d = new Date();
  return `${prefix}${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
const read = (k) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const write = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* ignore */ } };

export function roundsToday() { return read(dayKey("11plus_rounds_")); }
export function bumpRoundsToday() { write(dayKey("11plus_rounds_"), roundsToday() + 1); }
export function roundsLeftToday() { return Math.max(0, dailyRoundLimit() - roundsToday()); }

// One free round a day of a harder level (B, C or Mixed), so parents see what
// the next step looks like instead of assuming they should finish A first.
export const TASTER_ROUNDS_PER_DAY = 1;
export function tasterLeftToday() { return Math.max(0, TASTER_ROUNDS_PER_DAY - read(dayKey("11plus_taster_"))); }
export function spendTasterRound() { write(dayKey("11plus_taster_"), read(dayKey("11plus_taster_")) + 1); }

// Whether a free player may pick this level right now on a setup screen.
export function canPickLevel(level, isPremium) {
  return isPremium || isLevelFree(level) || tasterLeftToday() > 0;
}
