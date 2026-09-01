import { describe, it, expect, beforeEach } from "vitest";
import { makeCompoundBuildQuestions } from "./worksheet";
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
});
