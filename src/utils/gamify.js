// Gamification metrics DERIVED from the scores/history the app already saves in
// localStorage (see leaderboard.js). Nothing here needs a backend — XP, level,
// streak, per-skill mastery and badges are all computed from real play data.
import { getAllBests, getAllHistory, getSetting } from "./leaderboard";
import { getSkillAccuracy } from "./progress";

// Skills shown on the dashboard, each mapping to the score gameTypes it covers.
export const SKILLS = [
  { id: "wordMatch",     label: "Word Match",     icon: "📚",  types: ["synonyms", "antonyms", "synonymsWs", "antonymsWs"] },
  { id: "compoundWords", label: "Compound Words", icon: "🧩",  types: ["compoundWords", "compoundWordsWs"] },
  { id: "fillInBlanks",  label: "Word Detective", icon: "🕵️", types: ["fillInBlanks"] },
  { id: "punctuation",   label: "Punctuation",    icon: "✏️", types: ["punctuation"] },
  { id: "spelling",      label: "Spelling",       icon: "🔤", types: ["spelling"] },
];

const TITLES = [
  "Word Rookie", "Word Explorer", "Word Builder", "Word Ranger",
  "Word Wrangler", "Word Master", "Word Wizard", "Word Legend",
];
const XP_PER_LEVEL = 250;
const XP_PER_STAR  = 6;

// key format: `${level}-${gameType}-${totalQuestions}`  (no field contains "-")
function parseKey(key) {
  const [level, gameType, total] = key.split("-");
  return { level, gameType, total: Number(total) };
}

// dd/mm/yyyy → Date (midnight)
function parseDate(str) {
  if (!str) return null;
  const [d, m, y] = str.split("/").map(Number);
  return new Date(y, m - 1, d);
}
function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function allRuns() {
  const hist = getAllHistory();
  const runs = [];
  for (const [key, arr] of Object.entries(hist)) {
    const { gameType, total } = parseKey(key);
    for (const r of arr) runs.push({ ...r, gameType, total });
  }
  return runs;
}

export function getXp() {
  return allRuns().reduce((sum, r) => sum + (r.stars || 0) * XP_PER_STAR, 0);
}

export function xpToRunReward(stars) {
  return stars * XP_PER_STAR;
}

export function getLevelInfo(xp = getXp()) {
  const level     = Math.floor(xp / XP_PER_LEVEL) + 1;
  const intoLevel = xp - (level - 1) * XP_PER_LEVEL;
  const title     = TITLES[Math.min(level - 1, TITLES.length - 1)];
  return {
    xp,
    level,
    title,
    intoLevel,
    toNext: XP_PER_LEVEL - intoLevel,
    pct: Math.round((intoLevel / XP_PER_LEVEL) * 100),
  };
}

// Consecutive days (ending today or yesterday) with at least one run.
export function getStreak() {
  const days = new Set(
    allRuns().map((r) => parseDate(r.date)).filter(Boolean).map(dayKey)
  );
  if (days.size === 0) return 0;
  const today = new Date();
  const cursor = new Date(today);
  // Allow the streak to still count if they haven't played *today* yet.
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Peak mastery per skill = best (stars / maxStars) across that skill's bests.
// Per-skill accuracy: the % of questions answered right first try, across all
// rounds played (from progress.js). More honest than "best round" — it reflects
// how well the child actually knows the material and moves with real performance.
export function getSkillMastery() {
  const byId = {};
  for (const a of getSkillAccuracy()) byId[a.skill] = a;
  return SKILLS.map((skill) => {
    const a = byId[skill.id];
    return { ...skill, pct: a ? a.pct : 0, attempted: a ? a.total : 0 };
  });
}

// "Play N rounds today" — progress from today's runs. Target = the daily goal.
export function getDailyChallenge(target = getSetting("dailyGoal", 3)) {
  const todayKey = dayKey(new Date());
  const done = allRuns().filter((r) => {
    const d = parseDate(r.date);
    return d && dayKey(d) === todayKey;
  }).length;
  return { done: Math.min(done, target), target, complete: done >= target };
}

export function getStats() {
  const runs    = allRuns();
  const xp      = runs.reduce((s, r) => s + (r.stars || 0) * XP_PER_STAR, 0);
  const stars   = runs.reduce((s, r) => s + (r.stars || 0), 0);
  const mastery = getSkillMastery();
  const streak  = getStreak();

  // Badges: simple milestone count from real achievements.
  const perfect = runs.some((r) => r.wrong === 0 && r.stars > 0);
  const badges = [
    runs.length >= 1,
    runs.length >= 10,
    runs.length >= 50,
    streak >= 3,
    streak >= 7,
    perfect,
    mastery.some((m) => m.pct >= 80),
    mastery.every((m) => m.pct >= 50) && mastery.length > 0,
  ].filter(Boolean).length;

  return {
    ...getLevelInfo(xp),
    stars,
    rounds: runs.length,
    streak,
    badges,
    mastery,
    daily: getDailyChallenge(),
  };
}
