// What a tutor sees about each pupil, worked out from the pupil's synced
// users/{uid} document ({ history, progress }). Pure functions: no storage,
// no network, `now` passed in, so every number here is unit-tested.
import { SKILL_LABEL, REMASTER_HITS, RETIRED_SKILLS, weakWordsFrom, skillAccuracyFrom } from "./progress";

const DAY = 24 * 60 * 60 * 1000;
export const GAME_ORDER = ["synonyms", "antonyms", "compoundWords", "fillInBlanks", "punctuation", "spelling", "wordClass"];
const LEVEL_LABEL = { A: "Easy", B: "Medium", C: "Hard", all: "Mixed" };
// Thresholds for the "needs attention" flags.
export const INACTIVE_DAYS = 7;
const DROP_POINTS = 8;          // recent accuracy this many points below before
const STRUGGLE_PCT = 70;        // a skill below this...
const STRUGGLE_MIN = 20;        // ...over at least this many answers

// "dd/mm/yyyy" (how the app stores run dates, en-GB) -> local midnight ms.
function parseDay(str) {
  const [d, m, y] = String(str || "").split("/").map(Number);
  return y ? new Date(y, m - 1, d).getTime() : null;
}
function midnight(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
const daysBetween = (a, b) => Math.round((midnight(a) - midnight(b)) / DAY);

// History key "<level>-<gameType>-<total>"; worksheet variants end in "Ws".
export function runsFrom(history) {
  const runs = [];
  for (const [key, list] of Object.entries(history || {})) {
    const [level, gameType, total] = key.split("-");
    const game = String(gameType || "").replace(/Ws$/, "");
    for (const r of Array.isArray(list) ? list : []) {
      const day = parseDay(r.date);
      if (day == null) continue;
      const questions = Number(total) || 0;
      const wrong = Math.max(0, Number(r.wrong) || 0);
      runs.push({
        level, game, questions, wrong, day,
        stars: Number(r.stars) || 0,
        seconds: Math.max(0, Number(r.time) || 0),
        // Right first time out of all answers given.
        accuracy: questions ? Math.round((questions / (questions + wrong)) * 100) : null,
      });
    }
  }
  return runs.sort((a, b) => b.day - a.day);
}

function avg(nums) {
  const xs = nums.filter((n) => n != null);
  return xs.length ? Math.round(xs.reduce((s, n) => s + n, 0) / xs.length) : null;
}

function streakFrom(days, now) {
  const set = new Set(days.map(midnight));
  let cursor = midnight(now);
  if (!set.has(cursor)) cursor -= DAY; // still counts if not played yet today
  let n = 0;
  while (set.has(cursor)) { n++; cursor = midnight(cursor - DAY / 2); }
  return n;
}

export function pupilSummary(data, now = Date.now()) {
  const runs = runsFrom(data?.history);
  const progress = data?.progress || { words: {}, skills: {} };
  const age = (r) => daysBetween(now, r.day);
  const week = runs.filter((r) => age(r) < 7);
  const month = runs.filter((r) => age(r) < 30);
  const lastActive = runs.length ? runs[0].day : null;
  const daysSinceActive = lastActive == null ? null : daysBetween(now, lastActive);

  // Per-skill accuracy is all-time (from every answer); the trend compares
  // rounds from the last 14 days with the 4 weeks before.
  const skills = skillAccuracyFrom(progress);
  const totals = skills.reduce((t, s) => ({ answers: t.answers + s.total, misses: t.misses + s.misses }), { answers: 0, misses: 0 });
  const accuracy = totals.answers ? Math.round(((totals.answers - totals.misses) / totals.answers) * 100) : null;
  const recentAcc = avg(runs.filter((r) => age(r) < 14).map((r) => r.accuracy));
  const earlierAcc = avg(runs.filter((r) => age(r) >= 14 && age(r) < 42).map((r) => r.accuracy));
  const trend = recentAcc != null && earlierAcc != null ? recentAcc - earlierAcc : null;

  const weakest = skills.find((s) => s.total >= 5) || null;
  const struggling = skills.filter((s) => s.total >= STRUGGLE_MIN && s.pct < STRUGGLE_PCT);
  const weakWords = weakWordsFrom(progress, 50);
  const turnedAround = Object.values(progress.words || {})
    .filter((w) => w.misses > 0 && w.hitsSinceMiss >= REMASTER_HITS && !RETIRED_SKILLS.has(w.skill)).length;

  const flags = [];
  if (lastActive == null) flags.push({ id: "never", label: "Hasn't played yet" });
  else if (daysSinceActive >= INACTIVE_DAYS) flags.push({ id: "inactive", label: `Not played for ${daysSinceActive} days` });
  if (trend != null && trend <= -DROP_POINTS) flags.push({ id: "dropping", label: "Accuracy dropping" });
  // One flag for the weakest struggling game, so a pupil weak in several
  // doesn't get a wall of flags (the rest show in their detail page).
  if (struggling.length) {
    const more = struggling.length - 1;
    flags.push({ id: `struggling-${struggling[0].skill}`, label: `Struggling with ${struggling[0].label}${more ? ` (+${more} more)` : ""}` });
  }

  const gameCounts = Object.fromEntries(GAME_ORDER.map((g) => [g, 0]));
  for (const r of month) if (r.game in gameCounts) gameCounts[r.game]++;
  const levelCounts = {};
  for (const r of month) levelCounts[LEVEL_LABEL[r.level] || r.level] = (levelCounts[LEVEL_LABEL[r.level] || r.level] || 0) + 1;

  const activeDays = new Set(runs.map((r) => midnight(r.day)));
  const calendar = Array.from({ length: 28 }, (_, i) => {
    const day = midnight(midnight(now) - (27 - i) * DAY + DAY / 2);
    return { day, played: activeDays.has(day) };
  });

  return {
    lastActive, daysSinceActive,
    roundsWeek: week.length,
    roundsMonth: month.length,
    minutesWeek: Math.round(week.reduce((s, r) => s + r.seconds, 0) / 60),
    minutesMonth: Math.round(month.reduce((s, r) => s + r.seconds, 0) / 60),
    daysActiveMonth: new Set(month.map((r) => midnight(r.day))).size,
    streak: streakFrom(runs.map((r) => r.day), now),
    accuracy, recentAccuracy: recentAcc, trend,
    answers: totals.answers,
    skills, weakest, struggling,
    weakWords, weakWordCount: weakWords.length, turnedAround,
    gameCounts, levelCounts, calendar,
    recentRounds: runs.slice(0, 10).map((r) => ({ ...r, gameLabel: SKILL_LABEL[r.game] || r.game, levelLabel: LEVEL_LABEL[r.level] || r.level })),
    flags,
  };
}

// Across a tutor's whole group: who needs attention, which words most pupils
// keep missing, and the weakest skill on average.
export function classSummary(pupils, now = Date.now()) {
  const summaries = pupils.map((p) => ({ ...p, summary: p.summary || pupilSummary(p.data, now) }));
  const n = summaries.length;
  const activeWeek = summaries.filter((p) => p.summary.roundsWeek > 0).length;
  const roundsWeek = summaries.reduce((s, p) => s + p.summary.roundsWeek, 0);
  const averageAccuracy = avg(summaries.map((p) => p.summary.accuracy));
  const needsAttention = summaries.filter((p) => p.summary.flags.length > 0).length;

  const wordCounts = new Map();
  for (const p of summaries) {
    for (const w of p.summary.weakWords) {
      const key = `${w.skill}:${String(w.word).toLowerCase()}`;
      const e = wordCounts.get(key) || { word: w.word, skill: w.skill, skillLabel: SKILL_LABEL[w.skill] || w.skill, meaning: w.meaning || "", pupils: 0 };
      e.pupils++;
      wordCounts.set(key, e);
    }
  }
  const minPupils = n >= 3 ? 2 : 1;
  const commonWeakWords = [...wordCounts.values()]
    .filter((w) => w.pupils >= minPupils)
    .sort((a, b) => b.pupils - a.pupils || a.word.localeCompare(b.word))
    .slice(0, 10);

  const bySkill = {};
  for (const p of summaries) for (const s of p.summary.skills) (bySkill[s.skill] ||= []).push(s.pct);
  const skillAverages = Object.entries(bySkill)
    .map(([skill, pcts]) => ({ skill, label: SKILL_LABEL[skill] || skill, pct: avg(pcts), pupils: pcts.length }))
    .sort((a, b) => a.pct - b.pct);

  // Who practised most this week (minutes, then rounds): worth praising.
  const topPractiser = summaries
    .filter((p) => p.summary.roundsWeek > 0)
    .sort((a, b) => b.summary.minutesWeek - a.summary.minutesWeek || b.summary.roundsWeek - a.summary.roundsWeek)[0];

  return {
    pupils: n, activeWeek, roundsWeek, averageAccuracy, needsAttention, commonWeakWords, skillAverages,
    weakestSkill: skillAverages[0] || null,
    topPractiser: topPractiser ? { name: topPractiser.name, minutes: topPractiser.summary.minutesWeek, rounds: topPractiser.summary.roundsWeek } : null,
  };
}

// Orders for the pupil list. Ties fall back to name.
export const SORTS = {
  attention: { label: "Needs attention first", cmp: (a, b) => (b.summary.flags.length > 0) - (a.summary.flags.length > 0) },
  most: { label: "Most practice this week", cmp: (a, b) => b.summary.minutesWeek - a.summary.minutesWeek || b.summary.roundsWeek - a.summary.roundsWeek },
  least: { label: "Least practice this week", cmp: (a, b) => a.summary.minutesWeek - b.summary.minutesWeek || a.summary.roundsWeek - b.summary.roundsWeek },
  accuracy: { label: "Lowest accuracy first", cmp: (a, b) => (a.summary.accuracy ?? 101) - (b.summary.accuracy ?? 101) },
  name: { label: "Name (A–Z)", cmp: () => 0 },
};
export function sortPupils(rows, mode = "attention") {
  const cmp = (SORTS[mode] || SORTS.attention).cmp;
  return [...rows].sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name));
}
