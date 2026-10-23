import React, { useState, useEffect } from "react";
import { getPrefs, savePrefs, getSetting } from "../utils/leaderboard";
import { getSkillMastery } from "../utils/gamify";
import { usePremium } from "../contexts/PremiumContext";
import { canPickLevel } from "../utils/entitlement";
import PracticeButton from "./PracticeButton";
import Icon, { SKILL_ICON } from "./Icon";
import Dropdown from "./Dropdown";
import FreePlanNote from "./FreePlanNote";

const LEVELS = [
  { id: "A",   label: "Easy",   desc: "Easiest",      emoji: "🌱" },
  { id: "B",   label: "Medium", desc: "Intermediate", emoji: "⚡" },
  { id: "C",   label: "Hard",   desc: "Hardest",      emoji: "🔥" },
  { id: "all", label: "Mixed",  desc: "Exam-style mix of every level", emoji: "🎲" },
];

const TYPE_INFO = {
  synonyms:      { description: "Words that mean the same. Match each word with its synonym." },
  antonyms:      { description: "Words that mean the opposite. Match each word with its antonym." },
  fillInBlanks:  { description: "Read the clue and work out the missing word. Learn what each word means." },
  compoundWords: { description: "Two small words joined into one, e.g. Sun + Flower = Sunflower." },
};

// Header identity per game (the landing is shared by Synonyms / Antonyms / Compound / Detective).
const SKILL_META = {
  synonyms:      { title: "Synonyms",       sub: "Same meaning" },
  antonyms:      { title: "Antonyms",       sub: "Opposite meaning" },
  compoundWords: { title: "Compound Words", sub: "Join two words into one", icon: "🧩",  bg: "#f3fbd4" },
  fillInBlanks:  { title: "Word Detective", sub: "Find the word from clues", icon: "🕵️", bg: "#eaf4fc" },
};

const Q_OPTIONS = [5, 10, 20, 30];
const NO_LEVEL_GAMES = ["fillInBlanks"];
// Games that expose the Match/Worksheet play-style toggle. Hidden for now —
// Word Match plays Match; Compound Words plays the build-the-word puzzle.
const FORMAT_GAMES = [];

export default function HomeScreen({ gameType, onPlay, onLearn, initialConfig, onExit }) {
  const noLevel        = NO_LEVEL_GAMES.includes(gameType);
  const supportsFormat = FORMAT_GAMES.includes(gameType);
  const meta           = SKILL_META[gameType] || SKILL_META.synonyms;

  const [saved] = useState(() => getPrefs(gameType) || {});

  const [format] = useState(() => {
    if (saved.format === "match" || saved.format === "worksheet") return saved.format;
    return "match";
  });
  const [level, setLevel] = useState(() => {
    if (["A", "B", "C", "all"].includes(saved.level)) return saved.level;
    if (["A", "B", "C", "all"].includes(initialConfig?.level)) return initialConfig.level;
    return getSetting("defaultDifficulty", "A");
  });
  const [totalQuestions, setTotal] = useState(() => {
    if (Q_OPTIONS.includes(saved.totalQuestions)) return saved.totalQuestions;
    if (Q_OPTIONS.includes(initialConfig?.totalQuestions)) return initialConfig.totalQuestions;
    return 10;
  });


  const { isPremium, openPaywall } = usePremium();
  // Free users can't sit on a harder level once today's taster round is used — snap back to A.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- level is the source of truth fed to buildQuestions()/savePrefs(), so this corrects real state, not a display value.
    if (!noLevel && !canPickLevel(level, isPremium)) setLevel("A");
  }, [isPremium, noLevel, level]);

  function handleLevelChange(v) {
    if (!canPickLevel(v, isPremium)) { openPaywall("taster"); return; }
    setLevel(v);
  }

  useEffect(() => {
    savePrefs(gameType, { level, totalQuestions, format });
  }, [gameType, level, totalQuestions, format]);

  const baseType    = gameType;
  const isWorksheet = supportsFormat && format === "worksheet";
  const scoreType   = isWorksheet ? `${baseType}Ws` : baseType;
  const scoreLevel  = noLevel ? "all" : level;
  const info        = TYPE_INFO[baseType] || {};
  const skillM      = getSkillMastery().find((m) => m.id === gameType) || {};
  const masteryPct  = skillM.pct ?? 0;

  function handlePlay() {
    onPlay({ level: scoreLevel, totalQuestions, gameType: scoreType, baseType, format: isWorksheet ? "worksheet" : "match" });
  }

  return (
    <div className="landing">
      {onExit && <button className="round-back-btn round-back-btn--standalone" onClick={onExit} aria-label="Back to all games">←</button>}
      {/* Header */}
      <div className="landing-head">
        <div className="landing-icon" style={{ background: (SKILL_ICON[gameType] || SKILL_ICON.synonyms).bg }}>
          <Icon name={(SKILL_ICON[gameType] || SKILL_ICON.synonyms).name} stroke={(SKILL_ICON[gameType] || SKILL_ICON.synonyms).stroke} size={26} />
        </div>
        <div className="landing-head-txt">
          <h1 className="landing-h1">{meta.title}</h1>
          <div className="landing-sub">{meta.sub}{skillM.attempted ? ` · ${masteryPct}% accuracy` : ""}</div>
        </div>
      </div>


      {/* Picked-for-you hero */}
      <div className="landing-hero">
        <div className="landing-hero-title">
          {noLevel ? `All words · ${totalQuestions}` : `${LEVELS.find((l) => l.id === level)?.label || level} · ${totalQuestions} words`}
        </div>
        <div className="landing-hero-blurb">{info.description}</div>
        <div className="landing-hero-actions">
          <div className="hero-selects">
            {!noLevel && (
              <Dropdown
                ariaLabel="Level"
                value={level}
                onChange={handleLevelChange}
                options={[
                  { value: "A", label: "Easy" },
                  { value: "B", label: "Medium", locked: !isPremium },
                  { value: "C", label: "Hard", locked: !isPremium },
                  { value: "all", label: "Mixed", locked: !isPremium },
                ]}
              />
            )}
            <Dropdown
              ariaLabel="Length"
              value={totalQuestions}
              onChange={(v) => setTotal(Number(v))}
              options={Q_OPTIONS.map((q) => ({ value: q, label: `${q} words` }))}
            />
          </div>
          <button className="landing-start" onClick={handlePlay}>
            <span>Start round</span><span className="dash-hero-arrow">→</span>
          </button>
          <div className="hero-secondary">
            {onLearn && <button className="landing-learn" onClick={onLearn}>Learn first</button>}
            <PracticeButton skill={gameType} onPractice={() => onPlay({ practice: true, level: scoreLevel, totalQuestions, gameType: scoreType, baseType })} />
          </div>
        </div>
      </div>
      <FreePlanNote game={gameType} />
    </div>
  );
}
