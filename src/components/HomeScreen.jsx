import React, { useState, useEffect } from "react";
import { getBest, getTopRuns, formatTime, formatDate, getPrefs, savePrefs } from "../utils/leaderboard";

const LEVELS = [
  { id: "A", label: "Level A", desc: "Easiest",      emoji: "🌱" },
  { id: "B", label: "Level B", desc: "Intermediate", emoji: "⚡" },
  { id: "C", label: "Level C", desc: "Hardest",      emoji: "🔥" },
];

const TYPE_INFO = {
  synonyms: {
    emoji: "🟣",
    label: "Synonyms",
    description: "Synonyms are words that have the same or very similar meaning — e.g. Happy and Joyful.",
  },
  antonyms: {
    emoji: "🟠",
    label: "Antonyms",
    description: "Antonyms are words that have opposite meanings — e.g. Happy and Sad.",
  },
  fillInBlanks: {
    emoji: "🕵️",
    label: "Word Detective",
    description: "Read the clues and work out the missing word — learn what each word means and how to use it!",
  },
};

const Q_OPTIONS = [5, 10, 20, 30];
const NO_LEVEL_GAMES = ["fillInBlanks"];

export default function HomeScreen({ gameType, onPlay, onLearn, initialConfig }) {
  const isWordMatch = gameType === "wordMatch";
  const noLevel     = NO_LEVEL_GAMES.includes(gameType);

  // Restore the kid's last-used choices: saved prefs (survive restarts) first,
  // then the current session's config, then defaults.
  const [saved] = useState(() => getPrefs(gameType) || {});

  const [subType, setSubType] = useState(() => {
    if (saved.subType === "antonyms" || saved.subType === "synonyms") return saved.subType;
    return initialConfig?.gameType === "antonyms" ? "antonyms" : "synonyms";
  });
  const [level, setLevel] = useState(() => {
    if (["A", "B", "C"].includes(saved.level)) return saved.level;
    if (["A", "B", "C"].includes(initialConfig?.level)) return initialConfig.level;
    return "A";
  });
  const [totalQuestions, setTotal] = useState(() => {
    if (Q_OPTIONS.includes(saved.totalQuestions)) return saved.totalQuestions;
    if (Q_OPTIONS.includes(initialConfig?.totalQuestions)) return initialConfig.totalQuestions;
    return 20;
  });

  // Persist choices so they're remembered next time the app opens
  useEffect(() => {
    savePrefs(gameType, { subType, level, totalQuestions });
  }, [gameType, subType, level, totalQuestions]);

  const activeGameType  = isWordMatch ? subType : gameType;
  const scoreLevel      = noLevel ? "all" : level;
  const info            = TYPE_INFO[activeGameType];
  const maxStars        = totalQuestions * 3;
  const best            = getBest(scoreLevel, activeGameType, totalQuestions);
  const topRuns         = getTopRuns(scoreLevel, activeGameType, totalQuestions, 5);

  function handlePlay() {
    onPlay({ level: scoreLevel, totalQuestions, gameType: activeGameType });
  }

  return (
    <div className="home-screen">
      <div className="home-card">

        <div className="home-title">
          <span className="home-emoji">{isWordMatch ? "📚" : info.emoji}</span>
          <h1>{isWordMatch ? "Word Match" : info.label}</h1>
        </div>

        {/* Synonyms / Antonyms toggle — wordMatch only */}
        {isWordMatch && (
          <div className="toggle-group">
            <button
              className={`toggle-btn ${subType === "synonyms" ? "active" : ""}`}
              onClick={() => setSubType("synonyms")}
            >
              Synonyms
            </button>
            <button
              className={`toggle-btn ${subType === "antonyms" ? "active" : ""}`}
              onClick={() => setSubType("antonyms")}
            >
              Antonyms
            </button>
          </div>
        )}

        <p className="game-type-desc">{info.description}</p>

        <div className="home-columns">

          {/* ── Left: controls ── */}
          <div className="home-col home-col-controls">
            {!noLevel && (
              <>
                <div className="section-label">Choose Level</div>
                <div className="level-group">
                  {LEVELS.map((l) => {
                    const lb = getBest(l.id, activeGameType, totalQuestions);
                    return (
                      <button
                        key={l.id}
                        className={`level-btn ${level === l.id ? "active" : ""}`}
                        onClick={() => setLevel(l.id)}
                      >
                        <span className="level-emoji">{l.emoji}</span>
                        <span className="level-label">{l.label}</span>
                        <span className="level-desc">{l.desc}</span>
                        {lb && <span className="level-best">⭐ {lb.stars}/{maxStars}</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="section-label">Number of Questions</div>
            <div className="q-bar">
              {Q_OPTIONS.map((q, i) => {
                const activeIdx  = Q_OPTIONS.indexOf(totalQuestions);
                const isFilled   = i <= activeIdx;
                const isSelected = q === totalQuestions;
                return (
                  <button
                    key={q}
                    className={`q-segment ${isFilled ? "filled" : ""} ${isSelected ? "selected" : ""}`}
                    onClick={() => setTotal(q)}
                  >
                    {q}
                  </button>
                );
              })}
            </div>

            {onLearn && (
              <button className="secondary-btn" onClick={onLearn}>
                Learn the Words First
              </button>
            )}
            <button className="play-btn" onClick={handlePlay}>Play!</button>
          </div>

          {/* ── Right: personal best + runs ── */}
          <div className="home-col home-col-scores">
            <div className="section-label">🏆 Personal Best</div>
            {best ? (
              <div className="home-best">
                <span className="home-best-score">⭐ {best.stars}/{maxStars}</span>
                <span className="home-best-detail">{best.wrong} wrong · ⏱ {formatTime(best.time ?? 0)} · {formatDate(best.date)}</span>
              </div>
            ) : (
              <div className="home-best home-best--empty">No score yet — be the first! 🎯</div>
            )}

            <div className="section-label">Your Best Runs</div>
            {topRuns.length > 0 ? (
              <table className="lb-table">
                <thead>
                  <tr><th>#</th><th>Stars</th><th>Time</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {topRuns.map((r, i) => (
                    <tr key={i} className={i === 0 ? "lb-row lb-top" : "lb-row"}>
                      <td className="lb-rank">{i + 1}</td>
                      <td>⭐ {r.stars}/{maxStars}</td>
                      <td>{formatTime(r.time ?? 0)}</td>
                      <td className="lb-date">{formatDate(r.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="home-best home-best--empty">Play a game to see your best runs here! 🎯</div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
