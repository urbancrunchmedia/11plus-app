// ⚠️ Auto-derived from vocab.js — the single source of truth.
// Do NOT add words here; add them to src/data/vocab.js and they flow everywhere.
import { vocab } from "./vocab";

const syn = (L) => vocab[L].filter((e) => e.synonym).map((e) => ({ word: e.word, match: e.synonym }));
const ant = (L) => vocab[L].filter((e) => e.antonym).map((e) => ({ word: e.word, match: e.antonym }));

export const wordData = {
  A: { synonyms: syn("A"), antonyms: ant("A") },
  B: { synonyms: syn("B"), antonyms: ant("B") },
  C: { synonyms: syn("C"), antonyms: ant("C") },
};
