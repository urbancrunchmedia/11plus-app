// Permanent, named, trophy-case achievements — unlike Rank, these never
// drop once earned. Reuses getStats()'s existing fields; no new tracking.

export const BADGE_DEFS = [
  { id: "first-round",  name: "First Steps",      check: (s) => s.rounds >= 1,                                 progress: (s) => [s.rounds, 1] },
  { id: "rounds-10",    name: "Getting Started",   check: (s) => s.rounds >= 10,                                progress: (s) => [s.rounds, 10] },
  { id: "rounds-50",    name: "Dedicated",         check: (s) => s.rounds >= 50,                                progress: (s) => [s.rounds, 50] },
  { id: "rounds-100",   name: "Centurion",         check: (s) => s.rounds >= 100,                               progress: (s) => [s.rounds, 100] },
  { id: "streak-3",     name: "3-Day Streak",      check: (s) => s.streak >= 3,                                 progress: (s) => [s.streak, 3] },
  { id: "streak-7",     name: "Week Streak",       check: (s) => s.streak >= 7,                                 progress: (s) => [s.streak, 7] },
  { id: "streak-30",    name: "Unstoppable",       check: (s) => s.streak >= 30,                                progress: (s) => [s.streak, 30] },
  { id: "flawless",     name: "Flawless Round",    check: (s) => s.perfect,                                     progress: (s) => [s.perfect ? 1 : 0, 1] },
  { id: "specialist",   name: "Skill Specialist",  check: (s) => s.mastery.some((m) => m.pct >= 80),            progress: (s) => [s.mastery.length ? Math.max(...s.mastery.map((m) => m.pct)) : 0, 80] },
  { id: "well-rounded", name: "Well-Rounded",      check: (s) => s.mastery.length > 0 && s.mastery.every((m) => m.pct >= 50), progress: (s) => [s.mastery.length ? Math.min(...s.mastery.map((m) => m.pct)) : 0, 50] },
  { id: "grand-master", name: "Grand Master",      check: (s) => s.mastery.length > 0 && s.mastery.every((m) => m.pct >= 80), progress: (s) => [s.mastery.length ? Math.min(...s.mastery.map((m) => m.pct)) : 0, 80] },
  { id: "rank-gold",    name: "Reached Trailblazer", check: (s) => s.rankEverReached("gold"),                   progress: () => null },
  { id: "rank-diamond", name: "Reached Champion",   check: (s) => s.rankEverReached("diamond"),                 progress: () => null },
];

const EARNED_KEY = "11plus_badges_earned";

function readEarnedDates() {
  try { return JSON.parse(localStorage.getItem(EARNED_KEY)) || {}; } catch { return {}; }
}
function writeEarnedDates(map) {
  try { localStorage.setItem(EARNED_KEY, JSON.stringify(map)); } catch { /* private mode */ }
}

// Badge checks are pure (derived from getStats()), so the first time one
// reads true we stamp today's date and keep it — same "evaluate lazily on
// render" pattern as rank.js, no new effect wiring needed.
// Shared with BadgesScreen and the GameComplete celebration pop-up, so a
// badge looks identical wherever it's shown. A flat facet count (3) for
// every ordinary achievement — "more facets = harder" is Rank's signal,
// not these. The two Rank milestones are the exception: they borrow that
// tier's real facet count so the badge echoes the crest it commemorates.
export const BADGE_VISUAL = {
  "first-round":  { icon: "star",   colors: ["#86efac", "#22c55e", "#15803d"] },
  "rounds-10":    { icon: "star",   colors: ["#99f6e4", "#2dd4bf", "#0f766e"] },
  "rounds-50":    { icon: "star",   colors: ["#93c5fd", "#12a5ff", "#0b7fc7"] },
  "rounds-100":   { icon: "trophy", colors: ["#ddd6fe", "#8b5cf6", "#6d28d9"] },
  "streak-3":     { icon: "flame",  colors: ["#fdba74", "#ea580c", "#9a3412"] },
  "streak-7":     { icon: "flame",  colors: ["#fca5a5", "#ef4444", "#991b1b"] },
  "streak-30":    { icon: "flame",  colors: ["#ddd6fe", "#8b5cf6", "#6d28d9"] },
  "flawless":     { icon: "target", colors: ["#93c5fd", "#12a5ff", "#0b7fc7"] },
  "specialist":   { icon: "medal",  colors: ["#99f6e4", "#2dd4bf", "#0f766e"] },
  "well-rounded": { icon: "medal",  colors: ["#93c5fd", "#12a5ff", "#0b7fc7"] },
  "grand-master": { icon: "trophy", colors: ["#fde68a", "#f2c94c", "#d4a017"] },
  "rank-gold":    { icon: null, colors: ["#fde68a", "#f2c94c", "#d4a017"], facets: 4 },
  "rank-diamond": { icon: null, colors: ["#ddd6fe", "#8b5cf6", "#6d28d9"], facets: 6 },
};
export const BADGE_GREY = ["#e2e5e9", "#b8c0c9", "#8f99a3"];

export function getBadges(stats) {
  const dates = readEarnedDates();
  let dirty = false;
  const badges = BADGE_DEFS.map((def) => {
    const earned = def.check(stats);
    if (earned && !dates[def.id]) {
      dates[def.id] = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      dirty = true;
    }
    return { ...def, earned, earnedDate: dates[def.id] || null };
  });
  if (dirty) writeEarnedDates(dates);
  return badges;
}
