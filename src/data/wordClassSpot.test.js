import { describe, it, expect } from "vitest";
import { wordClassSpot } from "./wordClassSpot";

// Categories are progressive by level (see wordClassSpot.js's own header
// comment) — this is what actually enforces that, so a future addition can't
// silently put a Hard-only category (e.g. "interjection") into Easy.
const LEVEL_CATEGORIES = {
  A: ["noun", "verb", "adjective"],
  B: ["noun", "verb", "adjective", "pronoun", "adverb", "preposition"],
  C: ["noun", "verb", "adjective", "pronoun", "adverb", "preposition", "helpingVerb", "conjunction", "interjection"],
};

describe("wordClassSpot", () => {
  it("has 25 questions in each level", () => {
    for (const L of ["A", "B", "C"]) expect(wordClassSpot[L].length).toBe(25);
  });

  for (const L of ["A", "B", "C"]) {
    it(`level ${L}: every question is well-formed`, () => {
      for (const q of wordClassSpot[L]) {
        expect(q.segments).toHaveLength(4);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThanOrEqual(3); // no "N" option in this game
        expect(q.why).toBeTruthy();
      }
    });

    it(`level ${L}: only tests categories introduced by that level`, () => {
      for (const q of wordClassSpot[L]) {
        expect(LEVEL_CATEGORIES[L]).toContain(q.askFor);
      }
    });

    it(`level ${L}: no two questions share the same sentence`, () => {
      const sentences = wordClassSpot[L].map((q) => q.segments.join(" "));
      expect(new Set(sentences).size).toBe(sentences.length);
    });
  }
});
