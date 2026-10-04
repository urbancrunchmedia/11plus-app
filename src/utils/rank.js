// Weekly Rank — a tier that can rise OR fall, unlike the XP Level system
// (which only ever goes up). Judged against fixed star targets, not other
// players — works identically whether a kid has zero friends or five.
import { weekKey, getWeeklyPoints } from "./weekly";

const RANK_KEY = "11plus_rank";

// `facets` and `colors` (light/mid/dark) drive the shared <Gem> crest —
// more facets at higher tiers, one colour family per tier so a kid can
// recognise their rank at a glance (green → teal → gold → blue → purple).
export const RANK_TIERS = [
  { id: "bronze",   label: "Wanderer",    min: 0,    facets: 2, colors: ["#86efac", "#22c55e", "#15803d"] },
  { id: "silver",   label: "Adventurer",  min: 70,   facets: 3, colors: ["#99f6e4", "#2dd4bf", "#0f766e"] },
  { id: "gold",     label: "Trailblazer", min: 300,  facets: 4, colors: ["#fde68a", "#f2c94c", "#d4a017"] },
  { id: "platinum", label: "Pioneer",     min: 600,  facets: 5, colors: ["#93c5fd", "#12a5ff", "#0b7fc7"] },
  { id: "diamond",  label: "Champion",    min: 1000, facets: 6, colors: ["#ddd6fe", "#8b5cf6", "#6d28d9"] },
];

function tierIndex(id) {
  return RANK_TIERS.findIndex((t) => t.id === id);
}

// The tier whose range contains `points` — the highest tier whose min is
// still <= points.
function tierForPoints(points) {
  let best = RANK_TIERS[0];
  for (const t of RANK_TIERS) if (points >= t.min) best = t;
  return best;
}

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(RANK_KEY));
    if (!raw) return null;
    return raw;
  } catch {
    return null;
  }
}

function write(state) {
  try { localStorage.setItem(RANK_KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

// Raw read of the weekly-points key, bypassing weekly.js's "stale key reads
// as 0" helper — we need last week's real final total before it's discarded.
function readRawWeekPoints() {
  try { return JSON.parse(localStorage.getItem("11plus_week_points")); } catch { return null; }
}

export function getRank() {
  const s = read();
  if (!s) return { tier: "bronze", bestTier: "bronze" };
  return { tier: s.tier || "bronze", bestTier: s.bestTier || s.tier || "bronze" };
}

export function rankEverReached(id) {
  const { bestTier } = getRank();
  return tierIndex(bestTier) >= tierIndex(id);
}

// Call once per render (cheap — localStorage reads only) so a completed
// week gets scored the next time the app is open, with no effect wiring.
// `now` defaults to the real clock; tests pass a fixed date, same convention
// as weekly.js's own functions.
export function evaluateWeeklyRank(now = new Date()) {
  const state = read() || { tier: "bronze", evaluatedWeekKey: null, weakWeeks: 0, bestTier: "bronze" };
  const raw = readRawWeekPoints();

  // Nothing recorded yet, or already scored this stored week — nothing to do.
  if (!raw || raw.key === state.evaluatedWeekKey) return { changed: false, direction: null, tier: state.tier };
  // The current, still-in-progress week isn't finished yet — don't score it.
  if (raw.key === weekKey(now)) return { changed: false, direction: null, tier: state.tier };

  const currentIdx = tierIndex(state.tier);
  const targetTier = tierForPoints(raw.points || 0);
  const targetIdx = tierIndex(targetTier.id);

  let nextTier = state.tier;
  let direction = null;
  let weakWeeks = state.weakWeeks || 0;

  if (targetIdx > currentIdx) {
    nextTier = RANK_TIERS[currentIdx + 1].id; // promote one step at a time
    direction = "up";
    weakWeeks = 0;
  } else if (targetIdx < currentIdx) {
    weakWeeks += 1;
    if (weakWeeks >= 2 && currentIdx > 0) {
      nextTier = RANK_TIERS[currentIdx - 1].id; // demote one step, two weak weeks in a row
      direction = "down";
      weakWeeks = 0;
    }
  } else {
    weakWeeks = 0; // cleared the bar — a weak-week streak needs to be consecutive
  }

  const bestIdx = Math.max(tierIndex(state.bestTier || "bronze"), tierIndex(nextTier));
  const bestTier = RANK_TIERS[bestIdx].id;

  // A promotion can be *detected* anywhere getStats() happens to run first
  // (HomeDashboard mounts before a kid ever reaches GameComplete), long
  // before there's a screen worth popping a celebration over. So the write
  // and the celebration are decoupled: this only ever records that an
  // unclaimed promotion exists; claimPendingPromotion() is what actually
  // surfaces it, the next time a suitable moment (finishing a round) comes
  // along, however much later that is. A demotion is never queued here —
  // per the plan, drops are never celebrated, only shown gently elsewhere.
  const pending = direction === "up" ? { tier: nextTier } : state.pending || null;

  write({ tier: nextTier, evaluatedWeekKey: raw.key, weakWeeks, bestTier, pending });
  return { changed: nextTier !== state.tier, direction, tier: nextTier };
}

// Consumes a promotion once, wherever it's first checked for — so the
// celebration fires the next time a kid finishes a round, even if the
// actual tier flip was written earlier (e.g. on app open, days before).
export function claimPendingPromotion() {
  const state = read();
  if (!state?.pending) return null;
  const { pending } = state;
  write({ ...state, pending: null });
  return pending;
}

// For the Badges screen / dashboard: how this week's live total sits
// against the current tier and the next one up, plus the gentle heads-up
// copy when a kid is already one weak week into the two-week grace period.
export function getRankProgress() {
  const state = read() || { tier: "bronze", weakWeeks: 0 };
  const weekPoints = getWeeklyPoints();
  const idx = tierIndex(state.tier);
  const current = RANK_TIERS[idx];
  const next = RANK_TIERS[idx + 1] || null;
  return {
    tier: current.id,
    label: current.label,
    weekPoints,
    nextLabel: next ? next.label : null,
    toNext: next ? Math.max(0, next.min - weekPoints) : 0,
    weakWeeks: state.weakWeeks || 0,
    belowCurrent: weekPoints < current.min,
    prevLabel: idx > 0 ? RANK_TIERS[idx - 1].label : null,
  };
}
