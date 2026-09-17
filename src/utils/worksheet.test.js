import { describe, it, expect, beforeEach } from "vitest";
import { makeCompoundBuildQuestions, makeSynonymQuestions, makeCompoundQuestions } from "./worksheet";
import { compoundWords } from "../data/compoundWords";

// Seam: the Compound Words generator. The critical invariant is that every
// question has EXACTLY ONE correct answer — a decoy must never also form a real
// compound with the stem, or the child could be marked wrong for a right answer.
//
// Ground truth (the spec) is the compound dataset itself, built here
// independently of the generator's own internal check.
function realCompoundSet() {
  const all = [...compoundWords.A, ...compoundWords.B, ...compoundWords.C];
  return new Set(all.map((c) => (c.first + c.second).toLowerCase()));
}

describe("makeCompoundBuildQuestions", () => {
  beforeEach(() => localStorage.clear());
  const valid = realCompoundSet();

  it("gives each question one real answer and no valid decoys", () => {
    const questions = makeCompoundBuildQuestions("A", 20);
    expect(questions).toHaveLength(20);

    for (const q of questions) {
      expect(q.options).toHaveLength(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
      // The answer option really is the stem's partner.
      expect(q.options[q.answer]).toBe(q.second);
      expect(valid.has((q.first + q.second).toLowerCase())).toBe(true);

      // Every OTHER option must NOT form a real compound with the stem.
      q.options.forEach((opt, i) => {
        if (i === q.answer) return;
        expect(valid.has((q.first + opt).toLowerCase())).toBe(false);
      });
    }
  });

  it("works across every level", () => {
    for (const level of ["A", "B", "C"]) {
      const questions = makeCompoundBuildQuestions(level, 10);
      expect(questions).toHaveLength(10);
      questions.forEach((q) => expect(q.options[q.answer]).toBe(q.second));
    }
  });

  // Regression: "all" (Mixed) should draw from every level combined, not
  // silently return nothing because compoundWords.all doesn't exist.
  it("draws from every level when level is \"all\" (Mixed)", () => {
    const questions = makeCompoundBuildQuestions("all", 20);
    expect(questions).toHaveLength(20);
    questions.forEach((q) => expect(q.options[q.answer]).toBe(q.second));

    const allPairs = [...compoundWords.A, ...compoundWords.B, ...compoundWords.C];
    const validFirsts = new Set(allPairs.map((c) => c.first));
    // At minimum, confirm the stems really exist somewhere in the combined
    // data rather than coming from an accidentally-undefined pool.
    questions.forEach((q) => expect(validFirsts.has(q.first)).toBe(true));
  });
});

// Regression: "Play again" was handing back some of the very words the
// child just saw, purely by chance — each round was an independent random
// draw with no memory of the last one. avoidKeys fixes that whenever the
// pool is big enough to fill a round without repeating anything.
describe("avoiding repeats across rounds (makeSynonymQuestions/makeCompoundQuestions)", () => {
  beforeEach(() => localStorage.clear());

  it("doesn't repeat the previous round's words when the pool is big enough", () => {
    // Level B has hundreds of synonym pairs — plenty to fill two 10-question
    // rounds with zero overlap.
    const first = makeSynonymQuestions("B", 10);
    const avoidKeys = new Set(first.map((q) => `${q.display.word}|${q.display.match}`));
    const second = makeSynonymQuestions("B", 10, avoidKeys);
    const secondWords = new Set(second.map((q) => q.display.word));
    for (const q of first) expect(secondWords.has(q.display.word)).toBe(false);
  });

  it("still fills the round from the avoided pool when there's no fresh material left", () => {
    // Level A has only ~39 synonym pairs — asking for more than that, all
    // marked as "avoid", leaves nothing fresh, so it MUST fall back to
    // reusing them rather than returning a short/empty round.
    const first = makeSynonymQuestions("A", 39);
    const avoidKeys = new Set(first.map((q) => `${q.display.word}|${q.display.match}`));
    const second = makeSynonymQuestions("A", 39, avoidKeys);
    expect(second).toHaveLength(39);
  });

  it("also avoids repeats for Compound Words", () => {
    // Checked by the full (first, second) pair, not just the stem — the same
    // stem legitimately pairs with several different words (e.g. "Fire" +
    // "house"/"ball"/"boat"), so stem reuse alone isn't a repeat.
    const first = makeCompoundQuestions("B", 10);
    const avoidKeys = new Set(first.map((q) => `${q.display.word}|${q.display.match}`));
    const second = makeCompoundQuestions("B", 10, avoidKeys);
    const secondPairs = new Set(second.map((q) => `${q.display.word}|${q.display.match}`));
    for (const q of first) expect(secondPairs.has(`${q.display.word}|${q.display.match}`)).toBe(false);
  });
});
