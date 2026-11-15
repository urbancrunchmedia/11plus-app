import { describe, it, expect } from "vitest";
import { runsFrom, pupilSummary, classSummary } from "./tutorMetrics";

const NOW = new Date(2026, 10, 15, 18, 0).getTime(); // Sun 15 Nov 2026, 6pm
const day = (daysAgo) => new Date(NOW - daysAgo * 864e5).toLocaleDateString("en-GB");
const run = (daysAgo, over = {}) => ({ stars: 3, wrong: 0, time: 120, name: "Amu", date: day(daysAgo), ...over });

describe("runsFrom", () => {
  it("reads level, game and accuracy from history keys, newest first", () => {
    const runs = runsFrom({ "A-synonyms-10": [run(3, { wrong: 5 })], "B-spellingWs-10": [run(1)] });
    expect(runs.map((r) => r.game)).toEqual(["spelling", "synonyms"]);
    expect(runs[1]).toMatchObject({ level: "A", questions: 10, wrong: 5, accuracy: 67 });
  });
  it("skips runs without a valid date", () => {
    expect(runsFrom({ "A-synonyms-10": [{ stars: 1, date: "" }] })).toEqual([]);
    expect(runsFrom(undefined)).toEqual([]);
  });
});

describe("pupilSummary", () => {
  it("handles a pupil who hasn't played yet", () => {
    const s = pupilSummary({}, NOW);
    expect(s).toMatchObject({ lastActive: null, roundsWeek: 0, accuracy: null, streak: 0, weakWordCount: 0 });
    expect(s.flags.map((f) => f.id)).toEqual(["never"]);
    expect(s.calendar).toHaveLength(28);
  });

  it("counts rounds, minutes, active days and the streak", () => {
    const s = pupilSummary({ history: { "A-synonyms-10": [run(0), run(1), run(2), run(10)] } }, NOW);
    expect(s.roundsWeek).toBe(3);
    expect(s.roundsMonth).toBe(4);
    expect(s.minutesWeek).toBe(6);
    expect(s.daysActiveMonth).toBe(4);
    expect(s.streak).toBe(3);
    expect(s.daysSinceActive).toBe(0);
    expect(s.calendar.at(-1).played).toBe(true);
    expect(s.calendar.at(-4).played).toBe(false);
  });

  it("keeps the streak going if they haven't played yet today", () => {
    expect(pupilSummary({ history: { "A-synonyms-10": [run(1), run(2)] } }, NOW).streak).toBe(2);
  });

  it("flags a pupil who hasn't played for a week", () => {
    const s = pupilSummary({ history: { "A-synonyms-10": [run(9)] } }, NOW);
    expect(s.flags.map((f) => f.label)).toContain("Not played for 9 days");
  });

  it("works out overall and per-skill accuracy, and flags a struggling skill", () => {
    const progress = { words: {}, skills: { spelling: { hits: 12, misses: 18 }, synonyms: { hits: 45, misses: 5 } } };
    const s = pupilSummary({ progress, history: { "A-spelling-10": [run(0)] } }, NOW);
    expect(s.accuracy).toBe(71);
    expect(s.weakest).toMatchObject({ skill: "spelling", pct: 40 });
    expect(s.flags.map((f) => f.label)).toContain("Struggling with Spelling");
    expect(s.flags.map((f) => f.label)).not.toContain("Struggling with Synonyms");
  });

  it("spots accuracy dropping compared with earlier weeks", () => {
    const history = { "A-synonyms-10": [run(1, { wrong: 10 }), run(3, { wrong: 8 }), run(20), run(25)] };
    const s = pupilSummary({ history }, NOW);
    expect(s.trend).toBeLessThanOrEqual(-8);
    expect(s.flags.map((f) => f.id)).toContain("dropping");
  });

  it("lists weak words and counts words turned around", () => {
    const progress = { skills: {}, words: {
      "synonyms:meticulous": { word: "Meticulous", skill: "synonyms", misses: 3, hitsSinceMiss: 0, meaning: "careful" },
      "spelling:necessary": { word: "necessary", skill: "spelling", misses: 1, hitsSinceMiss: 2 },
      "wordMatch:old": { word: "old", skill: "wordMatch", misses: 4, hitsSinceMiss: 0 },
    } };
    const s = pupilSummary({ progress }, NOW);
    expect(s.weakWords.map((w) => w.word)).toEqual(["Meticulous"]);
    expect(s.turnedAround).toBe(1);
  });

  it("counts games and levels over the last 30 days", () => {
    const s = pupilSummary({ history: { "A-synonyms-10": [run(1), run(2)], "C-punctuation-10": [run(3)], "B-spelling-10": [run(40)] } }, NOW);
    expect(s.gameCounts).toMatchObject({ synonyms: 2, punctuation: 1, spelling: 0 });
    expect(s.levelCounts).toEqual({ Easy: 2, Hard: 1 });
    expect(s.recentRounds[0]).toMatchObject({ gameLabel: "Synonyms", levelLabel: "Easy" });
  });
});

describe("classSummary", () => {
  const weak = (word) => ({ [`synonyms:${word.toLowerCase()}`]: { word, skill: "synonyms", misses: 2, hitsSinceMiss: 0 } });
  const pupil = (name, words, skills, history = {}) => ({ name, data: { history, progress: { words, skills } } });

  it("finds words several pupils keep missing and the weakest skill", () => {
    const c = classSummary([
      pupil("A", { ...weak("Placid"), ...weak("Candid") }, { spelling: { hits: 5, misses: 5 }, synonyms: { hits: 9, misses: 1 } }, { "A-synonyms-10": [run(1)] }),
      pupil("B", weak("Placid"), { spelling: { hits: 6, misses: 4 } }),
      pupil("C", weak("Placid"), {}),
    ], NOW);
    expect(c).toMatchObject({ pupils: 3, activeWeek: 1, roundsWeek: 1 });
    expect(c.commonWeakWords).toEqual([expect.objectContaining({ word: "Placid", pupils: 3 })]);
    expect(c.weakestSkill).toMatchObject({ skill: "spelling", pct: 55 });
    expect(c.needsAttention).toBe(2); // B and C haven't played; A played yesterday
  });

  it("is safe with no pupils", () => {
    expect(classSummary([], NOW)).toMatchObject({ pupils: 0, averageAccuracy: null, weakestSkill: null, commonWeakWords: [] });
  });
});
