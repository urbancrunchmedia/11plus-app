// Per-word learning signal — powers the parent progress report ("words to
// review"). Purely local (localStorage); no backend. Every game answer calls
// recordAttempt(); the report reads getWeakWords() / getSkillAccuracy().

const KEY = "11plus_progress";

// A word counts as "revised" (drops off the review list) once it's answered
// correctly this many times in a row after being missed.
const REMASTER_HITS = 2;

// Friendly labels for the skills we track.
export const SKILL_LABEL = {
  wordMatch:     "Word Match",
  compoundWords: "Compound Words",
  fillInBlanks:  "Word Detective",
  punctuation:   "Punctuation",
};

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { words: {}, skills: {} }; }
  catch { return { words: {}, skills: {} }; }
}
function save(o) {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* storage full/unavailable */ }
}

// Record a single answer. `word` is optional — pass it for the vocab games so
// the word feeds the review list; omit it (null) to log skill accuracy only.
export function recordAttempt({ skill, word, correct, meaning }) {
  if (!skill) return;
  const p = load();

  const s = p.skills[skill] || { hits: 0, misses: 0 };
  if (correct) s.hits++; else s.misses++;
  p.skills[skill] = s;

  if (word) {
    const key = `${skill}:${String(word).toLowerCase()}`;
    const w = p.words[key] || { word, skill, misses: 0, hitsSinceMiss: 0, meaning: meaning || "" };
    if (meaning && !w.meaning) w.meaning = meaning;
    if (correct) {
      w.hitsSinceMiss++;
    } else {
      w.misses++;
      w.hitsSinceMiss = 0;
      w.lastMissed = new Date().toISOString();
    }
    p.words[key] = w;
  }

  save(p);
}

// Words still worth revising: missed at least once and not yet re-mastered.
// Sorted hardest-first (most misses, then most recently missed).
export function getWeakWords(limit = 20) {
  const p = load();
  return Object.values(p.words)
    .filter((w) => w.misses > 0 && w.hitsSinceMiss < REMASTER_HITS)
    .sort((a, b) => (b.misses - a.misses) || String(b.lastMissed || "").localeCompare(String(a.lastMissed || "")))
    .slice(0, limit);
}

// Accuracy per skill, weakest-first, for the report's overview bars.
export function getSkillAccuracy() {
  const p = load();
  return Object.entries(p.skills)
    .map(([skill, { hits, misses }]) => {
      const total = hits + misses;
      return { skill, label: SKILL_LABEL[skill] || skill, total, misses, pct: total ? Math.round((hits / total) * 100) : 0 };
    })
    .filter((s) => s.total > 0)
    .sort((a, b) => a.pct - b.pct);
}

// Words currently worth revisiting for one skill (lowercased set).
export function getReviewWords(skill) {
  const p = load();
  return new Set(
    Object.values(p.words)
      .filter((w) => w.skill === skill && w.misses > 0 && w.hitsSinceMiss < REMASTER_HITS)
      .map((w) => String(w.word).toLowerCase())
  );
}

function shuffleP(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pick `count` items from `pool`, front-loading up to ~60% previously-missed
// words when `revisit` is on (the "Bring back missed words" setting). Cycles if
// the pool is smaller than count; result is shuffled for display.
export function selectWithReview(pool, count, keyFn, skill, revisit = true) {
  if (!pool || pool.length === 0) return [];
  let ordered = shuffleP(pool);
  if (revisit) {
    const review = getReviewWords(skill);
    if (review.size) {
      const isWeak = (x) => review.has(String(keyFn(x)).toLowerCase());
      const weak = ordered.filter(isWeak);
      const rest = ordered.filter((x) => !isWeak(x));
      const cap  = Math.min(weak.length, Math.ceil(count * 0.6));
      ordered = [...weak.slice(0, cap), ...rest];
    }
  }
  const out = [];
  for (let i = 0; i < count; i++) out.push(ordered[i % ordered.length]);
  return shuffleP(out);
}

export function getProgressSummary() {
  const p = load();
  const words = Object.values(p.words);
  const attempts = Object.values(p.skills).reduce((n, s) => n + s.hits + s.misses, 0);
  const mastered = words.filter((w) => w.misses > 0 && w.hitsSinceMiss >= REMASTER_HITS).length;
  return { attempts, toReview: getWeakWords(9999).length, mastered };
}
