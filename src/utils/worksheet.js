// Question generators for the worksheet-style games (CGP/GL "two groups of
// three" format). Each question presents a left group and a right group of
// three words; the player picks one word from each side.
//
//   { left: [w, w, w], right: [w, w, w], answerLeft, answerRight, display: { word, match } }
//
// `display` is what the results/leaderboard screen shows (e.g. "Water → Fall").

import { wordData } from "../data/words";
import { bookletWordData } from "../data/bookletWords";
import { compoundWords } from "../data/compoundWords";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pick `n` distinct random items from `arr` whose value (via keyOf) is not in
// `excluded`. Returns as many as it can find (may be < n for tiny pools).
function sampleDistinct(arr, n, excluded, keyOf = (x) => x) {
  const out = [];
  const used = new Set(excluded);
  for (const item of shuffle(arr)) {
    if (out.length >= n) break;
    const k = keyOf(item);
    if (used.has(k)) continue;
    used.add(k);
    out.push(item);
  }
  return out;
}

// Choose `count` target pairs from `pool`, cycling if the pool is smaller.
function pickTargets(pool, count) {
  if (pool.length === 0) return [];
  const shuffled = shuffle(pool);
  const targets = [];
  for (let i = 0; i < count; i++) targets.push(shuffled[i % shuffled.length]);
  return targets;
}

// ── Compound Words · Worksheet format (join two halves) ──────────────
// Left = a first-half + 2 decoys; right = a second-half + 2 decoys. Decoys are
// chosen so the ONLY left×right combination that forms a real compound (per our
// data) is the intended one — otherwise a question would have two right answers.
export function makeCompoundQuestions(level, count = 5) {
  const pool   = compoundWords[level] ?? [];
  const firsts = [...new Set(pool.map((c) => c.first))];
  const seconds = [...new Set(pool.map((c) => c.second))];
  const valid  = new Set(pool.map((c) => (c.first + c.second).toLowerCase()));

  const combines = (l, r) => valid.has((l + r).toLowerCase());

  return pickTargets(pool, count).map(({ first, second }) => {
    // Left decoys must not combine with the correct right word.
    const leftDecoys = sampleDistinct(
      firsts.filter((f) => f !== first && !combines(f, second)),
      2,
      [first]
    );
    // Right decoys must not combine with the correct first word, nor with
    // either left decoy (so no stray second valid answer appears anywhere).
    const rightDecoys = sampleDistinct(
      seconds.filter(
        (s) =>
          s !== second &&
          !combines(first, s) &&
          !leftDecoys.some((ld) => combines(ld, s))
      ),
      2,
      [second]
    );

    return {
      left:  shuffle([first, ...leftDecoys]),
      right: shuffle([second, ...rightDecoys]),
      answerLeft:  first,
      answerRight: second,
      display: { word: first, match: second },
    };
  });
}

// ── Meaning pairs (synonyms OR antonyms) ─────────────────────────────
// Left = a word + 2 decoys; right = its pair (synonym/antonym) + 2 decoys.
// Decoys are chosen so the only left×right pair that matches (per our data) is
// the target — no question ever has two right answers.
function makeMeaningQuestions(level, count, type) {
  const pool = [
    ...(wordData[level]?.[type] ?? []),
    ...(bookletWordData[level]?.[type] ?? []),
  ];
  const words   = [...new Set(pool.map((p) => p.word))];
  const matches = [...new Set(pool.map((p) => p.match))];
  const valid   = new Set(pool.map((p) => `${p.word}|${p.match}`.toLowerCase()));

  const isPair = (w, m) => valid.has(`${w}|${m}`.toLowerCase());

  return pickTargets(pool, count).map(({ word, match }) => {
    const leftDecoys = sampleDistinct(
      words.filter((w) => w !== word && !isPair(w, match)),
      2,
      [word]
    );
    const rightDecoys = sampleDistinct(
      matches.filter(
        (m) =>
          m !== match &&
          !isPair(word, m) &&
          !leftDecoys.some((ld) => isPair(ld, m))
      ),
      2,
      [match]
    );

    return {
      left:  shuffle([word, ...leftDecoys]),
      right: shuffle([match, ...rightDecoys]),
      answerLeft:  word,
      answerRight: match,
      display: { word, match },
    };
  });
}

export const makeSynonymQuestions = (level, count = 5) => makeMeaningQuestions(level, count, "synonyms");
export const makeAntonymQuestions = (level, count = 5) => makeMeaningQuestions(level, count, "antonyms");
