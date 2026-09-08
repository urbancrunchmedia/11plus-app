// Display names are shown to every friend on a leaderboard, and typed by
// children, so they're checked at the one place they're set.
//
// Three separate concerns, in order of how often they bite:
//   1. shape   — a name, not a sentence or a message
//   2. contact — no links, emails or phone numbers hidden in a name
//   3. words   — profanity and slurs, including obfuscated spellings
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

// The recommended transformers also catch f*ck, fvck, f-u-c-k and friends,
// which a plain word list misses entirely.
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export const MIN_NAME = 2;
export const MAX_NAME = 20;

// Letters from any alphabet, plus the punctuation real names use.
const SHAPE = /^\p{L}[\p{L} '’-]*$/u;
const CONTACT = /(https?:|www\.|\.com\b|\.co\.uk\b|@|\+?\d[\d\s-]{6,})/i;

export function checkDisplayName(raw) {
  const value = String(raw ?? "").replace(/\s+/g, " ").trim();

  if (value.length < MIN_NAME) return { ok: false, reason: "Please use at least 2 letters." };
  if (value.length > MAX_NAME) return { ok: false, reason: `Names can be up to ${MAX_NAME} characters.` };
  if (CONTACT.test(value)) return { ok: false, reason: "Names can't include links, emails or phone numbers." };
  if (!SHAPE.test(value)) return { ok: false, reason: "Use letters only — spaces, hyphens and apostrophes are fine." };
  if (matcher.hasMatch(value)) return { ok: false, reason: "That name isn't allowed. Please choose another one." };

  return { ok: true, value };
}
