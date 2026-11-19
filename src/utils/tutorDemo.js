// "See an example class": 12 made-up pupils for the tutor dashboard, so a
// tutor can see what it looks like before (or while) families connect.
// Generated on the device from a fixed seed, relative to today, in the same
// shape as a real pupil's synced users/{uid} document. Never saved anywhere.

// Real 11+ words from the app's word lists, with the game they belong to.
const WORDS = [
  ["synonyms", "Meticulous", "Very careful about details"], ["synonyms", "Placid", "Calm and peaceful"],
  ["synonyms", "Abundant", "More than enough"], ["synonyms", "Candid", "Honest and straightforward"],
  ["antonyms", "Reluctant", "Not willing"], ["antonyms", "Frivolous", "Not serious"],
  ["antonyms", "Tenacious", "Determined"], ["fillInBlanks", "Diligent", "Hard-working"],
  ["fillInBlanks", "Radiant", "Glowing"], ["spelling", "necessary", ""], ["spelling", "separate", ""],
  ["spelling", "definitely", ""], ["compoundWords", "Bookworm", ""], ["wordClass", "Swiftly", "An adverb"],
];
const GAMES = ["synonyms", "antonyms", "compoundWords", "fillInBlanks", "punctuation", "spelling", "wordClass"];

// Each pupil's personality: how often they play, how accurate, what they find hard.
const PUPILS = [
  { name: "Aisha", days: 6, acc: 0.92, weak: "spelling" },
  { name: "Ben", days: 2, acc: 0.8, weak: "punctuation", struggle: true },
  { name: "Chloe", days: 5, acc: 0.88, weak: "antonyms" },
  { name: "Dev", days: 4, acc: 0.78, weak: "spelling", struggle: true },
  { name: "Ella", days: 0, acc: 0.85, weak: "synonyms", quietFor: 11 },
  { name: "Finn", days: 3, acc: 0.81, weak: "wordClass", dropping: true },
  { name: "Grace", days: 7, acc: 0.95, weak: "compoundWords" },
  { name: "Harry", days: 1, acc: 0.8, weak: "fillInBlanks" },
  { name: "Isla", days: 5, acc: 0.9, weak: "punctuation" },
  { name: "Jamal", days: 0, acc: 0, weak: null, never: true },
  { name: "Kiara", days: 4, acc: 0.86, weak: "synonyms" },
  { name: "Leo", days: 0, acc: 0.78, weak: "antonyms", quietFor: 8 },
];

function seeded(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const ukDate = (ms) => new Date(ms).toLocaleDateString("en-GB");

function pupilData(spec, index, now) {
  if (spec.never) return { history: {}, progress: { words: {}, skills: {} } };
  const rand = seeded(1000 + index * 97);
  const day = 864e5;
  const history = {};
  const addRun = (daysAgo, game, accuracy) => {
    const level = accuracy > 0.88 ? "C" : accuracy > 0.75 ? "B" : "A";
    const wrong = Math.max(0, Math.round(10 / Math.max(accuracy, 0.4) - 10 + (rand() - 0.5) * 2));
    (history[`${level}-${game}-10`] ||= []).push({ stars: wrong <= 1 ? 3 : wrong <= 3 ? 2 : 1, wrong, time: Math.round(140 + rand() * 120), name: spec.name, date: ukDate(now - daysAgo * day) });
  };
  // Last four weeks of practice: this week as specified, earlier weeks a little steadier.
  const recentStart = spec.quietFor || 0;
  for (let d = recentStart; d < 28; d++) {
    const thisWeek = d < 7;
    const chance = thisWeek ? spec.days / 7 : Math.max(spec.days, 3) / 7;
    if (rand() > chance) continue;
    const rounds = 1 + (rand() < 0.35 ? 1 : 0);
    for (let r = 0; r < rounds; r++) {
      const game = rand() < 0.35 ? spec.weak : GAMES[Math.floor(rand() * GAMES.length)];
      const base = game === spec.weak ? spec.acc - 0.12 : spec.acc;
      // "Dropping": recent rounds noticeably worse than earlier ones.
      const accuracy = spec.dropping ? (d < 14 ? base - 0.15 : base + 0.05) : base;
      addRun(d, game, Math.min(0.98, Math.max(0.35, accuracy + (rand() - 0.5) * 0.06)));
    }
  }
  // All-time answers per game, weakest game clearly lower.
  const skills = {};
  for (const g of GAMES) {
    if (rand() < 0.3 && g !== spec.weak) continue;
    const total = Math.round(20 + rand() * 90) + (g === spec.weak ? 25 : 0);
    const acc = g === spec.weak ? (spec.struggle ? 0.58 : spec.acc - 0.1) : spec.acc + (rand() - 0.5) * 0.08;
    const hits = Math.round(total * Math.min(0.98, Math.max(0.3, acc)));
    skills[g] = { hits, misses: total - hits };
  }
  // A few tricky words, weighted to their weak game; one or two turned around.
  const words = {};
  const pool = WORDS.filter(([skill]) => skill === spec.weak).concat(WORDS.filter(([skill]) => skill !== spec.weak));
  const count = 1 + Math.floor(rand() * 4) + (spec.struggle ? 2 : 0);
  pool.slice(0, count + 1).forEach(([skill, word, meaning], i) => {
    const turned = i === count;
    words[`${skill}:${word.toLowerCase()}`] = {
      word, skill, meaning, misses: 1 + Math.floor(rand() * 3), hitsSinceMiss: turned ? 2 : 0,
      lastMissed: new Date(now - (1 + i) * day).toISOString(),
    };
  });
  return { history, progress: { skills, words } };
}

export function demoPupils(now = Date.now()) {
  return PUPILS.map((spec, i) => ({
    uid: `demo-${i}`,
    name: spec.name,
    connectedAt: new Date(now - (20 + i) * 864e5).toISOString(),
    data: pupilData(spec, i, now),
    demo: true,
  }));
}
