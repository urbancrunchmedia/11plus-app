// Weekly points: what you've earned since the week turned over, as opposed to
// `points`, which is the sum of your personal bests and barely moves once set.
//
// Weeks start Monday 00:00 UTC so friends in different timezones share one
// board, and the reset needs no scheduled job: a stored week key that isn't
// this week's simply reads as zero.

export const WEEK_POINTS_KEY = "11plus_week_points";
const KEY = WEEK_POINTS_KEY;

export function weekStart(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Mon = 0 … Sun = 6
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

export function weekKey(date = new Date()) {
  return weekStart(date).toISOString().slice(0, 10); // e.g. "2026-09-07"
}

export function nextWeekStart(date = new Date()) {
  const s = weekStart(date);
  s.setUTCDate(s.getUTCDate() + 7);
  return s;
}

export function msUntilReset(date = new Date()) {
  return nextWeekStart(date).getTime() - date.getTime();
}

// "3d 6h" · "6h 20m" · "45m" — coarse on purpose, it's a nudge not a stopwatch.
export function formatResetIn(ms) {
  if (ms <= 0) return "now";
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}

export function getWeeklyPoints(date = new Date()) {
  const s = read();
  return s && s.key === weekKey(date) ? (s.points || 0) : 0;
}

export function addWeeklyPoints(stars, date = new Date()) {
  const points = getWeeklyPoints(date) + Math.max(0, stars || 0);
  try { localStorage.setItem(KEY, JSON.stringify({ key: weekKey(date), points })); } catch { /* private mode */ }
  return points;
}

// A friend's profile carries the week it was written for, so a board opened on
// Monday shows last week's players at zero without them having to open the app.
export function weeklyPointsOf(profile, date = new Date()) {
  return profile?.weekKey === weekKey(date) ? (profile.weekPoints || 0) : 0;
}
