import React, { useState, useEffect } from "react";
import { getBest, getTopRuns, formatTime, formatDate, getPrefs, savePrefs, getSetting } from "../utils/leaderboard";
import { getSkillMastery, getXp } from "../utils/gamify";
import { compoundWords } from "../data/compoundWords";
import SampleQuiz from "./SampleQuiz";
import Icon, { SKILL_ICON } from "./Icon";

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }

// Free sample puzzles for the Compound Words landing (real compound data).
function buildCompoundSamples() {
  const all = [...(compoundWords.A || []), ...(compoundWords.B || []), ...(compoundWords.C || [])];
  return shuffle(all).slice(0, 5).map((c) => {
    const decoys = shuffle(all.filter((x) => x.second !== c.second)).slice(0, 3).map((x) => x.second);
    const options = shuffle([c.second, ...decoys]);
    return { sentence: `${c.first} + _____`, options, answer: options.indexOf(c.second), teach: `Makes "${c.first}${c.second}".` };
  });
}

const LEVELS = [
  { id: "A", label: "Level A", desc: "Easiest",      emoji: "🌱" },
  { id: "B", label: "Level B", desc: "Intermediate", emoji: "⚡" },
  { id: "C", label: "Level C", desc: "Hardest",      emoji: "🔥" },
];

const TYPE_INFO = {
  synonyms:      { description: "Words that mean the same. Match each word with its synonym." },
  antonyms:      { description: "Words that mean the opposite. Match each word with its antonym." },
  fillInBlanks:  { description: "Read the clue and work out the missing word — learn what each word means." },
  compoundWords: { description: "Two small words joined into one — e.g. Sun + Flower = Sunflower." },
};

// Header identity per game (the landing is shared by Word Match / Compound / Detective).
const SKILL_META = {
  wordMatch:     { title: "Word Match",     sub: "Synonyms & antonyms",     icon: "📚",  bg: "#e4f6ff" },
  compoundWords: { title: "Compound Words", sub: "Join two words into one", icon: "🧩",  bg: "#f3fbd4" },
  fillInBlanks:  { title: "Word Detective", sub: "Find the word from clues", icon: "🕵️", bg: "#eaf4fc" },
};

const Q_OPTIONS = [5, 10, 20, 30];
const NO_LEVEL_GAMES = ["fillInBlanks"];
// Games that expose the Match/Worksheet play-style toggle. Hidden for now —
// Word Match plays Match; Compound Words plays the build-the-word puzzle.
const FORMAT_GAMES = [];

