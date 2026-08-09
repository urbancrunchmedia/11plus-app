// ⚠️ Auto-derived from vocab.js — the single source of truth.
// Synonyms/antonyms now live wholly in words.js (also derived from vocab), so
// these lists are empty to avoid duplication; only the meanings (definitionMatch)
// are surfaced here for the Word List. Add words in src/data/vocab.js.
import { vocab } from "./vocab";

const def = (L) => vocab[L].filter((e) => e.meaning).map((e) => ({ word: e.word, match: e.meaning }));

export const bookletWordData = {
  A: { synonyms: [], antonyms: [], definitionMatch: def("A") },
  B: { synonyms: [], antonyms: [], definitionMatch: def("B") },
  C: { synonyms: [], antonyms: [], definitionMatch: def("C") },
};
