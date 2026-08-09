// ⚠️ Auto-derived from vocab.js — the single source of truth.
// A word appears in Word Detective when it has a `sentence` in vocab.js.
// Add words / sentences in src/data/vocab.js.
import { vocab } from "./vocab";

const clues = (L) =>
  vocab[L]
    .filter((e) => e.sentence)
    .map((e) => ({ word: e.word, sentence: e.sentence, definition: e.meaning || "" }));

export const fillInBlanksData = {
  A: clues("A"),
  B: clues("B"),
  C: clues("C"),
};
