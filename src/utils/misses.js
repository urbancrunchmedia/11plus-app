// Per-skill queue of missed questions, replayable in "Practice" mode.
// A question enters the queue when answered wrong, and leaves it when answered
// correctly first try (clean mastery). The landing's Practice button shows the
// queue length and replays only these until the queue is empty.
//
// Each entry is { id, payload }: `id` dedupes/clears; `payload` is everything the
// game needs to rebuild that exact question.

const KEY = (skill) => `11plus_misses_${skill}`;

function load(skill) {
  try { return JSON.parse(localStorage.getItem(KEY(skill))) || []; }
  catch { return []; }
}
function save(skill, list) {
  try { localStorage.setItem(KEY(skill), JSON.stringify(list.slice(-300))); }
  catch { /* storage unavailable */ }
}

export function addMiss(skill, id, payload) {
  const list = load(skill);
  if (!list.some((m) => m.id === id)) { list.push({ id, payload }); save(skill, list); }
}

// Remove a mastered item from the queue (no-op if not present).
export function clearMiss(skill, id) {
  const list = load(skill);
  const next = list.filter((m) => m.id !== id);
  if (next.length !== list.length) save(skill, next);
}

export function getMisses(skill) { return load(skill).map((m) => m.payload); }
export function missCount(skill) { return load(skill).length; }
