import { describe, it, expect } from "vitest";
import { spellingSpot } from "./spellingSpot";

// The data-quality contract for this bank: every level was hand-validated
// once against these exact rules when it grew from 33 to 55 questions. Keep
// them enforced so a future edit can't silently reintroduce a duplicate or a
// malformed question.
describe("spellingSpot", () => {
  it("has 55 questions in each level", () => {
    for (const L of ["A", "B", "C"]) expect(spellingSpot[L].length).toBe(55);
  });

  for (const L of ["A", "B", "C"]) {
    it(`level ${L}: every question is well-formed`, () => {
      for (const q of spellingSpot[L]) {
        expect(q.segments).toHaveLength(4);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThanOrEqual(4);
        expect(q.why).toBeTruthy();
      }
    });

    it(`level ${L}: no two questions target the same word`, () => {
      const targets = spellingSpot[L]
        .map((q) => q.why.match(/“([^”]+)”/)?.[1]?.toLowerCase())
        .filter(Boolean);
      expect(new Set(targets).size).toBe(targets.length);
    });

    it(`level ${L}: no two questions share the same sentence`, () => {
      const sentences = spellingSpot[L].map((q) => q.segments.join(" "));
      expect(new Set(sentences).size).toBe(sentences.length);
    });
  }
});