export default function HomeScreen({ gameType, onPlay, onLearn, initialConfig }) {
  const isWordMatch    = gameType === "wordMatch";
  const noLevel        = NO_LEVEL_GAMES.includes(gameType);
  const supportsFormat = FORMAT_GAMES.includes(gameType);
  const meta           = SKILL_META[gameType] || SKILL_META.wordMatch;

  const [saved] = useState(() => getPrefs(gameType) || {});

  const [subType, setSubType] = useState(() => {
    if (saved.subType === "antonyms" || saved.subType === "synonyms") return saved.subType;
    return initialConfig?.baseType === "antonyms" ? "antonyms" : "synonyms";
  });
  const [format, setFormat] = useState(() => {
    if (saved.format === "match" || saved.format === "worksheet") return saved.format;
    return "match";
  });
  const [level, setLevel] = useState(() => {
    if (["A", "B", "C"].includes(saved.level)) return saved.level;
    if (["A", "B", "C"].includes(initialConfig?.level)) return initialConfig.level;
    return getSetting("defaultDifficulty", "A");
  });
  const [totalQuestions, setTotal] = useState(() => {
    if (Q_OPTIONS.includes(saved.totalQuestions)) return saved.totalQuestions;
    if (Q_OPTIONS.includes(initialConfig?.totalQuestions)) return initialConfig.totalQuestions;
    return 10;
  });

  const [compSamples] = useState(() => (gameType === "compoundWords" ? buildCompoundSamples() : []));

  useEffect(() => {
    savePrefs(gameType, { subType, level, totalQuestions, format });
  }, [gameType, subType, level, totalQuestions, format]);

  const baseType    = isWordMatch ? subType : gameType;
  const isWorksheet = supportsFormat && format === "worksheet";
  const scoreType   = isWorksheet ? `${baseType}Ws` : baseType;
  const scoreLevel  = noLevel ? "all" : level;
  const info        = TYPE_INFO[baseType] || {};
  const maxStars    = totalQuestions * 3;
  const best        = getBest(scoreLevel, scoreType, totalQuestions);
  const topRuns     = getTopRuns(scoreLevel, scoreType, totalQuestions, 5);
  const masteryPct  = (getSkillMastery().find((m) => m.id === gameType) || {}).pct ?? 0;
  const estMin      = Math.max(1, Math.round(totalQuestions * 0.3));

  function handlePlay() {
    onPlay({ level: scoreLevel, totalQuestions, gameType: scoreType, baseType, format: isWorksheet ? "worksheet" : "match" });
  }

  return (
    <div className="landing">
      {/* Header */}
      <div className="landing-head">
        <div className="landing-icon" style={{ background: (SKILL_ICON[gameType] || SKILL_ICON.wordMatch).bg }}>
          <Icon name={(SKILL_ICON[gameType] || SKILL_ICON.wordMatch).name} stroke={(SKILL_ICON[gameType] || SKILL_ICON.wordMatch).stroke} size={26} />
        </div>
        <div className="landing-head-txt">
          <h1 className="landing-h1">{meta.title}</h1>
          <div className="landing-sub">{meta.sub} · {masteryPct}% mastered</div>
        </div>
        <span className="landing-xp">{getXp().toLocaleString()} XP</span>
      </div>

      {/* Free sample puzzle — Compound Words only */}
      {gameType === "compoundWords" && (
        <div className="samp-card">
          <SampleQuiz
            label="TRY A PUZZLE — FREE"
            items={compSamples}
            blank="_____"
            hint="Pick the word that joins on to make a real compound word."
            nextLabel="Next puzzle"
          />
        </div>
      )}

      {/* Picked-for-you hero */}
      <div className="landing-hero">
        {isWordMatch && (
          <div className="hero-chips">
            <button className={`hero-chip ${subType === "synonyms" ? "active" : ""}`} onClick={() => setSubType("synonyms")}>Synonyms</button>
            <button className={`hero-chip ${subType === "antonyms" ? "active" : ""}`} onClick={() => setSubType("antonyms")}>Antonyms</button>
          </div>
        )}
        <span className="dash-chip">PICKED FOR YOU</span>
        <div className="landing-hero-title">
          {noLevel ? `All words · ${totalQuestions}` : `Level ${level} · ${totalQuestions} words`}
        </div>
        <div className="landing-hero-blurb">{info.description}</div>
        <div className="landing-tags">
          <span className="landing-tag">⏱ ~{estMin} min</span>
          {supportsFormat && <span className="landing-tag">{isWorksheet ? "📝 Worksheet" : "🎯 Match"}</span>}
          <span className="landing-tag">🔥 keeps streak</span>
        </div>
        <div className="landing-hero-actions">
          <button className="landing-start" onClick={handlePlay}>
            <span>Start round</span><span className="dash-hero-arrow">→</span>
          </button>
          {onLearn && <button className="landing-learn" onClick={onLearn}>Learn first</button>}
        </div>
      </div>

      {/* Choose your own */}
      <div className="landing-or"><span>Or choose your own</span></div>

      {supportsFormat && (
        <div className="toggle-group">
          <button className={`toggle-btn ${format === "match" ? "active" : ""}`} onClick={() => setFormat("match")}>🎯 Match</button>
          <button className={`toggle-btn ${format === "worksheet" ? "active" : ""}`} onClick={() => setFormat("worksheet")}>📝 Worksheet</button>
        </div>
      )}

      {!noLevel && (
        <div className="level-group">
          {LEVELS.map((l) => {
            const lb = getBest(l.id, scoreType, totalQuestions);
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
      )}

      <div className="landing-lenrow">
        <span className="landing-lenlabel">Length</span>
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
      </div>

      {/* Best runs */}
      <div className="landing-best">
        <div className="section-label">🏆 Personal best</div>
        {best ? (
          <div className="home-best">
            <span className="home-best-score">⭐ {best.stars}/{maxStars}</span>
            <span className="home-best-detail">{best.wrong} wrong · ⏱ {formatTime(best.time ?? 0)} · {formatDate(best.date)}</span>
          </div>
        ) : (
          <div className="home-best home-best--empty">No score yet — be the first! 🎯</div>
        )}

        {topRuns.length > 0 && (
          <>
            <div className="section-label">Your best runs</div>
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
          </>
        )}
      </div>
    </div>
  );
}
