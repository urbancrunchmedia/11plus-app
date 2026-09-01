import { describe, it, expect, beforeEach } from "vitest";
import {
  recordAttempt,
  getWeakWords,
  getReviewWords,
  getSkillAccuracy,
  selectWithReview,
} from "./progress";

// Seam: the review-word loop. A missed word should surface for revision, then
// drop off once it's been answered correctly twice (re-mastered).

describe("weak-word tracking", () => {
  beforeEach(() => localStorage.clear());

  it("lists a word after it is missed", () => {
    recordAttempt({ skill: "fillInBlanks", word: "benevolent", correct: false, meaning: "kind" });
    const weak = getWeakWords();
    expect(weak.map((w) => w.word)).toContain("benevolent");
    expect(weak[0].meaning).toBe("kind");
  });

  it("drops a word after two correct answers following the miss", () => {
    recordAttempt({ skill: "fillInBlanks", word: "benevolent", correct: false });
    recordAttempt({ skill: "fillInBlanks", word: "benevolent", correct: true });
    expect(getWeakWords().map((w) => w.word)).toContain("benevolent"); // still shaky after 1
    recordAttempt({ skill: "fillInBlanks", word: "benevolent", correct: true });
    expect(getWeakWords().map((w) => w.word)).not.toContain("benevolent"); // re-mastered
  });

  it("getReviewWords is scoped to one skill and lowercased", () => {
    recordAttempt({ skill: "fillInBlanks", word: "Benevolent", correct: false });
    recordAttempt({ skill: "compoundWords", word: "Waterfall", correct: false });
    const set = getReviewWords("fillInBlanks");
    expect(set.has("benevolent")).toBe(true);
    expect(set.has("waterfall")).toBe(false);
  });
});

describe("getSkillAccuracy", () => {
  beforeEach(() => localStorage.clear());

  it("reports the percentage correct per skill", () => {
    recordAttempt({ skill: "punctuation", correct: true });
    recordAttempt({ skill: "punctuation", correct: true });
    recordAttempt({ skill: "punctuation", correct: true });
    recordAttempt({ skill: "punctuation", correct: false });
    const punct = getSkillAccuracy().find((s) => s.skill === "punctuation");
    expect(punct.pct).toBe(75); // 3 of 4
    expect(punct.misses).toBe(1);
  });
});

describe("selectWithReview", () => {
  beforeEach(() => localStorage.clear());
  const pool = Array.from({ length: 10 }, (_, i) => ({ word: `w${i}` }));
  const key = (x) => x.word;

  it("returns exactly `count` items", () => {
    expect(selectWithReview(pool, 5, key, "fillInBlanks", false)).toHaveLength(5);
  });

  it("cycles when the pool is smaller than count", () => {
    const small = pool.slice(0, 3);
    expect(selectWithReview(small, 5, key, "fillInBlanks", true)).toHaveLength(5);
  });

  it("front-loads a previously-missed word when revisit is on", () => {
    recordAttempt({ skill: "fillInBlanks", word: "w7", correct: false });
    const picked = selectWithReview(pool, 5, key, "fillInBlanks", true).map(key);
    expect(picked).toContain("w7");
  });

  it("only draws from the given pool", () => {
    const picked = selectWithReview(pool, 5, key, "fillInBlanks", false).map(key);
    picked.forEach((w) => expect(pool.map(key)).toContain(w));
  });
});
