const BEST_KEY    = "11plus_personal_bests";
const HISTORY_KEY = "11plus_history";
const PREFS_KEY   = "11plus_prefs";

// ── Quiz setup preferences (remember last choices across restarts) ──
export function getPrefs(gameType) {
  try { return (JSON.parse(localStorage.getItem(PREFS_KEY)) || {})[gameType] || null; }
  catch { return null; }
}

export function savePrefs(gameType, prefs) {
  try {
    const all = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    all[gameType] = { ...all[gameType], ...prefs };
    localStorage.setItem(PREFS_KEY, JSON.stringify(all));
  } catch { /* storage unavailable — ignore */ }
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ordinal(n) {
  const s = ["th","st","nd","rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr.split("/").reverse().join("-")); // parse dd/mm/yyyy
  const day   = ordinal(d.getDate());
  const month = d.toLocaleString("en-GB", { month: "short" });
  const year  = String(d.getFullYear()).slice(2);
  return `${day} ${month} ${year}`;
}

// ── Personal best ────────────────────────────────────────────────
export function getAllBests() {
  try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {}; }
  catch { return {}; }
}

export function getBest(level, gameType, totalQuestions) {
  return getAllBests()[`${level}-${gameType}-${totalQuestions}`] || null;
}

export function saveIfBest(level, gameType, totalQuestions, stars, wrong, time) {
  const all  = getAllBests();
  const key  = `${level}-${gameType}-${totalQuestions}`;
  const prev = all[key];
  const isNew =
    !prev ||
    stars > prev.stars ||
    (stars === prev.stars && wrong < prev.wrong) ||
    (stars === prev.stars && wrong === prev.wrong && time < prev.time);

  if (isNew) {
    all[key] = { stars, wrong, time, date: new Date().toLocaleDateString("en-GB") };
    try { localStorage.setItem(BEST_KEY, JSON.stringify(all)); } catch {}
  }
  return isNew;
}

// ── Run history ───────────────────────────────────────────────────
function getAllHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || {}; }
  catch { return {}; }
}

export function saveRun(level, gameType, totalQuestions, stars, wrong, time, name) {
  const all  = getAllHistory();
  const key  = `${level}-${gameType}-${totalQuestions}`;
  const runs = all[key] || [];
  runs.push({ stars, wrong, time, name: name || "You", date: new Date().toLocaleDateString("en-GB") });
  all[key] = runs.slice(-50);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(all)); } catch {}
}

export function getTopRuns(level, gameType, totalQuestions, n = 5) {
  const all  = getAllHistory();
  const runs = all[`${level}-${gameType}-${totalQuestions}`] || [];
  return [...runs]
    .sort((a, b) =>
      b.stars - a.stars ||
      a.wrong - b.wrong ||
      a.time  - b.time
    )
    .slice(0, n);
}
